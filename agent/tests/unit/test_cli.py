"""Unit tests for remediation agent CLI."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from remediation_agent.cli import (
    EXIT_INVALID_INPUT,
    EXIT_RESOLVED,
    build_parser,
    handle_diagnose,
    handle_format_comment,
    handle_run,
)
from remediation_agent.models import SessionFinalStatus


def test_cli_parser_build():
    parser = build_parser()
    args = parser.parse_args(["run", "--cmd", "pytest", "--mock-llm"])
    assert args.command == "run"
    assert args.cmd == "pytest"
    assert args.mock_llm is True


def test_cli_parser_mock_llm_from_env(monkeypatch):
    monkeypatch.setenv("MOCK_LLM", "true")
    parser = build_parser()
    args = parser.parse_args(["run", "--cmd", "pytest"])
    assert args.mock_llm is True


def test_cli_diagnose_success(fixtures_dir: Path):
    parser = build_parser()
    failure_json = fixtures_dir / "sample_failure_envelope.json"
    args = parser.parse_args(
        ["diagnose", "--input", str(failure_json), "--repo", str(fixtures_dir)]
    )
    exit_code = handle_diagnose(args)
    assert exit_code == EXIT_RESOLVED


def test_cli_diagnose_file_not_found(tmp_path: Path):
    parser = build_parser()
    args = parser.parse_args(
        ["diagnose", "--input", str(tmp_path / "nonexistent.json"), "--repo", str(tmp_path)]
    )
    exit_code = handle_diagnose(args)
    assert exit_code == EXIT_INVALID_INPUT


def test_cli_run_mock_success(tmp_path: Path):
    parser = build_parser()
    log_file = tmp_path / "audit.json"
    args = parser.parse_args(
        [
            "run",
            "--cmd",
            "pytest",
            "--repo",
            str(tmp_path),
            "--mock-llm",
            "--output-log",
            str(log_file),
        ]
    )

    with patch("remediation_agent.cli.RemediationLoop") as mock_loop_cls:
        mock_loop = MagicMock()
        mock_session = MagicMock()
        mock_session.final_status = SessionFinalStatus.RESOLVED
        mock_session.attempts = [MagicMock()]
        mock_loop.run.return_value = mock_session
        mock_loop_cls.return_value = mock_loop

        exit_code = handle_run(args)
        assert exit_code == EXIT_RESOLVED


def test_cli_format_comment_success(fixtures_dir: Path, tmp_path: Path):
    parser = build_parser()
    session_file = fixtures_dir / "feedback" / "resolved_session.json"
    pr_files = tmp_path / "pr-files.json"
    pr_files.write_text(json.dumps({"src/math_utils.py": [[5, 12]]}), encoding="utf-8")
    out_file = tmp_path / "report.json"

    args = parser.parse_args(
        [
            "format-comment",
            "--session",
            str(session_file),
            "--job-id",
            "job-cli-1",
            "--pr-files",
            str(pr_files),
            "--output",
            str(out_file),
        ]
    )
    exit_code = handle_format_comment(args)
    assert exit_code == EXIT_RESOLVED
    assert out_file.exists()
    data = json.loads(out_file.read_text(encoding="utf-8"))
    assert data["verdict"] == "verified_fix"
    assert data["job_id"] == "job-cli-1"
    assert data["suggestion"]["path"] == "src/math_utils.py"


def test_cli_format_comment_invalid_input(tmp_path: Path, capsys):
    parser = build_parser()
    out_file = tmp_path / "should-not-exist.json"
    args = parser.parse_args(
        [
            "format-comment",
            "--session",
            str(tmp_path / "missing.json"),
            "--job-id",
            "job-cli-2",
            "--output",
            str(out_file),
        ]
    )
    exit_code = handle_format_comment(args)
    assert exit_code == EXIT_INVALID_INPUT
    assert not out_file.exists()
    captured = capsys.readouterr()
    assert "cannot format comment" in captured.err

