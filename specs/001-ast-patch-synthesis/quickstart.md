# Quickstart Validation Guide: Tree-sitter AST Diagnostic & Patch Synthesis Loop

**Feature**: `001-ast-patch-synthesis`  
**Date**: 2026-11-06  
**Status**: Ready for Implementation  

This guide provides concrete, step-by-step instructions to validate the remediation agent end-to-end in development and CI environments.

---

## 1. Prerequisites

- Python 3.12+ installed (`python --version`)
- Standard virtual environment tools (`python -m venv`)
- Git 2.40+ installed
- *(Optional)* Go 1.22+ and Docker (if testing live with `sandbox-runner`)

---

## 2. Environment Setup

From the repository root:

```bash
# 1. Create a Python virtual environment
python -m venv agent/.venv

# 2. Activate the virtual environment
# On Windows (PowerShell):
.\agent\.venv\Scripts\Activate.ps1
# On Linux/macOS:
source agent/.venv/bin/activate

# 3. Install the package in editable mode with development dependencies
pip install -e "agent/[dev]"
```

---

## 3. Running Unit and Contract Test Suites

Verify that all unit tests, AST parser tests, and mock LLM loop tests pass without live AWS credentials:

```bash
# Run pytest with code coverage across agent/
pytest agent/tests -v --cov=remediation_agent --cov-report=term-missing
```

**Expected Outcome**:
- All tests pass (`100% passed`).
- Code coverage $\ge 85\%$ across `remediation_agent`.
- Zero network requests to AWS Bedrock (all calls handled by `MockBedrockClient`).

---

## 4. End-to-End Validation Scenarios

### Scenario 1: Diagnostic Parsing & Scope Extraction (Dry Run)

Validate that the Tree-sitter extractor parses a sample test failure envelope and extracts the enclosing function scope:

```bash
# Run standalone diagnostic tool against a mock test failure JSON
remediation-agent diagnose \
  --input agent/tests/fixtures/sample_failure.json \
  --repo . \
  --format json
```

**Expected Outcome**:
- Returns JSON output containing `TestFailureDiagnostic` and `CodeContextScope`.
- Identifies the target file, line number, enclosing function/method name, and all file import declarations.

---

### Scenario 2: Autonomous Remediation with Mock LLM (Passing on Attempt 1)

Simulate a single-iteration fix using the mock Bedrock provider:

```bash
remediation-agent run \
  --repo agent/tests/fixtures/sample_repo \
  --cmd "pytest" \
  --mock-llm \
  --output-log session-audit.json
```

**Expected Outcome**:
- Exit code: `0` (`EXIT_RESOLVED`).
- Candidate patch is generated, applied via `git apply`, and verified.
- `session-audit.json` contains `final_status: "RESOLVED"` and 1 attempt record.

---

### Scenario 3: Bounded 3-Attempt Exhaustion and Clean Rollback

Simulate an unresolvable test failure where all 3 generated patches fail the test suite:

```bash
remediation-agent run \
  --repo agent/tests/fixtures/unfixable_repo \
  --cmd "pytest" \
  --mock-llm \
  --max-attempts 3 \
  --output-log session-audit.json
```

**Expected Outcome**:
- Exit code: `1` (`EXIT_EXHAUSTED`).
- The agent halts after exactly 3 attempts without looping infinitely.
- Working tree is clean (`git status --porcelain` is empty, all patches rolled back).
- `session-audit.json` contains `final_status: "EXHAUSTED"`, `rolled_back: true`, and 3 attempt records.

