"""Pull request feedback reporting: session results rendered as GitHub comments."""

from remediation_agent.reporting.builder import build_feedback_report
from remediation_agent.reporting.models import (
    MARKER_PREFIX,
    AttemptOutcome,
    AttemptSummary,
    FailedReport,
    FeedbackReport,
    NoChangeReport,
    SuggestionSpec,
    VerifiedDiff,
    VerifiedFixReport,
    parse_report,
)
from remediation_agent.reporting.redaction import redact
from remediation_agent.reporting.renderer import render_comment
from remediation_agent.reporting.truncation import truncate_log

__all__ = [
    "MARKER_PREFIX",
    "AttemptOutcome",
    "AttemptSummary",
    "FailedReport",
    "FeedbackReport",
    "NoChangeReport",
    "SuggestionSpec",
    "VerifiedDiff",
    "VerifiedFixReport",
    "build_feedback_report",
    "parse_report",
    "redact",
    "render_comment",
    "truncate_log",
]
