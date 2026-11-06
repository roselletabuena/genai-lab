"""Cross-component contract tests ensuring Python and Go fixtures conform to feedback-report.schema.json (T043)."""

import json
from pathlib import Path

import jsonschema
import pytest

from remediation_agent.models.session import RemediationSession
from remediation_agent.reporting.builder import build_feedback_report
from remediation_agent.reporting.models import parse_report

REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = (
    REPO_ROOT
    / "specs"
    / "003-pr-feedback-comments"
    / "contracts"
    / "feedback-report.schema.json"
)
GO_FIXTURES = REPO_ROOT / "sandbox-runner" / "testdata" / "feedback"
PY_FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "feedback"


@pytest.fixture(scope="module")
def schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    "fixture_name",
    ["verified_fix_report.json", "suggestion_report.json", "failed_report.json"],
)
def test_go_fixtures_validate_against_schema_and_python_models(
    fixture_name: str, schema: dict
) -> None:
    raw = (GO_FIXTURES / fixture_name).read_text(encoding="utf-8")
    instance = json.loads(raw)
    jsonschema.validate(instance=instance, schema=schema)
    parsed = parse_report(raw)
    assert parsed.schema_version == "1.0"


@pytest.mark.parametrize(
    "session_fixture",
    [
        "resolved_session.json",
        "resolved_multifile_session.json",
        "exhausted_session.json",
        "secrets_session.json",
    ],
)
def test_python_generated_reports_validate_against_schema(
    session_fixture: str, schema: dict
) -> None:
    session_data = json.loads((PY_FIXTURES / session_fixture).read_text(encoding="utf-8"))
    session = RemediationSession(**session_data)
    report = build_feedback_report(
        session,
        job_id="job-contract",
        pr_changed_lines={"src/math_utils.py": [[1, 30]]},
    )
    payload = json.loads(report.model_dump_json())
    jsonschema.validate(instance=payload, schema=schema)
