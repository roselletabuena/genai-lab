"""LLM module exports."""

from remediation_agent.llm.bedrock_client import BedrockConverseClient
from remediation_agent.llm.client_protocol import LLMProvider
from remediation_agent.llm.mock_client import MockBedrockClient
from remediation_agent.llm.prompts import (
    SYSTEM_REMEDIATION_PROMPT,
    build_remediation_prompt,
    extract_diff_from_response,
)

__all__ = [
    "LLMProvider",
    "BedrockConverseClient",
    "MockBedrockClient",
    "SYSTEM_REMEDIATION_PROMPT",
    "build_remediation_prompt",
    "extract_diff_from_response",
]
