"""Deterministic mock LLM provider for unit and integration testing."""

import re
import uuid

from remediation_agent.llm.client_protocol import LLMProvider
from remediation_agent.models.patch import CandidatePatch


class MockBedrockClient(LLMProvider):
    """Mock client returning deterministic unified diffs without AWS Bedrock network calls."""

    def __init__(self, mock_diff: str | None = None) -> None:
        self.mock_diff = mock_diff or ""
        self.invocations = 0

    def synthesize_patch(self, prompt: str, system_prompt: str = "") -> CandidatePatch:
        self.invocations += 1
        diff = self.mock_diff

        if not diff:
            # Generate minimal synthetic diff targeting the file found in prompt
            match = re.search(r"File:\s*([^\s()]+\.[a-zA-Z0-9]+)", prompt)
            target = match.group(1) if match else "target.py"
            diff = f"""--- a/{target}
+++ b/{target}
@@ -1,3 +1,3 @@
-# bug
+# fix
"""

        # Extract target files from diff header
        files = re.findall(r"^\+\+\+ b/(.*)$", diff, re.MULTILINE)
        if not files:
            files = ["repaired_file.py"]

        return CandidatePatch(
            patch_id=f"patch-{uuid.uuid4().hex[:8]}",
            diff_text=diff,
            target_files=files,
            is_applicable=False,
        )
