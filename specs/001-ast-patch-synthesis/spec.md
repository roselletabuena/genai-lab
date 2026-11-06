# Feature Specification: Tree-sitter AST Diagnostic and Patch Synthesis Loop

**Feature Branch**: `feat/GL-54-ast-diagnostic-patch-loop` (Spec: `001-ast-patch-synthesis`)  
**Created**: 2026-11-06  
**Status**: Approved  
**Input**: User description: "https://the-three-devsketeers.atlassian.net/browse/GL-54: 1.2 PY [Agent] Implement Tree-sitter AST diagnostic and patch synthesis loop"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Structured Failure Ingestion & AST Scope Diagnosis (Priority: P1)

As an autonomous code remediation agent,  
I want to ingest automated test failure logs and extract the exact syntactic scope (enclosing functions, classes, and dependencies) where errors originated,  
so that focused, relevant code context is isolated for diagnostic analysis without exceeding context boundaries.

**Why this priority**: Without accurate extraction of failure locations and enclosing code structures, patch synthesis will produce hallucinated or out-of-context modifications.

**Independent Test**: Can be tested by providing sample test runner failure outputs, verifying that the diagnostic parser identifies the failing source files, line numbers, and failure assertions, and that the syntax analyzer returns the exact enclosing code blocks and import statements.

**Acceptance Scenarios**:

1. **Given** test execution failure logs with standard assertion traces, **When** ingested by the diagnostic parser, **Then** target file paths, failing line numbers, and assertion failure messages are extracted into structured diagnostic records.
2. **Given** a parsed failure location within a source file, **When** inspected by the syntax analyzer, **Then** only the enclosing function/method, enclosing class (if applicable), and associated module imports are isolated into the diagnostic context.
3. **Given** a failure occurring outside of a function or class (e.g., top-level module code), **When** inspected, **Then** the diagnostic context isolates the surrounding top-level statements and imports.

---

### User Story 2 - Syntax-Aware Patch Generation (Priority: P2)

As an autonomous remediation agent,  
I want to synthesize minimal, syntax-aware code modifications using generative model guidance based on diagnostic context,  
so that candidate patches can be programmatically tested and applied without manual developer intervention.

**Why this priority**: Generative patch synthesis provides the remediation capability that resolves CI failures automatically.

**Independent Test**: Can be tested by supplying diagnostic context to the synthesis engine and validating that the output is formatted as a valid, programmatically applicable patch that resolves the synthetic error.

**Acceptance Scenarios**:

1. **Given** diagnostic context containing failure details and enclosing code scopes, **When** processed by the patch synthesis engine, **Then** a candidate patch is produced in a machine-applicable format.
2. **Given** a generated patch, **When** inspected prior to application, **Then** it targets only the files and lines identified in the diagnostic context and preserves unrelated code.
3. **Given** a generated patch, **When** applied to the target codebase, **Then** the application succeeds without formatting syntax errors or patch rejection markers.

---

### User Story 3 - Multi-Attempt Remediation Orchestration (Priority: P3)

As an engineering team relying on automated CI remediation,  
I want the remediation agent to iteratively test candidate patches and re-evaluate failing outcomes up to a controlled threshold of 3 attempts,  
so that multi-step or dependent failures can be resolved while preventing infinite looping or model exhaustion.

**Why this priority**: Guarantees bounded autonomous behavior, giving the agent iterative feedback from test results while providing deterministic termination.

**Independent Test**: Can be tested with a test case that fails initially, generates a patch, evaluates the resulting test outcome, and loops until tests pass or the 3-attempt limit is reached.

**Acceptance Scenarios**:

1. **Given** an initial test failure, **When** the first synthesized patch fails the test re-run, **Then** the subsequent attempt incorporates both the previous patch attempt and the new failure diagnostics into its context.
2. **Given** repeated test failures across iterations, **When** 3 attempts have been exhausted without achieving a passing test suite, **Then** the agent halts execution, terminates the loop, and outputs an audit log of all attempts.
3. **Given** a synthesized patch that causes the test suite to pass, **When** evaluated, **Then** the loop halts immediately with a successful outcome report.

---

### Edge Cases

- **Malformed or Incomplete Test Logs**: When test logs lack recognized stack traces or line numbers within the JSON envelope, the system captures available error text and falls back to whole-file inspection or logs an unparseable failure diagnostic.
- **Syntax-Invalid Source Files**: When target source files cannot be parsed by syntax tools due to pre-existing corruption, the system halts with a dedicated parse error state rather than failing silently.
- **Non-Applicable or Conflicting Patches**: When a generated unified diff cannot be applied cleanly to the target source tree (e.g. hunk collision or reject), the system treats this as a failed attempt, records the reject details in the attempt history, reverts any partial hunks, and initiates the next attempt.
- **Exceeding Maximum Iterations**: When all 3 attempts fail, the system deterministically rolls back the repository workspace to the initial clean commit and exports a full remediation summary.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST parse test failure logs to extract structured diagnostics including target file path, line number, and error message/assertion.
- **FR-002**: System MUST analyze target source files using AST syntax parsing to extract the exact enclosing scope (function, method, class) and relevant import declarations.
- **FR-003**: System MUST assemble extracted diagnostic scopes and error traces into structured context prompts for generative patch synthesis.
- **FR-004**: System MUST format candidate patches as valid, machine-applicable unified diffs (`patch -p1` compatible) targeting only identified failing files and lines.
- **FR-005**: System MUST ingest test execution failure results as structured JSON envelopes emitted by the isolated test runner (containing status, exit code, execution duration, and stdout/stderr failure logs).
- **FR-006**: System MUST manage an iterative remediation loop that evaluates patch outcomes and re-diagnoses failures up to a maximum of 3 attempts.
- **FR-007**: System MUST enforce a clean rollback policy when the 3-attempt limit is reached without a passing test suite, resetting the repository workspace to the initial clean commit and emitting a comprehensive audit trail detailing all failed attempts.
- **FR-008**: System MUST emit a structured audit log summarizing each attempt, generated patches, and final status (Passed, Max Attempts Reached, Error).

### Key Entities

- **TestFailureDiagnostic**: Represents an individual test assertion or runtime failure containing source file path, line number, error class, and failure assertion text.
- **CodeContextScope**: Structural code representation isolating enclosing function or class definitions, signature, relevant lines, and import declarations.
- **CandidatePatch**: Represents a proposed code modification containing target file, patch payload, and validation status.
- **RemediationAttempt**: An individual cycle record containing iteration index (1-3), prompt payload, synthesized patch, test execution result, and exit status.
- **RemediationSession**: Complete lifecycle record containing initial diagnostics, sequence of remediation attempts, and final outcome.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of standard test assertion failure traces have target file and line numbers extracted accurately.
- **SC-002**: 95%+ of extracted code context scopes isolate the minimal enclosing scope without including entire unrelated source files.
- **SC-003**: 90%+ of synthesized candidate patches apply to the source tree cleanly without formatting or reject syntax errors.
- **SC-004**: System deterministically halts within $\le 3$ attempts when test failures cannot be resolved.
- **SC-005**: Each diagnostic and patch generation iteration completes in under 30 seconds.

---

## Assumptions

- Test execution results originate from automated test runners producing parseable output logs.
- Target source files are present in the local workspace directory structure.
- Generative language model interfaces are accessible with appropriate credentials or mock environments during automated testing.
- The repository workspace can be modified and validated in an isolated execution environment.

