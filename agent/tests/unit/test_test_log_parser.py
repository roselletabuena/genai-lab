"""Unit tests for TestLogParser."""

from remediation_agent.models import SandboxRunResult
from remediation_agent.parsers.test_log_parser import TestLogParser


def test_parse_vitest_jest_trace(sample_failure_envelope: dict):
    envelope = SandboxRunResult(**sample_failure_envelope)
    parser = TestLogParser()
    diagnostics = parser.parse(envelope)

    assert len(diagnostics) >= 1
    diag = diagnostics[0]
    assert "src/calculate.ts" in diag.file_path or "calculate.ts" in diag.file_path
    assert diag.line_number == 14
    assert "AssertionError" in diag.error_type
    assert "expected 15 to equal 20" in diag.message


def test_parse_python_pytest_trace():
    pytest_stdout = """
============================= FAILURES =============================
____________________________ test_add _____________________________

    def test_add():
>       assert add_numbers(2, 3) == 5
E       AssertionError: assert -1 == 5
E        +  where -1 = add_numbers(2, 3)

agent/tests/fixtures/sample_target.py:7: AssertionError
===================== 1 failed in 0.05s ======================
"""
    envelope = SandboxRunResult(
        exit_code=1,
        stdout=pytest_stdout,
        stderr="",
        duration_ms=100,
    )
    parser = TestLogParser()
    diagnostics = parser.parse(envelope)

    assert len(diagnostics) >= 1
    diag = diagnostics[0]
    assert "sample_target.py" in diag.file_path
    assert diag.line_number == 7
    assert "AssertionError" in diag.error_type
    assert "assert -1 == 5" in diag.message


def test_parse_go_test_trace():
    go_stdout = """
--- FAIL: TestAddNumbers (0.00s)
    calc_test.go:12: calculateTotal() = 10, want 15
FAIL
FAIL	github.com/roselletabuena/genai-lab/pkg/calc	0.015s
"""
    envelope = SandboxRunResult(
        exit_code=1,
        stdout=go_stdout,
        stderr="",
        duration_ms=50,
    )
    parser = TestLogParser()
    diagnostics = parser.parse(envelope)

    assert len(diagnostics) >= 1
    diag = diagnostics[0]
    assert "calc_test.go" in diag.file_path
    assert diag.line_number == 12
    assert "calculateTotal() = 10, want 15" in diag.message


def test_parse_clean_passing_suite_returns_empty():
    envelope = SandboxRunResult(
        exit_code=0,
        stdout="All tests passed!",
        stderr="",
        duration_ms=20,
    )
    parser = TestLogParser()
    diagnostics = parser.parse(envelope)
    assert diagnostics == []

