"""Golden and structural tests for Markdown comment rendering (T011, T024)."""

import json
from pathlib import Path

from remediation_agent.models.session import RemediationSession
from remediation_agent.reporting.builder import build_feedback_report
from remediation_agent.reporting.models import MARKER_PREFIX

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "feedback"


def _load_session(name: str) -> RemediationSession:
    return RemediationSession(**json.loads((FIXTURES / name).read_text(encoding="utf-8")))


def test_render_verified_single_file_with_suggestion() -> None:
    session = _load_session("resolved_session.json")
    report = build_feedback_report(
        session,
        job_id="abc123",
        pr_changed_lines={"src/math_utils.py": [[5, 12]]},
    )
    body = report.markdown_body
    lines = body.splitlines()
    assert lines[0] == "<!-- remediation-agent:pr-feedback run=abc123 -->"
    assert body.count(MARKER_PREFIX) == 1
    assert "## ✅ Automated fix verified" in body
    assert "**Root cause**: AssertionError in `src/math_utils.py:8`: assert -1 == 5" in body
    assert "A one-click suggestion with this change is attached to `src/math_utils.py`" in body
    assert "<details><summary>Unified diff (1 file)</summary>" in body
    assert "```diff" in body
    assert "+    return a + b" in body
    assert "Sandbox tests passed in **12.4s** (attempt 2 of 3)" in body
    assert "3 passed in 0.12s" in body


def test_render_verified_multifile_with_commit_url() -> None:
    session = _load_session("resolved_multifile_session.json")
    report = build_feedback_report(
        session,
        job_id="mf-42",
        commit_url="https://github.com/org/repo/commit/abc999",
    )
    body = report.markdown_body
    assert lines_first(body) == "<!-- remediation-agent:pr-feedback run=mf-42 -->"
    assert "<details><summary>Unified diff (2 files)</summary>" in body
    assert "[View commit](https://github.com/org/repo/commit/abc999)" in body
    assert "one-click suggestion" not in body
    assert "Sandbox tests passed in **4.2s** (attempt 1 of 3)" in body


def test_render_failed_comment_has_attempt_table_and_zero_code_proposals() -> None:
    session = _load_session("exhausted_session.json")
    report = build_feedback_report(session, job_id="fail-7")
    body = report.markdown_body
    assert lines_first(body) == "<!-- remediation-agent:pr-feedback run=fail-7 -->"
    assert "## ❌ Automated remediation could not verify a fix" in body
    assert "| Attempt | Result | Reason |" in body
    assert "| 1 | Tests failed |" in body
    assert "| 2 | Patch did not apply | patch does not apply at line 99 |" in body
    assert "| 3 | Tests failed |" in body
    assert "No change is proposed. Please fix this manually." in body
    assert "```diff" not in body
    assert "```suggestion" not in body
    assert "View commit" not in body


def lines_first(text: str) -> str:
    return text.splitlines()[0]
