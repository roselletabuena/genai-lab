# Implementation Plan: Tree-sitter AST Diagnostic and Patch Synthesis Loop

**Branch**: `feat/GL-54-ast-diagnostic-patch-loop` | **Date**: 2026-11-06 | **Spec**: [specs/001-ast-patch-synthesis/spec.md](spec.md)

**Input**: Feature specification from `/specs/001-ast-patch-synthesis/spec.md` (Jira [GL-54](https://the-three-devsketeers.atlassian.net/browse/GL-54))

---

## Summary

Build an autonomous remediation engine in Python (`agent/`) that ingests structured test failure JSON envelopes (emitted by the Go Docker sandbox runner from GL-53), parses failing source files using Tree-sitter to isolate minimal enclosing syntax scopes (functions, classes, imports), prompts AWS Bedrock for machine-applicable unified diffs, and orchestrates an iterative evaluation loop bounded to at most 3 attempts with deterministic workspace rollback upon failure.

---

## Technical Context

**Language/Version**: Python 3.12+ (PEP 621 compliant, `hatchling` build backend)

**Primary Dependencies**:
- `tree-sitter>=0.23.0` (Core AST parser)
- `tree-sitter-python`, `tree-sitter-typescript`, `tree-sitter-go` (Official language grammar wheels)
- `pydantic>=2.7.0` (Domain models, validation, and serialization)
- `boto3>=1.34.0` (AWS Bedrock Runtime Converse API)
- `ruff>=0.4.0` (Fast formatting and linting)

**Storage**: Local filesystem (source files, unified diff application, `remediation-audit.json` export)

**Testing**: `pytest>=8.0.0`, `pytest-cov`, `pytest-mock` (Unit tests, fixture-based AST tests, mock Bedrock integration tests)

**Target Platform**: Cross-platform (Windows x64, Linux x64, macOS arm64/x64)

**Project Type**: CLI tool & modular Python library (`agent/`)

**Performance Goals**:
- $<1\text{s}$ AST parsing and enclosing scope extraction per failing file
- $<30\text{s}$ end-to-end latency per diagnostic and patch generation cycle

**Constraints**:
- **Zero Live Cloud Credentials for CI/Tests**: Full unit and integration coverage backed by deterministic `MockBedrockClient`
- **Clean Workspace Rollback**: Automatically resets working tree to initial commit via `git reset --hard` if 3 attempts are exhausted
- **Unified Diff Standard**: Emits standard `diff -u` patches verifiable by `git apply --check`

**Scale/Scope**:
- Multi-language support: TypeScript/JavaScript, Python, and Go test suites
- Enclosed context window bounded to $\le 200$ source lines per failure site

---

## Constitution Check

*GATE: Verified before Phase 0 research and re-validated after Phase 1 design.*

| Principle | Requirement | Plan Compliance | Status |
| :--- | :--- | :--- | :---: |
| **I. TDD at Public Seams** | Red-green-refactor at public seams; mocks restricted to external boundary (Bedrock) | All tests written against public interfaces (`DiagnosticParser`, `ASTScopeExtractor`, `PatchSynthesizer`, `RemediationLoop`). `MockBedrockClient` mocks Bedrock at the protocol seam. | **PASS** |
| **II. Worktree Isolation** | Dedicated git worktree off `origin/main`; zero dirty working tree edits | Implementation will execute inside `.worktrees/feat-GL-54-ast-diagnostic-patch-loop` off `origin/main`. | **PASS** |
| **III. Strict Schema Validation** | Strong runtime schemas at entry boundaries | Pydantic v2 schemas defined in `data-model.md` validate runner envelopes, AST nodes, LLM diff outputs, and audit logs. | **PASS** |
| **IV. Atomic Commits** | Conventional commits labeled with Jira key (`[GL-54]`) | Single-purpose commits grouped by parser, AST extractor, Bedrock client, and orchestrator loop. | **PASS** |
| **V. Cloud & Local Parity** | Local execution without cloud credentials | Deterministic offline mode supported via `--mock-llm` flag and `MockBedrockClient`. | **PASS** |

*All architectural gates pass without unjustified violations.*

---

## Project Structure

### Documentation (this feature)

```text
specs/001-ast-patch-synthesis/
├── spec.md                     # Feature specification (User stories, FRs, SCs)
├── plan.md                     # Technical implementation plan
├── research.md                 # Phase 0 architectural & library decisions
├── data-model.md               # Phase 1 Pydantic domain models & state machine
├── quickstart.md               # Phase 1 runnable validation scenarios
├── checklists/
│   └── requirements.md         # Specification quality checklist
└── contracts/
    ├── sandbox-envelope.json   # Contract schema for GL-53 sandbox runner input
    ├── audit-log-schema.json   # Contract schema for session audit log output
    └── cli-contract.md         # Command-line interface and exit code specification
```

### Source Code Layout (`agent/`)

```text
agent/
├── pyproject.toml
├── README.md
├── src/
│   └── remediation_agent/
│       ├── __init__.py
│       ├── cli.py                     # CLI entry point (run, diagnose)
│       ├── models/                    # Pydantic v2 domain schemas
│       │   ├── __init__.py
│       │   ├── diagnostics.py         # TestFailureDiagnostic
│       │   ├── context.py             # CodeContextScope, EnclosingScope
│       │   ├── patch.py               # CandidatePatch
│       │   └── session.py             # RemediationSession, RemediationAttempt
│       ├── parsers/                   # Ingestion and syntax parsing
│       │   ├── __init__.py
│       │   ├── test_log_parser.py     # Parses sandbox JSON envelope & test traces
│       │   └── ast_extractor.py       # Tree-sitter AST scope query engine
│       ├── llm/                       # Generative patch synthesis
│       │   ├── __init__.py
│       │   ├── client_protocol.py     # Abstract LLMProvider interface
│       │   ├── bedrock_client.py      # Boto3 Bedrock Converse client
│       │   ├── mock_client.py         # Deterministic offline mock provider
│       │   └── prompts.py             # System & contextual repair prompts
│       ├── patcher/                   # Patch validation & application
│       │   ├── __init__.py
│       │   └── diff_applier.py        # git apply / patch execution & rollback
│       └── orchestrator/              # Multi-attempt remediation state machine
│           ├── __init__.py
│           └── loop.py                # RemediationLoop orchestration engine
└── tests/
    ├── __init__.py
    ├── conftest.py                    # Pytest fixtures and sample payloads
    ├── fixtures/
    │   ├── sample_failure_envelope.json
    │   ├── sample_target.py
    │   └── sample_diff.patch
    ├── unit/
    │   ├── test_models.py             # Pydantic schema validation tests
    │   ├── test_test_log_parser.py    # Log parsing & failure extraction tests
    │   ├── test_ast_extractor.py      # Tree-sitter AST scope tests
    │   ├── test_diff_applier.py       # Patch application & git rollback tests
    │   └── test_bedrock_client.py     # Bedrock & mock LLM tests
    └── integration/
        └── test_remediation_loop.py   # Multi-attempt loop & exhaustion tests
```

---

## Complexity Tracking

| Aspect | Justification | Simpler Alternative Rejected Because |
| :--- | :--- | :--- |
| **Tree-sitter Language Wheels** | Separate packages per language (`tree-sitter-typescript`, etc.) | Monolithic `tree-sitter-languages` is unmaintained and fails to build on Python 3.12+ Windows |
| **Abstract LLM Protocol** | Decouples Bedrock from loop via `LLMProvider` | Direct `boto3` calls inside orchestrator would break offline testing and violate Constitution Principle V |
| **Subprocess Git Apply** | Uses native `git apply` rather than pure-Python regex patcher | Guarantees 100% fidelity with git index and provides atomic pre-application checking (`--check`) |
