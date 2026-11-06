"""Unit tests for DiffApplier."""

from pathlib import Path

from remediation_agent.models import CandidatePatch
from remediation_agent.patcher.diff_applier import DiffApplier


def test_parse_diff_target_files():
    diff_text = """--- a/src/calc.py
+++ b/src/calc.py
@@ -1,3 +1,3 @@
-a = 1
+a = 2
"""
    applier = DiffApplier()
    files = applier.extract_target_files(diff_text)
    assert files == ["src/calc.py"]


def test_diff_applier_check_valid_and_apply(tmp_path: Path):
    target = tmp_path / "hello.py"
    target.write_text("def hello():\n    return 'bad'\n", encoding="utf-8")

    diff_text = """--- a/hello.py
+++ b/hello.py
@@ -1,2 +1,2 @@
 def hello():
-    return 'bad'
+    return 'good'
"""
    patch = CandidatePatch(
        patch_id="patch-test",
        diff_text=diff_text,
        target_files=["hello.py"],
    )

    applier = DiffApplier(repo_root=tmp_path)
    # Validate dry run check
    is_applicable, err = applier.check(patch)
    assert is_applicable, f"Diff check failed: {err}"

    # Apply diff
    success, apply_err = applier.apply(patch)
    assert success, f"Diff apply failed: {apply_err}"
    assert "return 'good'" in target.read_text(encoding="utf-8")


def test_diff_applier_detects_invalid_hunk(tmp_path: Path):
    target = tmp_path / "hello.py"
    target.write_text("different content\n", encoding="utf-8")

    diff_text = """--- a/hello.py
+++ b/hello.py
@@ -1,2 +1,2 @@
-nonexistent line
+new line
"""
    patch = CandidatePatch(
        patch_id="patch-bad",
        diff_text=diff_text,
        target_files=["hello.py"],
    )

    applier = DiffApplier(repo_root=tmp_path)
    is_applicable, err = applier.check(patch)
    assert not is_applicable
    assert err is not None
