"""Prompt templates and response extraction for patch synthesis."""

import re

from remediation_agent.models.context import CodeContextScope
from remediation_agent.models.diagnostics import TestFailureDiagnostic

SYSTEM_REMEDIATION_PROMPT = """You are an expert autonomous code remediation agent.
Your task is to analyze failing test diagnostics and surrounding code context to synthesize a minimal, syntax-aware bug fix.

STRICT OUTPUT FORMAT RULES:
1. You MUST output ONLY a valid standard unified diff (diff -u format).
2. The diff MUST be enclosed within a single markdown code fence labeled with 'diff':
   ```diff
   --- a/path/to/file.ext
   +++ b/path/to/file.ext
   @@ -line,count +line,count @@
   - old code
   + repaired code
   ```
3. Use exact relative file paths starting with '--- a/' and '+++ b/'.
4. Do NOT output commentary, explanations, or multiple code blocks. Output ONLY the diff.
5. The fix must be minimal, modifying only the lines necessary to resolve the assertion failure.
"""


def build_remediation_prompt(
    diagnostics: list[TestFailureDiagnostic],
    scopes: list[CodeContextScope],
    attempt_number: int = 1,
    previous_diff: str | None = None,
) -> str:
    """Construct contextual user prompt for patch synthesis."""
    lines = [f"## Remediation Task (Attempt {attempt_number}/3)", ""]

    lines.append("### Test Failure Diagnostics:")
    for d in diagnostics:
        lines.append(f"- File: {d.file_path} (line {d.line_number})")
        lines.append(f"  Error: {d.error_type}")
        lines.append(f"  Message: {d.message}")
        if d.test_name:
            lines.append(f"  Test: {d.test_name}")
    lines.append("")

    lines.append("### Enclosing Code Scopes & Imports:")
    for s in scopes:
        lines.append(f"#### File: {s.file_path}")
        if s.imports:
            lines.append("Imports:")
            for imp in s.imports:
                lines.append(f"  {imp}")
        lines.append("Code Context:")
        lines.append("```")
        lines.append(s.surrounding_code)
        lines.append("```")
    lines.append("")

    if previous_diff and attempt_number > 1:
        lines.append("### Previous Attempt Diff (Failed Verification):")
        lines.append("```diff")
        lines.append(previous_diff)
        lines.append("```")
        lines.append("Please adjust your repair strategy to address the ongoing failure.")
        lines.append("")

    lines.append(
        "Please output the minimal valid unified diff (diff -u) enclosed in a ```diff block to fix this issue."
    )
    return "\n".join(lines)


def extract_diff_from_response(text: str) -> str | None:
    """Extract raw unified diff from LLM markdown response."""
    # Match ```diff ... ``` or ```patch ... ```
    match = re.search(r"```(?:diff|patch)?\s*\n(.*?)\n```", text, re.DOTALL)
    if match:
        diff_text = match.group(1).strip()
        if "--- a/" in diff_text and "+++ b/" in diff_text:
            return diff_text

    # Fallback: Check if response itself starts with --- a/
    if "--- a/" in text and "+++ b/" in text:
        lines = []
        capturing = False
        for line in text.splitlines():
            if line.startswith("--- a/"):
                capturing = True
            if capturing:
                lines.append(line)
        if lines:
            return "\n".join(lines).strip()

    return None
