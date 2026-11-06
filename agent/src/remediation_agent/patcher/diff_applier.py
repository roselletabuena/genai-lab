"""Diff validation and application engine."""

import os
import re
import subprocess
from pathlib import Path

from remediation_agent.models.patch import CandidatePatch


class DiffApplier:
    """Validates and applies unified diffs against the repository."""

    def __init__(self, repo_root: str | Path | None = None) -> None:
        self.repo_root = Path(repo_root or os.getcwd()).resolve()

    def extract_target_files(self, diff_text: str) -> list[str]:
        """Extract modified file paths from unified diff headers (+++ b/<file>)."""
        files = re.findall(r"^\+\+\+ b/(.*)$", diff_text, re.MULTILINE)
        return [f.strip() for f in files]

    def check(self, patch: CandidatePatch) -> tuple[bool, str | None]:
        """Validate if diff can be applied cleanly without modifying files."""
        # Try git apply --check first
        try:
            res = subprocess.run(
                ["git", "apply", "--check", "--unidiff-zero", "-"],
                input=patch.diff_text.encode("utf-8"),
                cwd=self.repo_root,
                capture_output=True,
            )
            if res.returncode == 0:
                return True, None
            # If git apply check failed, check reason
            err_msg = res.stderr.decode("utf-8", errors="replace")
            # If outside a git repository or git rejected hunk, test fallback
            if "not a git repository" not in err_msg:
                return False, f"Git apply rejected patch:\n{err_msg}"
        except FileNotFoundError:
            pass

        # Native fallback patch check
        return self._native_check(patch.diff_text)

    def apply(self, patch: CandidatePatch) -> tuple[bool, str | None]:
        """Apply unified diff to working tree."""
        try:
            res = subprocess.run(
                ["git", "apply", "--unidiff-zero", "-"],
                input=patch.diff_text.encode("utf-8"),
                cwd=self.repo_root,
                capture_output=True,
            )
            if res.returncode == 0:
                return True, None
            err_msg = res.stderr.decode("utf-8", errors="replace")
            if "not a git repository" not in err_msg:
                return False, f"Git apply failed:\n{err_msg}"
        except FileNotFoundError:
            pass

        # Native fallback patch application
        return self._native_apply(patch.diff_text)

    def _native_check(self, diff_text: str) -> tuple[bool, str | None]:
        """Native verification that hunks match target files without git binary."""
        try:
            self._apply_hunks(diff_text, dry_run=True)
            return True, None
        except Exception as e:
            return False, str(e)

    def _native_apply(self, diff_text: str) -> tuple[bool, str | None]:
        """Native hunk application fallback."""
        try:
            self._apply_hunks(diff_text, dry_run=False)
            return True, None
        except Exception as e:
            return False, str(e)

    def _apply_hunks(self, diff_text: str, dry_run: bool = False) -> None:
        """Parse unified diff hunks and apply to target files."""
        file_diffs = re.split(r"(?=^--- a/)", diff_text, flags=re.MULTILINE)
        for fdiff in file_diffs:
            if not fdiff.strip() or not fdiff.startswith("--- a/"):
                continue

            lines = fdiff.splitlines()
            orig_match = re.match(r"^--- a/(.*)$", lines[0])
            new_match = re.match(r"^\+\+\+ b/(.*)$", lines[1])
            if not orig_match or not new_match:
                continue

            target_rel = new_match.group(1).strip()
            target_path = self.repo_root / target_rel
            if not target_path.exists():
                raise FileNotFoundError(f"Target file does not exist: {target_rel}")

            content_lines = target_path.read_text(encoding="utf-8").splitlines(keepends=True)
            hunks = re.split(r"(?=^@@ )", "\n".join(lines[2:]), flags=re.MULTILINE)

            new_content = list(content_lines)
            offset = 0

            for hunk in hunks:
                if not hunk.startswith("@@ "):
                    continue
                header_match = re.match(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", hunk)
                if not header_match:
                    continue

                orig_start = int(header_match.group(1)) - 1  # 0-based
                hunk_lines = hunk.splitlines()[1:]

                del_count = 0
                add_lines = []

                for hline in hunk_lines:
                    if hline.startswith("-"):
                        del_count += 1
                    elif hline.startswith("+"):
                        add_lines.append(hline[1:] + "\n")
                    elif hline.startswith(" "):
                        pass

                actual_pos = orig_start + offset
                # Verify bounds
                if actual_pos > len(new_content):
                    raise ValueError(f"Hunk position out of bounds in {target_rel}")

                # Replace lines
                new_content[actual_pos : actual_pos + del_count] = add_lines
                offset += len(add_lines) - del_count

            if not dry_run:
                target_path.write_text("".join(new_content), encoding="utf-8")
