"""Parser for structured test runner execution output."""

import re

from remediation_agent.models.diagnostics import SandboxRunResult, TestFailureDiagnostic


class TestLogParser:
    """Extracts TestFailureDiagnostic records from test execution stdout/stderr."""

    # Matches: at calculateTotal (src/calculate.ts:14:10) or at src/calculate.ts:14:10
    NODE_TRACE_RE = re.compile(
        r"at\s+(?:(?P<fn>[\w.<>$]+)\s+\()?(?P<file>[^()\s:]+\.[a-zA-Z0-9]+):(?P<line>\d+):(?P<col>\d+)\)?"
    )

    # Matches: agent/tests/fixtures/sample_target.py:7: AssertionError
    PYTEST_SUMMARY_RE = re.compile(
        r"^(?P<file>[^\s:]+\.py):(?P<line>\d+):\s*(?P<err>[A-Za-z0-9_]+Error.*)?",
        re.MULTILINE,
    )

    # Matches: File "sample.py", line 12, in <module>
    PYTHON_TRACE_RE = re.compile(r'File "(?P<file>[^"]+)", line (?P<line>\d+)(?:, in (?P<fn>.*))?')

    # Matches: calc_test.go:12: calculateTotal() = 10, want 15
    GO_TRACE_RE = re.compile(
        r"^\s*(?P<file>[^\s:]+\.go):(?P<line>\d+):\s*(?P<msg>.*)$",
        re.MULTILINE,
    )

    def parse(self, result: SandboxRunResult) -> list[TestFailureDiagnostic]:
        """Parse runner result and extract unique diagnostics."""
        if result.exit_code == 0:
            return []

        text = f"{result.stdout}\n{result.stderr}"
        diagnostics: list[TestFailureDiagnostic] = []
        seen = set()

        # 1. Check Python pytest summary pattern
        for match in self.PYTEST_SUMMARY_RE.finditer(text):
            file_path = match.group("file").strip()
            line_no = int(match.group("line"))
            err_type = (match.group("err") or "AssertionError").strip()
            msg = self._extract_surrounding_error_message(text, match.start())
            key = (file_path, line_no)
            if key not in seen:
                seen.add(key)
                diagnostics.append(
                    TestFailureDiagnostic(
                        file_path=file_path,
                        line_number=line_no,
                        error_type=err_type,
                        message=msg,
                    )
                )

        # 2. Check Node / JS / TS stack traces
        if not diagnostics:
            for match in self.NODE_TRACE_RE.finditer(text):
                file_path = match.group("file").strip()
                line_no = int(match.group("line"))
                fn_name = match.group("fn")
                # Filter out node_modules or internal node paths
                if "node_modules" in file_path or file_path.startswith("node:"):
                    continue
                err_type, msg = self._extract_node_assertion(text)
                key = (file_path, line_no)
                if key not in seen:
                    seen.add(key)
                    diagnostics.append(
                        TestFailureDiagnostic(
                            file_path=file_path,
                            line_number=line_no,
                            error_type=err_type or "AssertionError",
                            message=msg or f"Error in {fn_name or file_path}",
                            test_name=fn_name,
                        )
                    )

        # 3. Check Go test output
        if not diagnostics:
            for match in self.GO_TRACE_RE.finditer(text):
                file_path = match.group("file").strip()
                line_no = int(match.group("line"))
                msg = match.group("msg").strip()
                key = (file_path, line_no)
                if key not in seen:
                    seen.add(key)
                    diagnostics.append(
                        TestFailureDiagnostic(
                            file_path=file_path,
                            line_number=line_no,
                            error_type="TestFailure",
                            message=msg,
                        )
                    )

        return diagnostics

    def _extract_surrounding_error_message(self, text: str, index: int) -> str:
        """Extract lines with error message near failure position."""
        lines = text[:index].splitlines()[-10:]
        err_lines = [
            line_item.strip().lstrip("E ").strip()
            for line_item in lines
            if line_item.strip().startswith("E ")
        ]
        if err_lines:
            return " \n".join(err_lines)
        return "Test failed assertion"

    def _extract_node_assertion(self, text: str) -> tuple[str, str]:
        """Extract assertion error and message from JS/TS failure logs."""
        for line in text.splitlines():
            line_s = line.strip()
            if "AssertionError:" in line_s or "Error:" in line_s:
                parts = line_s.split(":", 1)
                err_type = parts[0].strip()
                msg = parts[1].strip() if len(parts) > 1 else line_s
                return err_type, msg
        return "Error", "Test assertion failure"
