"""Unit tests for Bedrock LLM client and prompt construction."""

from remediation_agent.llm.mock_client import MockBedrockClient
from remediation_agent.llm.prompts import build_remediation_prompt, extract_diff_from_response
from remediation_agent.models import (
    CodeContextScope,
    EnclosingScope,
    TestFailureDiagnostic,
)


def test_build_remediation_prompt():
    diag = TestFailureDiagnostic(
        file_path="src/calc.py",
        line_number=10,
        error_type="AssertionError",
        message="expected 10 got 5",
    )
    scope = CodeContextScope(
        file_path="src/calc.py",
        imports=["import math"],
        enclosing_scopes=[
            EnclosingScope(
                scope_type="function_definition",
                name="calc",
                start_line=8,
                end_line=12,
                code="def calc():\n    return 5",
            )
        ],
        surrounding_code="def calc():\n    return 5",
    )

    prompt = build_remediation_prompt(diagnostics=[diag], scopes=[scope])
    assert "src/calc.py" in prompt
    assert "line 10" in prompt
    assert "expected 10 got 5" in prompt
    assert "def calc():" in prompt
    assert "diff -u" in prompt


def test_extract_diff_from_markdown():
    response = """Here is the suggested fix:
```diff
--- a/src/calc.py
+++ b/src/calc.py
@@ -1,2 +1,2 @@
-return 5
+return 10
```
This resolves the issue."""
    diff = extract_diff_from_response(response)
    assert diff is not None
    assert "--- a/src/calc.py" in diff
    assert "+return 10" in diff


def test_mock_bedrock_client_returns_patch():
    client = MockBedrockClient(
        mock_diff="--- a/src/calc.py\n+++ b/src/calc.py\n@@ -1 +1 @@\n-5\n+10"
    )
    patch = client.synthesize_patch(prompt="repair prompt")
    assert patch.patch_id.startswith("patch-")
    assert "--- a/src/calc.py" in patch.diff_text
    assert patch.target_files == ["src/calc.py"]

