"""Secret scrubbing applied to everything that is posted to a pull request."""

import re

REDACTED = "[REDACTED]"

_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"),
    re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{8,}"),
]

# NAME=value or NAME: value where NAME contains SECRET|TOKEN|PASSWORD|KEY.
_ASSIGNMENT = re.compile(
    r"(?im)^(?P<prefix>[ \t]*(?:export[ \t]+)?[A-Za-z0-9_.-]*"
    r"(?:SECRET|TOKEN|PASSWORD|PASSWD|KEY)[A-Za-z0-9_.-]*[ \t]*[=:][ \t]*)"
    r"(?P<value>\S.*)$"
)


def redact(text: str) -> str:
    """Replace credentials and secret-looking assignments with ``[REDACTED]``."""
    for pattern in _PATTERNS:
        text = pattern.sub(REDACTED, text)
    return _ASSIGNMENT.sub(lambda m: f"{m.group('prefix')}{REDACTED}", text)
