"""Build a FeedbackReport from a finished RemediationSession."""

import re

from remediation_agent.models.diagnostics import SandboxRunResult
from remediation_agent.models.session import (
    AttemptStatus,
    RemediationAttempt,
    RemediationSession,
    SessionFinalStatus,
)
from remediation_agent.reporting.models import (
    AttemptOutcome,
    AttemptSummary,
    FailedReport,
    NoChangeReport,
    SuggestionSpec,
    VerifiedDiff,
    VerifiedFixReport,
)
from remediation_agent.reporting.redaction import redact
from remediation_agent.reporting.renderer import marker_line, render_comment

_HUNK_HEADER = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")
_MAX_DIAGNOSIS = 4000
_MAX_REASON = 500

LineRanges = dict[str, list[list[int]]]


def _outcome(attempt: RemediationAttempt) -> AttemptOutcome:
    if attempt.status == AttemptStatus.VERIFIED_SUCCESS:
        return AttemptOutcome.VERIFIED_SUCCESS
    if attempt.status == AttemptStatus.FAILED_TO_APPLY:
        return AttemptOutcome.FAILED_TO_APPLY
    return AttemptOutcome.VERIFIED_FAILURE


def _failure_reason(attempt: RemediationAttempt) -> str | None:
    outcome = _outcome(attempt)
    if outcome == AttemptOutcome.VERIFIED_SUCCESS:
        return None
    if outcome == AttemptOutcome.FAILED_TO_APPLY:
        reason = (attempt.patch.apply_error if attempt.patch else None) or (
            "the generated patch could not be applied"
        )
    elif attempt.diagnostics:
        d = attempt.diagnostics[0]
        reason = f"{d.error_type} at {d.file_path}:{d.line_number}: {d.message}"
    elif attempt.test_result and (attempt.test_result.stderr or attempt.test_result.error):
        reason = _last_line(attempt.test_result.error or attempt.test_result.stderr)
    else:
        reason = f"attempt ended in status {attempt.status.value}"
    return redact(reason)[:_MAX_REASON]


def _last_line(text: str) -> str:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return lines[-1] if lines else text.strip()


def _diagnosis(session: RemediationSession) -> str:
    diagnostics = [d for a in session.attempts for d in a.diagnostics]
    if diagnostics:
        seen: set[tuple[str, int, str]] = set()
        lines: list[str] = []
        for d in diagnostics:
            key = (d.file_path, d.line_number, d.message)
            if key in seen:
                continue
            seen.add(key)
            lines.append(f"{d.error_type} in `{d.file_path}:{d.line_number}`: {d.message}")
            if len(lines) == 3:
                break
        text = "; ".join(lines)
    else:
        failure = session.initial_failure
        detail = failure.error or _last_line(failure.stderr or failure.stdout)
        text = f"Tests failed with exit code {failure.exit_code}" + (
            f": {detail}" if detail else ""
        )
    if session.final_status == SessionFinalStatus.ERROR:
        text = f"Remediation ended with an internal error. {text}"
    return redact(text)[:_MAX_DIAGNOSIS] or "Test failure (no details available)"


def _log_of(result: SandboxRunResult | None) -> str:
    if result is None:
        return ""
    return redact("\n".join(p for p in (result.stdout, result.stderr) if p))


def _total_duration(session: RemediationSession) -> int:
    return sum(a.duration_ms for a in session.attempts)


def _parse_files(diff_text: str) -> list[str]:
    return [m.group(1) for m in re.finditer(r"^\+\+\+ b/(.+?)\s*$", diff_text, re.MULTILINE)]


def _within(path_ranges: list[list[int]], start: int, end: int) -> bool:
    return all(any(lo <= n <= hi for lo, hi in path_ranges) for n in range(start, end + 1))


def build_suggestion(diff_text: str, pr_changed_lines: LineRanges | None) -> SuggestionSpec | None:
    """Return a suggestion only for one file, one contiguous hunk, inside PR-changed lines."""
    if not pr_changed_lines:
        return None
    files = _parse_files(diff_text)
    if len(files) != 1:
        return None
    path = files[0]
    lines = diff_text.splitlines()
    hunk_starts = [i for i, ln in enumerate(lines) if ln.startswith("@@ ")]
    if len(hunk_starts) != 1:
        return None
    header = _HUNK_HEADER.match(lines[hunk_starts[0]])
    if header is None:
        return None
    old_start = int(header.group(1))
    body = lines[hunk_starts[0] + 1 :]

    # Trim surrounding context so the range covers only lines the diff touches.
    while body and body[0].startswith(" "):
        body.pop(0)
        old_start += 1
    while body and body[-1].startswith(" "):
        body.pop()
    old_lines = [ln for ln in body if ln.startswith(("-", " "))]
    new_lines = [ln[1:] for ln in body if ln.startswith(("+", " "))]
    if not old_lines:  # pure insertion has no anchor line for a suggestion
        return None
    end = old_start + len(old_lines) - 1
    if not _within(pr_changed_lines.get(path, []), old_start, end):
        return None
    return SuggestionSpec(
        path=path, start_line=old_start, line=end, replacement="\n".join(new_lines)
    )


def build_feedback_report(
    session: RemediationSession,
    job_id: str,
    commit_url: str | None = None,
    pr_changed_lines: LineRanges | None = None,
) -> VerifiedFixReport | NoChangeReport | FailedReport:
    """Convert a finished session into a validated, rendered feedback report."""
    attempts = [
        AttemptSummary(
            attempt_number=a.attempt_number,
            outcome=_outcome(a),
            failure_reason=_failure_reason(a),
            duration_ms=a.duration_ms,
        )
        for a in session.attempts
    ]
    common = {
        "job_id": job_id,
        "session_id": session.session_id,
        "diagnosis": _diagnosis(session),
        "duration_ms": _total_duration(session),
        "attempts": attempts,
        "markdown_body": marker_line(job_id),
    }

    winner = next(
        (a for a in session.attempts if a.status == AttemptStatus.VERIFIED_SUCCESS), None
    )
    if session.final_status == SessionFinalStatus.RESOLVED and winner is not None:
        log = _log_of(winner.test_result)
        diff_text = winner.patch.diff_text if winner.patch else ""
        if not diff_text.strip():
            report: VerifiedFixReport | NoChangeReport | FailedReport = NoChangeReport(
                **common, test_log=log
            )
        else:
            diff_text = redact(diff_text)
            suggestion = build_suggestion(diff_text, pr_changed_lines)
            report = VerifiedFixReport(
                **common,
                test_log=log,
                diff=VerifiedDiff(
                    unified_diff=diff_text,
                    target_files=list(winner.patch.target_files) if winner.patch else [],
                    commit_url=commit_url,
                ),
                suggestion=suggestion,
            )
    else:
        report = FailedReport(**common)

    return report.model_copy(update={"markdown_body": render_comment(report)})
