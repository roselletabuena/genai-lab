"""Command-line interface for the autonomous remediation agent."""

import argparse
import json
import os
import sys
from pathlib import Path

from remediation_agent.llm.bedrock_client import BedrockConverseClient
from remediation_agent.llm.mock_client import MockBedrockClient
from remediation_agent.models.diagnostics import SandboxRunResult
from remediation_agent.models.session import SessionFinalStatus
from remediation_agent.orchestrator.loop import RemediationLoop
from remediation_agent.orchestrator.sandbox_client import SubprocessSandboxRunner
from remediation_agent.parsers.ast_extractor import ASTScopeExtractor
from remediation_agent.parsers.test_log_parser import TestLogParser
from remediation_agent.reporting.command import add_format_comment_parser, handle_format_comment

# Exit codes conforming to contracts/cli-contract.md
EXIT_RESOLVED = 0
EXIT_EXHAUSTED = 1
EXIT_INVALID_INPUT = 2
EXIT_PARSER_ERROR = 3
EXIT_LLM_ERROR = 4


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="remediation-agent",
        description="Autonomous Tree-sitter AST diagnostic & patch synthesis agent",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcommand: run
    run_parser = subparsers.add_parser("run", help="Orchestrate full remediation loop")
    run_parser.add_argument("--repo", default=".", help="Repository root path to remediate")
    run_parser.add_argument("--cmd", required=True, help="Test command to execute")
    run_parser.add_argument("--initial-failure", help="Path to initial RunResult JSON envelope")
    run_parser.add_argument("--max-attempts", type=int, default=3, help="Max retry attempts (1..3)")
    run_parser.add_argument(
        "--model-id",
        default="anthropic.claude-3-5-sonnet-20241022-v2:0",
        help="AWS Bedrock model ID",
    )
    run_parser.add_argument(
        "--mock-llm",
        action="store_true",
        default=os.environ.get("MOCK_LLM", "").strip().lower() in ("true", "1", "yes"),
        help="Use deterministic mock LLM provider (offline mode; or env MOCK_LLM=true)",
    )
    run_parser.add_argument(
        "--output-log",
        default="remediation-audit.json",
        help="Path to export session audit log JSON",
    )
    run_parser.add_argument(
        "--sandbox-bin",
        default="sandbox-runner",
        help="Path to sandbox-runner executable",
    )

    # Subcommand: diagnose
    diag_parser = subparsers.add_parser(
        "diagnose", help="Parse failure logs and extract AST scopes without applying patches"
    )
    diag_parser.add_argument("--input", required=True, help="Path to test failure JSON envelope")
    diag_parser.add_argument("--repo", default=".", help="Repository root path")
    diag_parser.add_argument("--format", choices=["json", "text"], default="json")

    # Subcommand: format-comment
    add_format_comment_parser(subparsers)

    return parser


def handle_diagnose(args: argparse.Namespace) -> int:
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: input failure file not found: {args.input}", file=sys.stderr)
        return EXIT_INVALID_INPUT

    try:
        data = json.loads(input_path.read_text(encoding="utf-8"))
        envelope = SandboxRunResult(**data)
    except Exception as e:
        print(f"Error parsing failure JSON envelope: {e}", file=sys.stderr)
        return EXIT_INVALID_INPUT

    parser = TestLogParser()
    extractor = ASTScopeExtractor()
    repo_root = Path(args.repo).resolve()

    diagnostics = parser.parse(envelope)
    if not diagnostics:
        print("No failing assertion diagnostics found in log.", file=sys.stderr)
        return EXIT_PARSER_ERROR

    results = []
    for d in diagnostics:
        target_file = repo_root / d.file_path
        scope_data = None
        if target_file.exists():
            try:
                scope = extractor.extract(target_file, d.line_number)
                scope_data = scope.model_dump()
            except Exception as e:
                scope_data = {"error": str(e)}

        results.append(
            {
                "diagnostic": d.model_dump(),
                "ast_scope": scope_data,
            }
        )

    if args.format == "json":
        print(json.dumps(results, indent=2))
    else:
        for r in results:
            d = r["diagnostic"]
            print(f"FAILURE: {d['file_path']}:{d['line_number']} [{d['error_type']}]")
            print(f"  Message: {d['message']}")
            if r["ast_scope"]:
                print(f"  Enclosing Scopes: {len(r['ast_scope'].get('enclosing_scopes', []))}")

    return EXIT_RESOLVED


def handle_run(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo).resolve()
    initial_failure = None

    if args.initial_failure:
        init_file = Path(args.initial_failure)
        if not init_file.exists():
            print(f"Error: initial failure file not found: {args.initial_failure}", file=sys.stderr)
            return EXIT_INVALID_INPUT
        try:
            data = json.loads(init_file.read_text(encoding="utf-8"))
            initial_failure = SandboxRunResult(**data)
        except Exception as e:
            print(f"Error reading initial failure JSON: {e}", file=sys.stderr)
            return EXIT_INVALID_INPUT

    if args.mock_llm:
        llm = MockBedrockClient()
    else:
        try:
            llm = BedrockConverseClient(model_id=args.model_id)
        except Exception as e:
            print(f"Error initializing AWS Bedrock client: {e}", file=sys.stderr)
            return EXIT_LLM_ERROR

    sandbox = SubprocessSandboxRunner(
        repo_path=repo_root,
        sandbox_bin=args.sandbox_bin,
    )

    loop = RemediationLoop(
        repo_root=repo_root,
        test_command=args.cmd,
        llm_provider=llm,
        sandbox_runner=sandbox,
        max_attempts=args.max_attempts,
        output_log_path=args.output_log,
    )

    try:
        session = loop.run(initial_failure=initial_failure)
    except Exception as e:
        print(f"Remediation loop execution error: {e}", file=sys.stderr)
        return EXIT_LLM_ERROR

    if session.final_status == SessionFinalStatus.RESOLVED:
        print(f"[SUCCESS] Test failures resolved in {len(session.attempts)} attempt(s).")
        return EXIT_RESOLVED
    else:
        print(
            f"[EXHAUSTED] Test failures persisted after {len(session.attempts)} attempt(s). Workspace rolled back: {session.rolled_back}",
            file=sys.stderr,
        )
        return EXIT_EXHAUSTED


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "diagnose":
        sys.exit(handle_diagnose(args))
    elif args.command == "run":
        sys.exit(handle_run(args))
    elif args.command == "format-comment":
        sys.exit(handle_format_comment(args))
    else:
        parser.print_help()
        sys.exit(EXIT_INVALID_INPUT)


if __name__ == "__main__":
    main()

