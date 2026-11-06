"""Abstract LLM Provider interface."""

from typing import Protocol

from remediation_agent.models.patch import CandidatePatch


class LLMProvider(Protocol):
    """Protocol for LLM patch synthesis engines."""

    def synthesize_patch(self, prompt: str, system_prompt: str = "") -> CandidatePatch:
        """Synthesize candidate patch from diagnostic context prompt."""
        ...
