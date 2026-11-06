"""AWS Bedrock Converse API client for generative patch synthesis."""

import re
import uuid

import boto3

from remediation_agent.llm.client_protocol import LLMProvider
from remediation_agent.llm.prompts import SYSTEM_REMEDIATION_PROMPT, extract_diff_from_response
from remediation_agent.models.patch import CandidatePatch


class BedrockConverseClient(LLMProvider):
    """AWS Bedrock runtime client utilizing the Converse API."""

    def __init__(
        self,
        model_id: str = "anthropic.claude-3-5-sonnet-20241022-v2:0",
        region_name: str = "us-east-1",
        client: object | None = None,
    ) -> None:
        self.model_id = model_id
        self.region_name = region_name
        self._client = client or boto3.client("bedrock-runtime", region_name=region_name)

    def synthesize_patch(self, prompt: str, system_prompt: str = "") -> CandidatePatch:
        """Call Bedrock Converse API and parse synthesized unified diff."""
        sys_prompt = system_prompt or SYSTEM_REMEDIATION_PROMPT

        response = self._client.converse(
            modelId=self.model_id,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            system=[{"text": sys_prompt}],
            inferenceConfig={"temperature": 0.2, "maxTokens": 4096},
        )

        output_msg = response["output"]["message"]["content"][0]["text"]
        diff_text = extract_diff_from_response(output_msg)
        if not diff_text:
            raise ValueError(
                f"Model failed to generate a valid unified diff block. Response:\n{output_msg}"
            )

        # Extract modified files
        target_files = re.findall(r"^\+\+\+ b/(.*)$", diff_text, re.MULTILINE)
        if not target_files:
            raise ValueError(f"Malformed diff header missing '+++ b/':\n{diff_text}")

        return CandidatePatch(
            patch_id=f"patch-{uuid.uuid4().hex[:8]}",
            diff_text=diff_text,
            target_files=target_files,
            is_applicable=False,
        )
