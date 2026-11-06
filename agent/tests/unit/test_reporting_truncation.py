"""Unit tests for head/tail log budgeting (T013, FR-008)."""

import pytest

from remediation_agent.reporting.models import (
    MAX_BODY_CHARS,
    AttemptOutcome,
    AttemptSummary,
    VerifiedDiff,
    VerifiedFixReport,
)
from remediation_agent.reporting.renderer import marker_line, render_comment
from remediation_agent.reporting.truncation import truncate_log


def test_truncate_log_keeps_short_input_intact() -> None:
    text = "line 1\nline 2\nline 3"
    assert truncate_log(text, budget=1000) == text


def test_truncate_log_keeps_40_60_head_tail_with_marker() -> None:
    lines = [f"line-{i:04d}: " + ("x" * 40) for i in range(200)]
    text = "\n".join(lines)
    out = truncate_log(text, budget=1000)
    assert "line-0000:" in out
    assert "line-0199:" in out
    assert "lines truncated" in out
    # Tail (60%) holds more lines than head (40%).
    before_marker, after_marker = out.split("lines truncated")
    assert len(after_marker) > len(before_marker)


def test_truncate_log_rejects_negative_budget() -> None:
    with pytest.raises(ValueError):
        truncate_log("abc", budget=-1)


def test_render_comment_respects_60k_limit_and_preserves_diagnosis_and_duration() -> None:
    huge_log = "\n".join(f"log line {i}: " + ("y" * 80) for i in range(2000))
    huge_diff = "--- a/f.py\n+++ b/f.py\n@@ -1,1 +1,1 @@\n" + "\n".join(
        f"+added line {i} " + ("z" * 60) for i in range(1200)
    )
    diagnosis = "AssertionError in `f.py:10`: critical root cause message"
    report = VerifiedFixReport(
        job_id="job-big",
        session_id="sess-big",
        diagnosis=diagnosis,
        duration_ms=15300,
        attempts=[
            AttemptSummary(
                attempt_number=1,
                outcome=AttemptOutcome.VERIFIED_SUCCESS,
                duration_ms=15300,
            )
        ],
        diff=VerifiedDiff(
            unified_diff=huge_diff,
            target_files=["f.py"],
            commit_url="https://github.com/org/repo/commit/abc123",
        ),
        test_log=huge_log,
        markdown_body=marker_line("job-big"),
    )
    body = render_comment(report)
    assert len(body) <= MAX_BODY_CHARS
    assert diagnosis in body
    assert "15.3s" in body
    assert "Automated fix verified" in body
    assert "https://github.com/org/repo/commit/abc123" in body
