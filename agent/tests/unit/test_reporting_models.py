"""Unit tests for feedback report models and schema contract (T005)."""

import json
from pathlib import Path

import jsonschema
import pytest
from pydantic import ValidationError

from remediation_agent.reporting.models import (
    MARKER_PREFIX,
    AttemptOutcome,
    AttemptSummary,
    FailedReport,
    NoChangeReport,
    SuggestionSpec,
    VerifiedDiff,
    VerifiedFixReport,
    parse_report,
)

SCHEMA_PATH = (
    Path(__file__).resolve().parents[3]
    / "specs"
    / "003-pr-feedback-comments"
    / "contracts"
    / "feedback-report.schema.json"
)


@pytest.fixture(scope="module")
def report_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def _marker(job_id: str = "job-1") -> str:
    return f"{MARKER_PREFIX} run={job_id} -->\n## body\n"


def test_verified_fix_validates_and_matches_schema(report_schema: dict) -> None:
    report = VerifiedFixReport(
        job_id="job-1",
        session_id="sess-1",
        diagnosis="AssertionError in src/math_utils.py:8",
        duration_ms=12400,
        attempts=[
            AttemptSummary(
                attempt_number=1,
                outcome=AttemptOutcome.VERIFIED_FAILURE,
                failure_reason="tests failed",
                duration_ms=5100,
            ),
            AttemptSummary(
                attempt_number=2,
                outcome=AttemptOutcome.VERIFIED_SUCCESS,
                duration_ms=7300,
            ),
        ],
        diff=VerifiedDiff(
            unified_diff="--- a/src/math_utils.py\n+++ b/src/math_utils.py\n@@ -1 +1 @@\n-a-b\n+a+b\n",
            target_files=["src/math_utils.py"],
        ),
        test_log="3 passed in 0.12s",
        suggestion=SuggestionSpec(
            path="src/math_utils.py",
            start_line=8,
            line=8,
            replacement="    return a + b",
        ),
        markdown_body=_marker("job-1"),
    )
    payload = json.loads(report.model_dump_json())
    jsonschema.validate(instance=payload, schema=report_schema)
    parsed = parse_report(report.model_dump_json())
    assert isinstance(parsed, VerifiedFixReport)
    assert parsed.diff.target_files == ["src/math_utils.py"]


def test_failed_report_rejects_diff_suggestion_and_test_log(report_schema: dict) -> None:
    report = FailedReport(
        job_id="job-2",
        session_id="sess-2",
        diagnosis="ZeroDivisionError in src/math_utils.py:20",
        duration_ms=7500,
        attempts=[
            AttemptSummary(
                attempt_number=1,
                outcome=AttemptOutcome.VERIFIED_FAILURE,
                failure_reason="ZeroDivisionError",
                duration_ms=7500,
            )
        ],
        markdown_body=_marker("job-2"),
    )
    payload = json.loads(report.model_dump_json())
    jsonschema.validate(instance=payload, schema=report_schema)

    for forbidden_field, val in [
        ("diff", {"unified_diff": "x", "target_files": ["a.py"]}),
        ("suggestion", {"path": "a.py", "start_line": 1, "line": 1, "replacement": "x"}),
        ("test_log", "some log"),
    ]:
        bad = {**payload, forbidden_field: val}
        with pytest.raises(ValidationError):
            parse_report(bad)
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(instance=bad, schema=report_schema)


def test_verified_fix_requires_non_empty_target_files_and_verified_last_attempt() -> None:
    base = {
        "verdict": "verified_fix",
        "job_id": "job-1",
        "session_id": "sess-1",
        "diagnosis": "bug",
        "duration_ms": 100,
        "test_log": "ok",
        "markdown_body": _marker("job-1"),
    }
    with pytest.raises(ValidationError):
        parse_report(
            {
                **base,
                "attempts": [{"attempt_number": 1, "outcome": "verified_success", "duration_ms": 1}],
                "diff": {"unified_diff": "--- a/x\n+++ b/x\n", "target_files": []},
            }
        )
    with pytest.raises(ValidationError):
        parse_report(
            {
                **base,
                "attempts": [{"attempt_number": 1, "outcome": "verified_failure", "duration_ms": 1}],
                "diff": {"unified_diff": "--- a/x\n+++ b/x\n", "target_files": ["x.py"]},
            }
        )


def test_field_bounds_enforced() -> None:
    base = {
        "verdict": "failed",
        "job_id": "job-1",
        "session_id": "sess-1",
        "diagnosis": "d",
        "duration_ms": 10,
        "attempts": [{"attempt_number": 1, "outcome": "verified_failure", "duration_ms": 10}],
        "markdown_body": _marker("job-1"),
    }
    with pytest.raises(ValidationError):
        parse_report({**base, "diagnosis": ""})
    with pytest.raises(ValidationError):
        parse_report({**base, "diagnosis": "x" * 4001})
    with pytest.raises(ValidationError):
        parse_report({**base, "attempts": base["attempts"] * 4})
    with pytest.raises(ValidationError):
        parse_report(
            {
                **base,
                "attempts": [{"attempt_number": 4, "outcome": "verified_failure", "duration_ms": 1}],
            }
        )
    with pytest.raises(ValidationError):
        parse_report({**base, "markdown_body": _marker("job-1") + ("x" * 60000)})
    with pytest.raises(ValidationError):
        parse_report({**base, "markdown_body": "no marker here"})
    with pytest.raises(ValidationError):
        parse_report({**base, "markdown_body": _marker("job-1") + _marker("job-1")})


def test_no_change_report_validates(report_schema: dict) -> None:
    report = NoChangeReport(
        job_id="job-nc",
        session_id="sess-nc",
        diagnosis="All tests already pass",
        duration_ms=500,
        attempts=[
            AttemptSummary(
                attempt_number=1,
                outcome=AttemptOutcome.VERIFIED_SUCCESS,
                duration_ms=500,
            )
        ],
        test_log="1 passed",
        markdown_body=_marker("job-nc"),
    )
    payload = json.loads(report.model_dump_json())
    jsonschema.validate(instance=payload, schema=report_schema)
