"""Render a FeedbackReport as GitHub-flavored Markdown (see contracts/github-api-contract.md)."""

import re

from remediation_agent.reporting.models import (
    MARKER_PREFIX,
    MAX_BODY_CHARS,
    AttemptOutcome,
    AttemptSummary,
    FailedReport,
    FeedbackReport,
    NoChangeReport,
    VerifiedFixReport,
)
from remediation_agent.reporting.truncation import truncate_log

MAX_ATTEMPTS = 3
_OUTCOME_LABEL = {
    AttemptOutcome.VERIFIED_SUCCESS: "Tests passed",
    AttemptOutcome.VERIFIED_FAILURE: "Tests failed",
    AttemptOutcome.FAILED_TO_APPLY: "Patch did not apply",
}
_INITIAL_LOG_BUDGET = 20_000
_MIN_LOG_BUDGET = 500


def marker_line(job_id: str) -> str:
    """Hidden marker identifying the bot comment; always the first line of the body."""
    return f"{MARKER_PREFIX} run={job_id} -->"


def format_duration(duration_ms: int) -> str:
    """Render milliseconds as seconds with one decimal, e.g. ``12.4s``."""
    return f"{duration_ms / 1000:.1f}s"


def neutralize_fences(text: str) -> str:
    """Prevent free text from opening code fences inside a table or paragraph."""
    return re.sub(r"`{3,}", "'''", text)


def fence_for(content: str) -> str:
    """Return a backtick fence longer than any backtick run inside ``content``."""
    longest = max((len(m) for m in re.findall(r"`+", content)), default=0)
    return "`" * max(3, longest + 1)


def _fenced(content: str, lang: str) -> str:
    fence = fence_for(content)
    return f"{fence}{lang}\n{content.rstrip()}\n{fence}"


def _table_cell(text: str) -> str:
    return neutralize_fences(text).replace("|", "\\|").replace("\r", " ").replace("\n", " ")


def _attempts_table(attempts: list[AttemptSummary]) -> str:
    rows = ["| Attempt | Result | Reason |", "| :-- | :-- | :-- |"]
    for a in attempts:
        reason = _table_cell(a.failure_reason or "")
        rows.append(f"| {a.attempt_number} | {_OUTCOME_LABEL[a.outcome]} | {reason} |")
    return "\n".join(rows)


def _verified_body(report: VerifiedFixReport, log_budget: int, collapse_diff: bool) -> str:
    files = len(report.diff.target_files)
    attempt = report.attempts[-1].attempt_number
    parts = [
        marker_line(report.job_id),
        "## ✅ Automated fix verified",
        "",
        f"**Root cause**: {neutralize_fences(report.diagnosis)}",
        "",
        "### Proposed change",
    ]
    if report.suggestion is not None:
        parts += [
            "A one-click suggestion with this change is attached to "
            f"`{report.suggestion.path}` in this pull request.",
            "",
        ]
    if collapse_diff:
        parts += [
            f"The diff ({files} file(s)) is too large to include here. "
            "The full diff is in the remediation audit record.",
        ]
    else:
        parts += [
            f"<details><summary>Unified diff ({files} file{'s' if files != 1 else ''})"
            "</summary>",
            "",
            _fenced(report.diff.unified_diff, "diff"),
            "",
            "</details>",
        ]
    if report.diff.commit_url:
        parts += ["", f"[View commit]({report.diff.commit_url})"]
    parts += [
        "",
        "### Verification",
        f"Sandbox tests passed in **{format_duration(report.duration_ms)}** "
        f"(attempt {attempt} of {MAX_ATTEMPTS})",
        "",
        "<details><summary>Test log</summary>",
        "",
        _fenced(truncate_log(report.test_log, log_budget), "text"),
        "",
        "</details>",
    ]
    return "\n".join(parts) + "\n"


def _no_change_body(report: NoChangeReport, log_budget: int) -> str:
    parts = [
        marker_line(report.job_id),
        "## ℹ️ No change needed",
        "",
        f"**Analysis**: {neutralize_fences(report.diagnosis)}",
        "",
        "The sandbox tests passed without modifying any code, so no fix is proposed.",
        f"Duration: **{format_duration(report.duration_ms)}**",
        "",
        "<details><summary>Test log</summary>",
        "",
        _fenced(truncate_log(report.test_log, log_budget), "text"),
        "",
        "</details>",
    ]
    return "\n".join(parts) + "\n"


def _failed_body(report: FailedReport) -> str:
    parts = [
        marker_line(report.job_id),
        "## ❌ Automated remediation could not verify a fix",
        "",
        f"**Root cause (best diagnosis)**: {neutralize_fences(report.diagnosis)}",
        "",
    ]
    if report.attempts:
        parts += [_attempts_table(report.attempts), ""]
    parts += [
        f"Total time spent: **{format_duration(report.duration_ms)}**.",
        "",
        "No change is proposed. Please fix this manually.",
    ]
    return "\n".join(parts) + "\n"


def render_comment(report: FeedbackReport) -> str:
    """Render the summary comment body, never exceeding the size budget.

    Truncation order: test log first, then the diff collapses to a note. The
    diagnosis, verdict, and duration are never truncated.
    """
    if isinstance(report, FailedReport):
        return _failed_body(report)

    budgets: list[tuple[int, bool]] = []
    budget = _INITIAL_LOG_BUDGET
    while budget >= _MIN_LOG_BUDGET:
        budgets.append((budget, False))
        budget //= 2
    budgets += [(_MIN_LOG_BUDGET, True), (0, True)]

    for log_budget, collapse_diff in budgets:
        if isinstance(report, VerifiedFixReport):
            body = _verified_body(report, log_budget, collapse_diff)
        else:
            body = _no_change_body(report, log_budget)
        if len(body) <= MAX_BODY_CHARS:
            return body
    raise ValueError("report cannot be rendered within the comment size limit")
