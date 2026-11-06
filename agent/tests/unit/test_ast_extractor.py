"""Unit tests for ASTScopeExtractor."""

from pathlib import Path

from remediation_agent.parsers.ast_extractor import ASTScopeExtractor


def test_extract_python_enclosing_function(fixtures_dir: Path):
    target_file = fixtures_dir / "sample_target.py"
    extractor = ASTScopeExtractor()

    # Line 7 is inside add_numbers function
    scope = extractor.extract(target_file, line_number=7)

    assert scope.file_path == str(target_file)
    assert any("import math" in imp for imp in scope.imports)
    assert any("from typing import List" in imp for imp in scope.imports)

    assert len(scope.enclosing_scopes) >= 1
    enc = scope.enclosing_scopes[0]
    assert enc.name == "add_numbers"
    assert "def add_numbers" in enc.code
    assert enc.start_line <= 7 <= enc.end_line


def test_extract_python_enclosing_class_method(fixtures_dir: Path):
    target_file = fixtures_dir / "sample_target.py"
    extractor = ASTScopeExtractor()

    # Line 17 is inside Calculator.multiply method
    scope = extractor.extract(target_file, line_number=17)

    names = [s.name for s in scope.enclosing_scopes]
    assert "multiply" in names or "Calculator" in names
    assert any("multiply" in s.code for s in scope.enclosing_scopes)


def test_extract_typescript_enclosing_function(fixtures_dir: Path):
    target_file = fixtures_dir / "sample_target.ts"
    extractor = ASTScopeExtractor()

    # Line 7 is inside calculateTotal function
    scope = extractor.extract(target_file, line_number=7)

    assert any("formatCurrency" in imp for imp in scope.imports)
    assert len(scope.enclosing_scopes) >= 1
    enc = scope.enclosing_scopes[0]
    assert enc.name == "calculateTotal"
    assert "function calculateTotal" in enc.code
