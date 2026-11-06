"""Unit tests for building FeedbackReport from RemediationSession (T012, T025, T035)."""

import json
from pathlib import Path

from remediation_agent.models.diagnostics import SandboxRunResult
from remediation_agent.models.patch import CandidatePatch
from remediation_agent.models.session import (
    AttemptStatus,
    RemediationAttempt,
    RemediationSession,
    SessionFinalStatus,
)
from remediation_agent.reporting.builder import build_feedback_report
from remediation_agent.reporting.models import (
    AttemptOutcome,
    FailedReport,
    NoChangeReport,
    VerifiedFixReport,
)

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "feedback"


def _load_session(name: str) -> RemediationSession:
    data = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return RemediationSession(**data)


def test_build_verified_fix_with_eligible_suggestion() -> None:
    session = _load_session("resolved_session.json")
    report = build_feedback_report(
        session,
        job_id="job-101",
        pr_changed_lines={"src/math_utils.py": [[5, 12]]},
    )
    assert isinstance(report, VerifiedFixReport)
    assert report.verdict == "verified_fix"
    assert report.duration_ms == 12400
    assert len(report.attempts) == 2
    assert report.attempts[0].outcome == AttemptOutcome.VERIFIED_FAILURE
    assert report.attempts[1].outcome == AttemptOutcome.VERIFIED_SUCCESS
    assert report.suggestion is not None
    assert report.suggestion.path == "src/math_utils.py"
    assert report.suggestion.start_line == 8
    assert report.suggestion.line == 8
    assert report.suggestion.replacement == "    return a + b"


def test_build_verified_fix_drops_suggestion_when_out_of_pr_range_or_multifile() -> None:
    session = _load_session("resolved_session.json")
    out_of_range = build_feedback_report(
        session,
        job_id="job-102",
        pr_changed_lines={"src/math_utils.py": [[1, 3]]},
    )
    assert isinstance(out_of_range, VerifiedFixReport)
    assert out_of_range.suggestion is None

    multifile = _load_session("resolved_multifile_session.json")
    mf_report = build_feedback_report(
        multifile,
        job_id="job-103",
        commit_url="https://github.com/org/repo/commit/deadbeef",
        pr_changed_lines={"src/service.py": [[1, 50]], "src/helper.py": [[1, 50]]},
    )
    assert isinstance(mf_report, VerifiedFixReport)
    assert mf_report.suggestion is None
    assert mf_report.diff.commit_url == "https://github.com/org/repo/commit/deadbeef"
    assert "View commit" in mf_report.markdown_body


def test_build_failed_report_from_exhausted_session_excludes_diff() -> None:
    session = _load_session("exhausted_session.json")
    report = build_feedback_report(session, job_id="job-200")
    assert isinstance(report, FailedReport)
    assert report.verdict == "failed"
    assert report.duration_ms == 7500
    assert len(report.attempts) == 3
    assert report.attempts[0].outcome == AttemptOutcome.VERIFIED_FAILURE
    assert "ZeroDivisionError" in (report.attempts[0].failure_reason or "")
    assert report.attempts[1].outcome == AttemptOutcome.FAILED_TO_APPLY
    assert "patch does not apply at line 99" in (report.attempts[1].failure_reason or "")
    assert report.attempts[2].outcome == AttemptOutcome.VERIFIED_FAILURE
    # Never leaks candidate patch text into the report or rendered body.
    assert "return a // b" not in report.markdown_body
    assert "return 0" not in report.markdown_body
    assert "```diff" not in report.markdown_body
    assert "```suggestion" not in report.markdown_body


def test_build_failed_report_from_error_session() -> None:
    session = RemediationSession(
        session_id="sess-err",
        repository_path="/workspace/repo",
        test_command="pytest",
        initial_failure=SandboxRunResult(
            exit_code=2, stdout="", stderr="collection error", duration_ms=300
        ),
        attempts=[],
        final_status=SessionFinalStatus.ERROR,
    )
    report = build_feedback_report(session, job_id="job-err")
    assert isinstance(report, FailedReport)
    assert "internal error" in report.diagnosis.lower()
    assert "No change is proposed" in report.markdown_body


def test_build_no_change_needed_when_verified_diff_is_empty() -> None:
    session = RemediationSession(
        session_id="sess-empty",
        repository_path="/workspace/repo",
        test_command="pytest",
        initial_failure=SandboxRunResult(exit_code=1, stdout="flaky", duration_ms=100),
        attempts=[
            RemediationAttempt(
                attempt_number=1,
                patch=CandidatePatch(
                    patch_id="p-empty",
                    diff_text="   \n",
                    target_files=["src/a.py"],
                    is_applicable=True,
                ),
                test_result=SandboxRunResult(
                    exit_code=0, stdout="1 passed", duration_ms=400
                ),
                status=AttemptStatus.VERIFIED_SUCCESS,
                duration_ms=400,
            )
        ],
        final_status=SessionFinalStatus.RESOLVED,
    )
    report = build_feedback_report(session, job_id="job-empty")
    assert isinstance(report, NoChangeReport)
    assert report.verdict == "no_change_needed"
    assert "No change needed" in report.markdown_body
    assert "```diff" not in report.markdown_body
