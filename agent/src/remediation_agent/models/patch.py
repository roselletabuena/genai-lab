"""Candidate patch domain models."""

from pydantic import BaseModel, ConfigDict, Field


class CandidatePatch(BaseModel):
    """Candidate code patch synthesized by the LLM."""

    model_config = ConfigDict(frozen=True)

    patch_id: str = Field(..., description="Unique identifier for the patch candidate")
    diff_text: str = Field(..., description="Raw unified diff text (diff -u format)")
    target_files: list[str] = Field(
        ..., min_length=1, description="Target repository files modified by diff"
    )
    is_applicable: bool = Field(default=False, description="True if patch passes dry-run check")
    apply_error: str | None = Field(
        None, description="Error message if patch failed application check"
    )
