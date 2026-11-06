"""Shared pytest fixtures and test setup."""

import json
from pathlib import Path

import pytest


@pytest.fixture
def fixtures_dir() -> Path:
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_failure_envelope(fixtures_dir: Path) -> dict:
    envelope_file = fixtures_dir / "sample_failure_envelope.json"
    with open(envelope_file, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def sample_diff_text(fixtures_dir: Path) -> str:
    diff_file = fixtures_dir / "sample_diff.patch"
    with open(diff_file, encoding="utf-8") as f:
        return f.read()
