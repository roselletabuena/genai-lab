"""Orchestrator for the multi-attempt remediation loop."""

import json
import os
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

from remediation_agent.llm.client_protocol import LLMProvider
from remediation_agent.llm.prompts import build_remediation_prompt
from remediation_agent.models.context import CodeContextScope
from remediation_agent.models.diagnostics import SandboxRunResult
from remediation_agent.models.session import (
    AttemptStatus,
    RemediationAttempt,
    RemediationSession,
    SessionFinalStatus,
)
from remediation_agent.parsers.ast_extractor import ASTScopeExtractor
from remediation_agent.parsers.test_log_parser import TestLogParser
from remediation_agent.patcher.diff_applier import DiffApplier
from remediation_agent.patcher.rollback import GitRollbackManager


class RemediationLoop:
    """Manages iterative diagnosis, synthesis, and sandbox testing up to 3 attempts."""

    def __init__(
        self,
        repo_root: str | Path | None = None,
        test_command: str = "npm test",
        llm_provider: LLMProvider | None = None,
        sandbox_runner: object | None = None,
        max_attempts: int = 3,
        output_log_path: str | Path | None = None,
    ) -> None:
        self.repo_root = Path(repo_root or os.getcwd()).resolve()
        self.test_command = test_command
        self.llm_provider = llm_provider
        self.sandbox_runner = sandbox_runner
        self.max_attempts = min(max(1, max_attempts), 3)  # Hard bound: 1..3
        self.output_log_path = Path(output_log_path) if output_log_path else None

        self.log_parser = TestLogParser()
        self.ast_extractor = ASTScopeExtractor()
        self.diff_applier = DiffApplier(repo_root=self.repo_root)
        self.rollback_mgr = GitRollbackManager(repo_root=self.repo_root)

    def run(self, initial_failure: SandboxRunResult | None = None) -> RemediationSession:
        """Execute the remediation loop until resolved or attempts exhausted."""
        session_id = str(uuid.uuid4())
        created_at = datetime.now(UTC)

        # 1. Acquire initial failure
        current_failure = initial_failure
        if not current_failure and self.sandbox_runner:
            current_failure = self.sandbox_runner.run(self.test_command)

        if not current_failure or current_failure.exit_code == 0:
            # Tests already pass or no failure
            session = RemediationSession(
                session_id=session_id,
                repository_path=str(self.repo_root),
                test_command=self.test_command,
                initial_failure=current_failure
                or SandboxRunResult(exit_code=0, stdout="No failure", duration_ms=0),
                attempts=[],
                final_status=SessionFinalStatus.RESOLVED,
                rolled_back=False,
                created_at=created_at,
                completed_at=datetime.now(UTC),
            )
            self._write_audit_log(session)
            return session

        attempts: list[RemediationAttempt] = []
        final_status = SessionFinalStatus.EXHAUSTED
        rolled_back = False
        previous_diff: str | None = None

        for attempt_no in range(1, self.max_attempts + 1):
            start_time = time.time()
            diagnostics = self.log_parser.parse(current_failure)

            # Extract AST enclosing scopes for each diagnostic
            scopes: list[CodeContextScope] = []
            for diag in diagnostics:
                target_file = self.repo_root / diag.file_path
                if target_file.exists():
                    try:
                        scope = self.ast_extractor.extract(target_file, diag.line_number)
                        scopes.append(scope)
                    except Exception:
                        pass

            # Build contextual prompt
            prompt = build_remediation_prompt(
                diagnostics=diagnostics,
                scopes=scopes,
                attempt_number=attempt_no,
                previous_diff=previous_diff,
            )

            # Synthesize candidate patch via LLM
            if not self.llm_provider:
                raise ValueError("No LLMProvider configured for patch synthesis")

            patch = self.llm_provider.synthesize_patch(prompt)
            previous_diff = patch.diff_text

            # Dry-run check patch applicability
            is_applicable, check_err = self.diff_applier.check(patch)
            if not is_applicable:
                duration_ms = int((time.time() - start_time) * 1000)
                attempt = RemediationAttempt(
                    attempt_number=attempt_no,
                    diagnostics=diagnostics,
                    patch=patch,
                    test_result=None,
                    status=AttemptStatus.FAILED_TO_APPLY,
                    duration_ms=duration_ms,
                )
                attempts.append(attempt)
                continue

            # Apply candidate patch
            apply_ok, apply_err = self.diff_applier.apply(patch)
            if not apply_ok:
                duration_ms = int((time.time() - start_time) * 1000)
                attempt = RemediationAttempt(
                    attempt_number=attempt_no,
                    diagnostics=diagnostics,
                    patch=patch,
                    test_result=None,
                    status=AttemptStatus.FAILED_TO_APPLY,
                    duration_ms=duration_ms,
                )
                attempts.append(attempt)
                continue

            # Run test suite to verify patch
            if not self.sandbox_runner:
                raise ValueError("No SandboxRunner configured for test verification")

            test_result = self.sandbox_runner.run(self.test_command)
            duration_ms = int((time.time() - start_time) * 1000)

            if test_result.exit_code == 0:
                attempt = RemediationAttempt(
                    attempt_number=attempt_no,
                    diagnostics=diagnostics,
                    patch=patch,
                    test_result=test_result,
                    status=AttemptStatus.VERIFIED_SUCCESS,
                    duration_ms=duration_ms,
                )
                attempts.append(attempt)
                final_status = SessionFinalStatus.RESOLVED
                break
            else:
                attempt = RemediationAttempt(
                    attempt_number=attempt_no,
                    diagnostics=diagnostics,
                    patch=patch,
                    test_result=test_result,
                    status=AttemptStatus.VERIFIED_FAILURE,
                    duration_ms=duration_ms,
                )
                attempts.append(attempt)
                current_failure = test_result

        # Exhaustion handling: clean rollback if not resolved
        if final_status == SessionFinalStatus.EXHAUSTED:
            rolled_back = self.rollback_mgr.rollback()

        session = RemediationSession(
            session_id=session_id,
            repository_path=str(self.repo_root),
            test_command=self.test_command,
            initial_failure=initial_failure or current_failure,
            attempts=attempts,
            final_status=final_status,
            rolled_back=rolled_back,
            created_at=created_at,
            completed_at=datetime.now(UTC),
        )

        self._write_audit_log(session)
        return session

    def _write_audit_log(self, session: RemediationSession) -> None:
        """Export session audit log JSON if configured."""
        if not self.output_log_path:
            return

        self.output_log_path.parent.mkdir(parents=True, exist_ok=True)
        data = session.model_dump(mode="json")
        with open(self.output_log_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
