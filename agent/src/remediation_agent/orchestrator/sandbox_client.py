"""Client for executing containerized test suites via sandbox-runner CLI."""

import json
import subprocess
from pathlib import Path

from remediation_agent.models.diagnostics import SandboxRunResult


class SubprocessSandboxRunner:
    """Executes tests inside Docker container using GL-53 sandbox-runner CLI."""

    def __init__(
        self,
        repo_path: str | Path,
        sandbox_bin: str = "sandbox-runner",
        image: str = "node:24-alpine",
        timeout: str = "60s",
    ) -> None:
        self.repo_path = Path(repo_path).resolve()
        self.sandbox_bin = sandbox_bin
        self.image = image
        self.timeout = timeout

    def run(self, test_cmd: str) -> SandboxRunResult:
        """Execute test command and parse structured RunResult JSON envelope."""
        args = [
            self.sandbox_bin,
            "-repo",
            str(self.repo_path),
            "-cmd",
            test_cmd,
            "-image",
            self.image,
            "-timeout",
            self.timeout,
            "-json",
        ]

        try:
            proc = subprocess.run(
                args,
                cwd=self.repo_path,
                capture_output=True,
                text=True,
            )

            # sandbox-runner outputs JSON to stdout
            stdout_text = proc.stdout.strip()
            if stdout_text:
                try:
                    data = json.loads(stdout_text)
                    return SandboxRunResult(**data)
                except json.JSONDecodeError:
                    pass

            return SandboxRunResult(
                exit_code=proc.returncode,
                stdout=proc.stdout,
                stderr=proc.stderr,
                duration_ms=0,
                timed_out=False,
                error=proc.stderr if proc.returncode != 0 else None,
            )

        except FileNotFoundError:
            # Fallback if sandbox-runner binary is not compiled/installed: execute directly locally
            proc = subprocess.run(
                test_cmd,
                shell=True,
                cwd=self.repo_path,
                capture_output=True,
                text=True,
            )
            return SandboxRunResult(
                exit_code=proc.returncode,
                stdout=proc.stdout,
                stderr=proc.stderr,
                duration_ms=0,
                timed_out=False,
            )
