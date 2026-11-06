# Tasks: Tree-sitter AST Diagnostic and Patch Synthesis Loop

**Input**: Design documents from `/specs/001-ast-patch-synthesis/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`  
**Tests**: Follows Constitution Principle I (TDD at public seams: write failing tests first before implementation).  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Python package initialization, dependency specifications, and shared development tooling.

- [X] T001 Create project directory structure for Python agent in agent/src/remediation_agent and agent/tests
- [X] T002 Initialize Python package with declarative configuration in agent/pyproject.toml specifying hatchling backend and dependencies (tree-sitter>=0.23.0, tree-sitter-python, tree-sitter-typescript, tree-sitter-go, pydantic>=2.7.0, boto3>=1.34.0, ruff>=0.4.0, pytest>=8.0.0, pytest-cov, pytest-mock)
- [X] T003 [P] Configure ruff linting, formatting, and target Python 3.12 settings in agent/pyproject.toml
- [X] T004 [P] Create pytest configuration and shared test fixtures in agent/tests/conftest.py

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data schemas, contracts, and test fixtures that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this foundational phase is complete.

- [X] T005 [P] Create mock test failure JSON fixture in agent/tests/fixtures/sample_failure_envelope.json matching contracts/sandbox-envelope.json
- [X] T006 [P] Create multi-language code targets in agent/tests/fixtures/sample_target.py, agent/tests/fixtures/sample_target.ts, and sample unified diff in agent/tests/fixtures/sample_diff.patch
- [X] T007 [P] Implement Pydantic v2 diagnostics models in agent/src/remediation_agent/models/diagnostics.py (TestFailureDiagnostic with file_path: str, line_number: int >= 1, error_type: str, message: str, test_name: Optional[str])
- [X] T008 [P] Implement Pydantic v2 AST context models in agent/src/remediation_agent/models/context.py (EnclosingScope with start_line >= 1, end_line >= 1, scope_type: str, name: str, code: str, and CodeContextScope)
- [X] T009 [P] Implement Pydantic v2 patch and session models in agent/src/remediation_agent/models/patch.py and agent/src/remediation_agent/models/session.py (CandidatePatch with target_files min_length=1, RemediationAttempt with attempt_number 1..3, and RemediationSession with final_status enum 'RESOLVED', 'EXHAUSTED', 'ERROR')
- [X] T010 Write unit tests for all domain models in agent/tests/unit/test_models.py verifying validation constraints and serialization

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Structured Failure Ingestion & AST Scope Diagnosis (Priority: P1) 🎯 MVP

**Goal**: Ingest test failure JSON envelopes, extract failing file paths, lines, and assertion traces, and query Tree-sitter to isolate minimal enclosing scopes (functions, classes, methods) and module imports into prompt context.

**Independent Test**: Provide `agent/tests/fixtures/sample_failure_envelope.json`, run `TestLogParser` and `ASTScopeExtractor`, and verify structured extraction of failing assertions and enclosing code scopes without full-file token bloat.

### Tests for User Story 1 (TDD - Write First)

- [X] T011 [P] [US1] Write unit tests for test failure log parser in agent/tests/unit/test_test_log_parser.py verifying extraction of file paths, line numbers, and assertion messages from sandbox JSON envelopes
- [X] T012 [P] [US1] Write unit tests for Tree-sitter AST scope extractor in agent/tests/unit/test_ast_extractor.py verifying enclosing function, method, class, and import extraction across Python, TypeScript, and Go fixtures

### Implementation for User Story 1

- [X] T013 [US1] Implement TestLogParser in agent/src/remediation_agent/parsers/test_log_parser.py to deserialize runner JSON envelope and extract TestFailureDiagnostic records
- [X] T014 [US1] Implement Tree-sitter grammar registry in agent/src/remediation_agent/parsers/ast_extractor.py loading tree-sitter-python, tree-sitter-typescript, and tree-sitter-go parsers
- [X] T015 [US1] Implement AST scope walker in agent/src/remediation_agent/parsers/ast_extractor.py that maps line coordinates to leaf AST nodes, walks parent hierarchy to enclosing scope, and collects top-level import nodes into CodeContextScope
- [X] T016 [US1] Integrate log parser and AST extractor in agent/src/remediation_agent/parsers/__init__.py and verify all US1 unit tests pass

**Checkpoint**: User Story 1 fully functional and independently testable (MVP delivery).

---

## Phase 4: User Story 2 - Syntax-Aware Patch Generation (Priority: P2)

**Goal**: Synthesize minimal, machine-applicable unified diffs (diff -u format) using prompt context via AWS Bedrock Converse API, with deterministic offline mock client support and git apply validation.

**Independent Test**: Supply `CodeContextScope` and `TestFailureDiagnostic` to `PatchSynthesizer`, verify generation of a valid `CandidatePatch` in unified diff format, and confirm application using `git apply --check`.

### Tests for User Story 2 (TDD - Write First)

- [X] T017 [P] [US2] Write unit tests for diff validation and application in agent/tests/unit/test_diff_applier.py verifying unified diff parsing, hunk check via git apply --check, and reject handling
- [X] T018 [P] [US2] Write unit tests for Bedrock LLM client and prompt construction in agent/tests/unit/test_bedrock_client.py verifying prompt formatting, system instructions, and mock response handling

### Implementation for User Story 2

