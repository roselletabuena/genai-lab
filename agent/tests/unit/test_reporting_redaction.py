"""Unit tests for secret redaction in PR feedback reports (T010a, FR-009)."""

import json
from pathlib import Path

from remediation_agent.models.session import RemediationSession
from remediation_agent.reporting.builder import build_feedback_report
from remediation_agent.reporting.redaction import REDACTED, redact

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "feedback"


def test_redact_patterns() -> None:
    raw = (
        "token ghp_1234567890abcdefghijklmnopqrstuvwx and "
        "github_pat_11AABBCCDDEEFF00112233445566778899aabbccddeeff and "
        "key AKIAIOSFODNN7EXAMPLE and "
        "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig\n"
        "API_TOKEN=topsecretvalue\n"
        "export DB_PASSWORD = another-secret\n"
        "MY_SECRET_KEY: value-here\n"
        "normal_line = keep_me"
    )
    scrubbed = redact(raw)
    assert "ghp_" not in scrubbed
    assert "github_pat_" not in scrubbed
    assert "AKIAIOSFODNN7EXAMPLE" not in scrubbed
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in scrubbed
    assert "topsecretvalue" not in scrubbed
    assert "another-secret" not in scrubbed
    assert "value-here" not in scrubbed
    assert "normal_line = keep_me" in scrubbed
    assert REDACTED in scrubbed


def test_secrets_session_redacted_across_all_fields() -> None:
    session_data = json.loads((FIXTURES / "secrets_session.json").read_text(encoding="utf-8"))
    session = RemediationSession(**session_data)
    report = build_feedback_report(session, job_id="job-sec-1")

    serialized = report.model_dump_json()
    for leaked in [
        "ghp_1234567890abcdefghijklmnopqrstuvwx",
        "github_pat_11AABBCCDDEEFF00112233445566778899aabbccddeeff",
        "AKIAIOSFODNN7EXAMPLE",
        "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret",
        "super-secret-value-123",
    ]:
        assert leaked not in serialized, f"leaked secret found: {leaked}"
    assert REDACTED in report.diagnosis
    assert REDACTED in report.markdown_body
