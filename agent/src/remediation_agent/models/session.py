"""Session and attempt tracking domain models."""

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from remediation_agent.models.diagnostics import SandboxRunResult, TestFailureDiagnostic
from remediation_agent.models.patch import CandidatePatch


class AttemptStatus(StrEnum):
    """Execution status of an individual attempt."""

    PENDING = "PENDING"
    DIAGNOSED = "DIAGNOSED"
    SYNTHESIZED = "SYNTHESIZED"
    APPLIED = "APPLIED"
    VERIFIED_SUCCESS = "VERIFIED_SUCCESS"
    VERIFIED_FAILURE = "VERIFIED_FAILURE"
    FAILED_TO_APPLY = "FAILED_TO_APPLY"


class SessionFinalStatus(StrEnum):
    """Final outcome state of a remediation session."""

    RESOLVED = "RESOLVED"
    EXHAUSTED = "EXHAUSTED"
    ERROR = "ERROR"


class RemediationAttempt(BaseModel):
    """An individual remediation attempt cycle."""

    model_config = ConfigDict(frozen=True)

    attempt_number: int = Field(..., ge=1, le=3, description="1-based attempt index (max 3)")
    diagnostics: list[TestFailureDiagnostic] = Field(default_factory=list)
    patch: CandidatePatch | None = None
    test_result: SandboxRunResult | None = None
    status: AttemptStatus = Field(default=AttemptStatus.PENDING)
    duration_ms: int = Field(default=0, ge=0)


class RemediationSession(BaseModel):
    """Audit log of complete remediation session."""

    model_config = ConfigDict(frozen=True)

    session_id: str = Field(..., description="Unique UUID for this session")
    repository_path: str = Field(..., description="Root repository path")
    test_command: str = Field(..., description="Test command executed")
    initial_failure: SandboxRunResult = Field(..., description="Initial test failure envelope")
    attempts: list[RemediationAttempt] = Field(default_factory=list, max_length=3)
    final_status: SessionFinalStatus = Field(...)
    rolled_back: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None
