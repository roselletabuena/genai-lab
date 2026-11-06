"""Integration tests for RemediationLoop multi-attempt orchestration."""

from pathlib import Path

from remediation_agent.llm.mock_client import MockBedrockClient
from remediation_agent.models import SandboxRunResult, SessionFinalStatus
from remediation_agent.orchestrator.loop import RemediationLoop


class MockRunner:
    """Mock sandbox runner that simulates passing after N attempts or never passing."""

    def __init__(self, pass_on_attempt: int = 1) -> None:
        self.attempts = 0
        self.pass_on_attempt = pass_on_attempt

    def run(self, test_cmd: str) -> SandboxRunResult:
        self.attempts += 1
        if self.attempts >= self.pass_on_attempt:
            return SandboxRunResult(
                exit_code=0,
                stdout="All tests passed!",
                stderr="",
                duration_ms=50,
            )
        return SandboxRunResult(
            exit_code=1,
            stdout=f"FAIL test.py: attempt {self.attempts} failed\nAssertionError: failure",
            stderr="",
            duration_ms=50,
        )


def test_remediation_loop_resolves_on_first_attempt(tmp_path: Path):
    target = tmp_path / "calc.py"
    target.write_text("def calc(): return 1\n", encoding="utf-8")

    diff = """--- a/calc.py
+++ b/calc.py
@@ -1 +1 @@
-def calc(): return 1
+def calc(): return 2
"""
    llm = MockBedrockClient(mock_diff=diff)
    runner = MockRunner(pass_on_attempt=1)

    initial_fail = SandboxRunResult(
        exit_code=1,
        stdout="calc.py:1: AssertionError\nAssertionError: failed",
        stderr="",
        duration_ms=50,
    )

    loop = RemediationLoop(
        repo_root=tmp_path,
        test_command="pytest",
        llm_provider=llm,
        sandbox_runner=runner,
        max_attempts=3,
    )

    session = loop.run(initial_failure=initial_fail)
    assert session.final_status == SessionFinalStatus.RESOLVED
    assert not session.rolled_back
    assert len(session.attempts) == 1
    assert "return 2" in target.read_text(encoding="utf-8")


def test_remediation_loop_exhausts_and_rolls_back(tmp_path: Path):
    target = tmp_path / "calc.py"
    target.write_text("original content\n", encoding="utf-8")

    # Initialize a mock git repo in tmp_path so rollback works
    import subprocess

    subprocess.run(["git", "init"], cwd=tmp_path, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=tmp_path, capture_output=True)
    subprocess.run(
        ["git", "config", "user.email", "test@example.com"], cwd=tmp_path, capture_output=True
    )
    subprocess.run(["git", "add", "calc.py"], cwd=tmp_path, capture_output=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=tmp_path, capture_output=True)

    diff = """--- a/calc.py
+++ b/calc.py
@@ -1 +1 @@
-original content
+modified content
"""
    llm = MockBedrockClient(mock_diff=diff)
    # Runner that never passes
    runner = MockRunner(pass_on_attempt=999)

    initial_fail = SandboxRunResult(
        exit_code=1,
        stdout="calc.py:1: AssertionError\nAssertionError: failed",
        stderr="",
        duration_ms=50,
    )

    loop = RemediationLoop(
        repo_root=tmp_path,
        test_command="pytest",
        llm_provider=llm,
        sandbox_runner=runner,
        max_attempts=3,
    )

    session = loop.run(initial_failure=initial_fail)
    assert session.final_status == SessionFinalStatus.EXHAUSTED
    assert session.rolled_back is True
    assert len(session.attempts) == 3
    # Check that git rollback restored original content
    assert target.read_text(encoding="utf-8") == "original content\n"
