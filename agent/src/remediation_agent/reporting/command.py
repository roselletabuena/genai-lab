"""`format-comment` command: session audit JSON -> validated FeedbackReport JSON."""

import argparse
import json
import sys
from pathlib import Path

from pydantic import ValidationError

from remediation_agent.models.session import RemediationSession
from remediation_agent.reporting.builder import LineRanges, build_feedback_report

EXIT_OK = 0
EXIT_INVALID_INPUT = 2


def add_format_comment_parser(subparsers: "argparse._SubParsersAction") -> None:
    """Register the ``format-comment`` subcommand."""
    p = subparsers.add_parser(
        "format-comment", help="Render a remediation session as a pull request comment report"
    )
    p.add_argument("--session", required=True, help="Path to remediation session audit JSON")
    p.add_argument("--job-id", required=True, help="Supervisor job ID (used for idempotency)")
    p.add_argument("--commit-url", help="Optional URL of an existing fix commit")
    p.add_argument("--pr-files", help="Path to JSON of PR changed line ranges per file")
    p.add_argument("--output", required=True, help="Path to write the FeedbackReport JSON")


def _load_ranges(path: str | None) -> LineRanges | None:
    if not path:
        return None
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("pr-files JSON must be an object mapping path to [[start, end], ...]")
    ranges: LineRanges = {}
    for file_path, spans in data.items():
        ranges[file_path] = [[int(lo), int(hi)] for lo, hi in spans]
    return ranges


def handle_format_comment(args: argparse.Namespace) -> int:
    """Write the report to ``--output``; exit 2 with no output file on invalid input."""
    try:
        session = RemediationSession.model_validate_json(
            Path(args.session).read_text(encoding="utf-8")
        )
        ranges = _load_ranges(args.pr_files)
        report = build_feedback_report(
            session,
            job_id=args.job_id,
            commit_url=args.commit_url,
            pr_changed_lines=ranges,
        )
    except (OSError, ValueError, ValidationError, TypeError) as e:
        print(f"Error: cannot format comment: {e}", file=sys.stderr)
        return EXIT_INVALID_INPUT

    Path(args.output).write_text(report.model_dump_json(indent=2), encoding="utf-8")
    return EXIT_OK
