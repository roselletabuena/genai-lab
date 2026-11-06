"""AST context and enclosing scope domain models."""

from pydantic import BaseModel, ConfigDict, Field


class EnclosingScope(BaseModel):
    """Enclosing AST structural scope (function, method, class)."""

    model_config = ConfigDict(frozen=True)

    scope_type: str = Field(..., description="AST node type (e.g. function_definition)")
    name: str = Field(..., description="Name of the enclosing construct")
    start_line: int = Field(..., ge=1, description="1-based start line")
    end_line: int = Field(..., ge=1, description="1-based end line")
    code: str = Field(..., description="Source code text of the enclosing scope")


class CodeContextScope(BaseModel):
    """Isolated structural code context surrounding a failure point."""

    model_config = ConfigDict(frozen=True)

    file_path: str = Field(..., description="Repository-relative path of the analyzed file")
    imports: list[str] = Field(default_factory=list, description="Top-level import declarations")
    enclosing_scopes: list[EnclosingScope] = Field(
        default_factory=list, description="Hierarchical enclosing scopes around failure point"
    )
    surrounding_code: str = Field(
        ..., description="Bounded code window formatted for prompt inclusion"
    )
