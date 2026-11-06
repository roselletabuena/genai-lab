"""Feedback report contract shared with the Go supervisor (schema v1.0)."""

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator

MARKER_PREFIX = "<!-- remediation-agent:pr-feedback"
MAX_BODY_CHARS = 60_000
SCHEMA_VERSION = "1.0"


class AttemptOutcome(StrEnum):
    """Outcome of one remediation attempt."""

    VERIFIED_SUCCESS = "verified_success"
    VERIFIED_FAILURE = "verified_failure"
    FAILED_TO_APPLY = "failed_to_apply"


class AttemptSummary(BaseModel):
    """One remediation attempt with its outcome and failure reason."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    attempt_number: int = Field(..., ge=1, le=3)
    outcome: AttemptOutcome
    failure_reason: str | None = None
    duration_ms: int = Field(..., ge=0)


class VerifiedDiff(BaseModel):
    """Unified diff that passed sandbox verification."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    unified_diff: str = Field(..., min_length=1)
    target_files: list[str] = Field(..., min_length=1)
    commit_url: str | None = None


class SuggestionSpec(BaseModel):
    """Single-file replacement eligible for a one-click suggestion block."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    path: str
    start_line: int = Field(..., ge=1)
    line: int = Field(..., ge=1)
    replacement: str


class _ReportBase(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    schema_version: Literal["1.0"] = SCHEMA_VERSION
    job_id: str = Field(..., min_length=1)
    session_id: str = Field(..., min_length=1)
    diagnosis: str = Field(..., min_length=1, max_length=4000)
    duration_ms: int = Field(..., ge=0)
    attempts: list[AttemptSummary] = Field(default_factory=list, max_length=3)
    markdown_body: str = Field(..., max_length=MAX_BODY_CHARS)

    @model_validator(mode="after")
    def _marker_exactly_once(self) -> "_ReportBase":
        if self.markdown_body.count(MARKER_PREFIX) != 1:
            raise ValueError("markdown_body must contain the feedback marker exactly once")
        return self


class VerifiedFixReport(_ReportBase):
    """A fix verified by a passing sandbox run."""

    verdict: Literal["verified_fix"] = "verified_fix"
    diff: VerifiedDiff
    test_log: str
    suggestion: SuggestionSpec | None = None

    @model_validator(mode="after")
    def _last_attempt_verified(self) -> "VerifiedFixReport":
        if not self.attempts or self.attempts[-1].outcome != AttemptOutcome.VERIFIED_SUCCESS:
            raise ValueError("verified_fix requires the final attempt to be verified_success")
        return self


class NoChangeReport(_ReportBase):
    """Tests pass without any code change; nothing to propose."""

    verdict: Literal["no_change_needed"] = "no_change_needed"
    test_log: str


class FailedReport(_ReportBase):
    """No verified fix. Deliberately has no diff, suggestion, or test log fields."""

    verdict: Literal["failed"] = "failed"


FeedbackReport = Annotated[
    VerifiedFixReport | NoChangeReport | FailedReport, Field(discriminator="verdict")
]

_ADAPTER: TypeAdapter[FeedbackReport] = TypeAdapter(FeedbackReport)


def parse_report(data: str | bytes | dict) -> VerifiedFixReport | NoChangeReport | FailedReport:
    """Validate raw JSON (or a dict) into a typed report."""
    if isinstance(data, dict):
        return _ADAPTER.validate_python(data)
    return _ADAPTER.validate_json(data)
