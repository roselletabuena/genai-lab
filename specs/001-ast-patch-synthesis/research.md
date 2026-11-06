# Phase 0 Research: Tree-sitter AST Diagnostic and Patch Synthesis Loop

**Feature**: `001-ast-patch-synthesis`  
**Date**: 2026-11-06  
**Status**: Completed  

---

## Research Topics & Architectural Decisions

### 1. Python Packaging, Dependency Management & Tooling

- **Decision**: Standard PEP 621 declarative `pyproject.toml` using `hatchling` as the build backend, `ruff` for linting and formatting, and `pytest` with `pytest-cov` for testing.
- **Rationale**: 
  - `hatchling` is lightweight, standardized (PEP 517/518/621), and requires no proprietary CLI installations (unlike Poetry or Pipenv).
  - Modern virtual environment (`python -m venv .venv`) and `pip install -e "agent/[dev]"` work deterministically across Windows, Linux, and macOS.
  - `ruff` replaces Black, Flake8, and isort with sub-second execution speeds, aligning with the monorepo's strict fast-feedback verification gates.
- **Alternatives Considered**:
  - *Poetry*: Rejected due to heavy external installer requirements and occasional lockfile conflicts in cross-platform monorepos.
  - *Setuptools with setup.py*: Rejected in favor of modern declarative `pyproject.toml` standard.

### 2. Tree-sitter AST Parsing & Enclosing Scope Extraction

- **Decision**: Use `tree-sitter>=0.23.0` alongside official PyPI language grammar wheels (`tree-sitter-python`, `tree-sitter-typescript`, `tree-sitter-go`).
- **Rationale**:
  - Modern Tree-sitter provides precompiled wheels for each language grammar on all major platforms (Windows/x64, Linux/x64, macOS/arm64).
  - Clean C-binding API allows fast AST traversal: pinpointing point coordinates `(line, column)`, querying parent nodes for enclosing scopes (`function_definition`, `class_definition`, `method_definition`), and collecting top-level import declarations (`import_statement`, `import_from_statement`).
- **Scope Extraction Algorithm**:
  1. Parse source code into AST with the target language parser.
  2. Map 1-based failure line number to Tree-sitter point `(line - 1, 0)`.
  3. Query `root_node.descendant_for_point_range(point, point)`.
  4. Traverse upwards (`node.parent`) to find the smallest enclosing function, method, or class declaration.
  5. Collect all top-level import/require nodes from `root_node`.
  6. Return isolated code snippet with surrounding line range and signature.
- **Alternatives Considered**:
  - *`tree-sitter-languages`*: Rejected because it is an unmaintained monolithic wrapper that lags behind upstream grammar releases and fails on Python 3.12+ Windows wheels.
  - *Language-specific ASTs (`ast` for Python, `ts-morph` for TS)*: Rejected because Tree-sitter provides a single uniform query API across all repository languages.

### 3. LLM Integration & Unified Diff Synthesis via AWS Bedrock

- **Decision**: AWS Bedrock Runtime (`boto3`) using the `Converse` API targeting Anthropic Claude 3.5 Sonnet (`anthropic.claude-3-5-sonnet-20241022-v2:0`) with fallback to Claude 3 Haiku. For local and CI testing, implement an abstract `LLMProvider` protocol backed by a deterministic `MockBedrockClient`.
- **Rationale**:
  - The repository's backend already uses AWS Bedrock and AWS SAM; utilizing Bedrock maintains architectural alignment.
  - The `Converse` API provides structured multi-turn conversation support and token count metrics.
  - The `MockBedrockClient` ensures 100% test coverage and compliance with Constitution Principle I & V (zero live cloud credentials required for unit/integration suites).
- **Patch Format Strategy**:
  - The LLM is instructed via system prompt to output strictly valid unified diff syntax wrapped in ````diff` blocks:
    ```diff
    --- a/path/to/file.ext
    +++ b/path/to/file.ext
    @@ -start,length +start,length @@
    - failing code
    + repaired code
    ```
  - Pydantic validator verifies diff headers, hunk markers (`@@`), and target file paths before application.
- **Alternatives Considered**:
  - *Direct Bedrock InvokeModel API*: Rejected in favor of the newer, standardized `Converse` API.
  - *Search/Replace blocks*: Rejected per user clarification; unified diff is standard git format.

### 4. Patch Application & Atomic Workspace Rollback

- **Decision**: Use `git apply --unidiff-zero` via subprocess with fallback to `patch -p1`. On third consecutive failure or critical error, execute `git reset --hard` and `git clean -fd` to cleanly rollback uncommitted changes.
- **Rationale**:
  - `git apply` performs atomic in-memory validation before touching files; `--check` verifies applicability without modifying working tree.
  - Clean rollback guarantees zero repo contamination, fulfilling Constitution Principle II and user specification decision 3.A.
- **Alternatives Considered**:
  - *Pure Python diff applicator (e.g. `patch-ng`)*: Can be maintained as a secondary fallback if `git` is absent, but git is guaranteed in this monorepo.

### 5. Integration with GL-53 Sandbox Runner

- **Decision**: `SubprocessSandboxRunner` wraps `sandbox-runner` CLI located at `sandbox-runner/cmd/sandbox-runner` (or installed binary).
- **Input/Output**:
  - Invokes: `sandbox-runner -repo <workspace> -cmd "<test_cmd>" -json`
  - Ingests: JSON envelope conforming to `sandbox.RunResult` (`exit_code`, `stdout`, `stderr`, `duration_ms`, `timed_out`, `error`).
- **Rationale**: Direct, decoupled CLI IPC matching GL-53 specification and user clarification decision 1.A.

