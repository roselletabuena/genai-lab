"""Unit tests for domain models."""

import pytest
from pydantic import ValidationError

from remediation_agent.models import (
    AttemptStatus,
    CandidatePatch,
    CodeContextScope,
    EnclosingScope,
    RemediationAttempt,
    RemediationSession,
    SandboxRunResult,
    SessionFinalStatus,
    TestFailureDiagnostic,
)


def test_test_failure_diagnostic_valid():
    diag = TestFailureDiagnostic(
        file_path="src/calc.py",
        line_number=10,
        error_type="AssertionError",
        message="expected 5, got 3",
        test_name="test_calc",
    )
    assert diag.file_path == "src/calc.py"
    assert diag.line_number == 10
    assert diag.error_type == "AssertionError"


def test_test_failure_diagnostic_invalid_line():
    with pytest.raises(ValidationError):
        TestFailureDiagnostic(
            file_path="src/calc.py",
            line_number=0,  # Invalid: line number must be >= 1
            error_type="AssertionError",
            message="err",
        )


def test_sandbox_run_result():
    res = SandboxRunResult(
        exit_code=1,
        stdout="FAIL test.py",
        stderr="",
        duration_ms=450,
        timed_out=False,
    )
    assert res.exit_code == 1
    assert res.duration_ms == 450
    assert not res.timed_out


def test_enclosing_scope_and_context():
    scope = EnclosingScope(
        scope_type="function_definition",
        name="calculate",
        start_line=5,
        end_line=15,
        code="def calculate(): pass",
    )
    context = CodeContextScope(
        file_path="src/calc.py",
        imports=["import math"],
        enclosing_scopes=[scope],
        surrounding_code="def calculate(): pass",
    )
    assert len(context.enclosing_scopes) == 1
    assert context.imports == ["import math"]


def test_candidate_patch_requires_target_files():
    with pytest.raises(ValidationError):
        CandidatePatch(
            patch_id="patch-1",
            diff_text="--- a\n+++ b",
            target_files=[],  # Invalid: min_length=1
        )

    valid_patch = CandidatePatch(
        patch_id="patch-1",
        diff_text="--- a/calc.py\n+++ b/calc.py",
        target_files=["calc.py"],
        is_applicable=True,
    )
    assert valid_patch.is_applicable


def test_remediation_attempt_bounds():
    diag = TestFailureDiagnostic(file_path="a.py", line_number=1, error_type="E", message="msg")
    # Valid attempt numbers: 1..3
    attempt = RemediationAttempt(
        attempt_number=1,
        diagnostics=[diag],
        status=AttemptStatus.DIAGNOSED,
    )
    assert attempt.attempt_number == 1

    with pytest.raises(ValidationError):
        RemediationAttempt(attempt_number=0)

    with pytest.raises(ValidationError):
        RemediationAttempt(attempt_number=4)


def test_remediation_session_serializes():
    initial_fail = SandboxRunResult(
        exit_code=1,
        stdout="failed",
        stderr="",
        duration_ms=100,
    )
    session = RemediationSession(
        session_id="test-session-123",
        repository_path=".",
        test_command="npm test",
        initial_failure=initial_fail,
        final_status=SessionFinalStatus.RESOLVED,
        rolled_back=False,
    )
    data = session.model_dump()
    assert data["session_id"] == "test-session-123"
    assert data["final_status"] == "RESOLVED"