- [X] T019 [US2] Define abstract LLMProvider protocol in agent/src/remediation_agent/llm/client_protocol.py
- [X] T020 [US2] Implement prompt templates in agent/src/remediation_agent/llm/prompts.py instructing model to output strictly valid unified diff syntax (--- a/, +++ b/, @@ markers)
- [X] T021 [US2] Implement MockBedrockClient in agent/src/remediation_agent/llm/mock_client.py returning deterministic candidate patches for offline unit and integration tests
- [X] T022 [US2] Implement BedrockConverseClient in agent/src/remediation_agent/llm/bedrock_client.py using boto3 Bedrock Runtime converse API with Claude 3.5 Sonnet
- [X] T023 [US2] Implement DiffApplier in agent/src/remediation_agent/patcher/diff_applier.py wrapping git apply --check and git apply --unidiff-zero with error parsing

**Checkpoint**: User Stories 1 and 2 work together to extract context and synthesize applicable diffs.

---

## Phase 5: User Story 3 - Multi-Attempt Remediation Orchestration & Rollback (Priority: P3)

**Goal**: Orchestrate the iterative test-remediate-verify loop up to 3 attempts, feeding subsequent test failure logs back into prompt context, and executing a clean git rollback if all 3 attempts fail.

**Independent Test**: Run `RemediationLoop` against a mock repository fixture with simulated test runs, confirming it terminates on pass (attempt 1 or 2) and halts with clean rollback and audit log export on attempt 3.

### Tests for User Story 3 (TDD - Write First)

- [X] T024 [P] [US3] Write integration tests for multi-attempt remediation loop in agent/tests/integration/test_remediation_loop.py verifying attempt indexing (1..3), context accumulation, passing termination, and 3rd attempt rollback

### Implementation for User Story 3

- [X] T025 [US3] Implement SubprocessSandboxRunner in agent/src/remediation_agent/orchestrator/sandbox_client.py invoking sandbox-runner CLI and parsing JSON output
- [X] T026 [US3] Implement GitRollbackManager in agent/src/remediation_agent/patcher/rollback.py executing atomic git reset --hard and git clean -fd scoped to modified files
- [X] T027 [US3] Implement RemediationLoop orchestrator in agent/src/remediation_agent/orchestrator/loop.py managing state transitions, accumulating diagnostic history across attempts, and halting at max 3 iterations
- [X] T028 [US3] Implement session audit serializer in agent/src/remediation_agent/orchestrator/loop.py exporting RemediationSession conforming to contracts/audit-log-schema.json

**Checkpoint**: Complete autonomous remediation loop functional with bounded attempts and clean rollback.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Command-line interface, monorepo scripts integration, documentation, and end-to-end validation.

- [X] T029 [P] Implement CLI commands (run, diagnose) with argument parsing and exit codes in agent/src/remediation_agent/cli.py conforming to contracts/cli-contract.md
- [X] T030 [P] Add package documentation and usage instructions in agent/README.md
- [X] T031 Add Python verification targets (agent:test, agent:lint) in root package.json, update root npm run verify script, and configure Python 3.12 setup in .github/workflows/pr-verify.yml
- [X] T032 Execute end-to-end quickstart validation scenarios from specs/001-ast-patch-synthesis/quickstart.md and verify all pytest test suites pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - starts immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion. Delivers the MVP.
- **User Story 2 (Phase 4)**: Depends on User Story 1 (provides diagnostic context models).
- **User Story 3 (Phase 5)**: Depends on User Story 2 (orchestrates diff synthesis and application).
- **Polish (Phase 6)**: Depends on all user stories being completed.

### Parallel Opportunities

```bash
# Foundational models and fixtures in parallel:
Task T005: "Create mock failure fixture in agent/tests/fixtures/sample_failure_envelope.json"
Task T006: "Create code targets in agent/tests/fixtures/sample_target.py"
Task T007: "Implement diagnostics models in agent/src/remediation_agent/models/diagnostics.py"
Task T008: "Implement AST models in agent/src/remediation_agent/models/context.py"
Task T009: "Implement patch models in agent/src/remediation_agent/models/patch.py"

# User Story 1 test authoring in parallel:
Task T011: "Write unit tests for test failure parser in agent/tests/unit/test_test_log_parser.py"
Task T012: "Write unit tests for AST extractor in agent/tests/unit/test_ast_extractor.py"

# User Story 2 test authoring in parallel:
Task T017: "Write unit tests for diff validation in agent/tests/unit/test_diff_applier.py"
Task T018: "Write unit tests for Bedrock LLM client in agent/tests/unit/test_bedrock_client.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete **Phase 1: Setup** (`agent/pyproject.toml`, test configuration).
2. Complete **Phase 2: Foundational** (Pydantic schemas and test fixtures).
3. Complete **Phase 3: User Story 1** (Log parser and Tree-sitter scope extractor).
4. **STOP and VALIDATE**: Verify that failure traces and enclosing AST scopes are accurately isolated on sample fixtures.

### Incremental Delivery

1. **Increment 1 (MVP)**: Ingestion & AST scope extraction (`remediation-agent diagnose`).
2. **Increment 2**: Generative patch synthesis and git diff application (`PatchSynthesizer` + `DiffApplier`).
3. **Increment 3**: Autonomous loop orchestration, sandbox verification, and clean rollback (`RemediationLoop`).
4. **Increment 4**: Monorepo integration and verification gate hook (`npm run verify`).

