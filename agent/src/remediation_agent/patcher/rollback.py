"""Git workspace rollback and transaction management."""

import os
import subprocess
from pathlib import Path


class GitRollbackManager:
    """Manages clean git reset and workspace restoration."""

    def __init__(self, repo_root: str | Path | None = None) -> None:
        self.repo_root = Path(repo_root or os.getcwd()).resolve()

    def rollback(self) -> bool:
        """Cleanly revert all uncommitted changes back to initial state."""
        try:
            # Revert tracked modified files
            subprocess.run(
                ["git", "reset", "--hard", "HEAD"],
                cwd=self.repo_root,
                check=True,
                capture_output=True,
            )
            # Clean untracked files created by patches
            subprocess.run(
                ["git", "clean", "-fd"],
                cwd=self.repo_root,
                check=True,
                capture_output=True,
            )
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False
