"""Diagnostic and test runner result domain models."""

from pydantic import BaseModel, ConfigDict, Field


class TestFailureDiagnostic(BaseModel):
    """Extracted test assertion failure diagnostic."""

    # Prevent pytest from treating this model as a test case
    __test__ = False

    model_config = ConfigDict(frozen=True)

    file_path: str = Field(..., description="Repository-relative path to the failing file")
    line_number: int = Field(
        ..., ge=1, description="1-based line number where the failure occurred"
    )
    error_type: str = Field(..., description="Error class or identifier (e.g. AssertionError)")
    message: str = Field(..., description="Extracted error assertion text or stack trace summary")
    test_name: str | None = Field(None, description="Name of the failing test case or suite")


class SandboxRunResult(BaseModel):
    """Structured JSON envelope returned by the Go Docker test runner (GL-53)."""

    model_config = ConfigDict(frozen=True)

    exit_code: int = Field(..., description="Process exit code")
    stdout: str = Field(default="", description="Captured standard output")
    stderr: str = Field(default="", description="Captured standard error")
    duration_ms: int = Field(..., ge=0, description="Execution duration in milliseconds")
    timed_out: bool = Field(default=False, description="Whether execution exceeded timeout")
    error: str | None = Field(None, description="Runner error message if execution failed")
    container_id: str | None = Field(None, description="ID of container used")
