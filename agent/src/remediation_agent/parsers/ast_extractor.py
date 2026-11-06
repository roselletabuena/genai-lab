"""Tree-sitter AST scope extractor for multi-language source trees."""

from pathlib import Path

import tree_sitter
import tree_sitter_go as tsgo
import tree_sitter_python as tspython
import tree_sitter_typescript as tstypescript

from remediation_agent.models.context import CodeContextScope, EnclosingScope


class ASTScopeExtractor:
    """Extracts enclosing structural scopes and imports from source code via Tree-sitter."""

    SCOPE_TYPES = {
        "python": {"function_definition", "class_definition"},
        "typescript": {
            "function_declaration",
            "method_definition",
            "arrow_function",
            "class_declaration",
            "lexical_declaration",
        },
        "go": {"function_declaration", "method_declaration", "type_declaration"},
    }

    IMPORT_TYPES = {
        "python": {"import_statement", "import_from_statement"},
        "typescript": {"import_statement"},
        "go": {"import_declaration"},
    }

    def __init__(self) -> None:
        self._parsers: dict[str, tree_sitter.Parser] = {}
        self._init_parsers()

    def _init_parsers(self) -> None:
        """Initialize language parsers for supported languages."""
        py_lang = tree_sitter.Language(tspython.language())
        ts_lang = tree_sitter.Language(tstypescript.language_typescript())
        go_lang = tree_sitter.Language(tsgo.language())

        self._parsers["python"] = tree_sitter.Parser(py_lang)
        self._parsers["typescript"] = tree_sitter.Parser(ts_lang)
        self._parsers["go"] = tree_sitter.Parser(go_lang)

    def _detect_language(self, file_path: str | Path) -> str | None:
        """Detect language identifier from file extension."""
        ext = Path(file_path).suffix.lower()
        if ext in {".py", ".pyw"}:
            return "python"
        elif ext in {".ts", ".tsx", ".js", ".jsx", ".mjs"}:
            return "typescript"
        elif ext in {".go"}:
            return "go"
        return None

    def extract(self, file_path: str | Path, line_number: int) -> CodeContextScope:
        """Parse source file and extract enclosing AST scopes around the 1-based line number."""
        path_obj = Path(file_path)
        if not path_obj.exists():
            raise FileNotFoundError(f"Source file not found: {file_path}")

        source_bytes = path_obj.read_bytes()
        source_text = source_bytes.decode("utf-8", errors="replace")
        lines = source_text.splitlines()

        lang = self._detect_language(path_obj)
        if not lang or lang not in self._parsers:
            # Fallback to bounded window around line if language is unsupported
            return self._fallback_scope(str(file_path), lines, line_number)

        parser = self._parsers[lang]
        tree = parser.parse(source_bytes)
        root = tree.root_node

        # 1. Collect top-level imports
        imports = self._extract_imports(root, source_bytes, lang)

        # 2. Locate node at line (0-based row)
        row = max(0, min(line_number - 1, len(lines) - 1))
        point = (row, 0)
        target_node = root.descendant_for_point_range(point, point)

        # 3. Walk up AST to find enclosing scopes
        enclosing_scopes = self._find_enclosing_scopes(target_node, source_bytes, lang)

        # 4. Construct bounded code representation
        surrounding_code = self._build_surrounding_code(lines, enclosing_scopes, line_number)

        return CodeContextScope(
            file_path=str(file_path),
            imports=imports,
            enclosing_scopes=enclosing_scopes,
            surrounding_code=surrounding_code,
        )

    def _extract_imports(
        self, root_node: tree_sitter.Node, source_bytes: bytes, lang: str
    ) -> list[str]:
        """Extract all top-level import declarations."""
        import_types = self.IMPORT_TYPES.get(lang, set())
        imports: list[str] = []

        for child in root_node.children:
            if child.type in import_types:
                text = source_bytes[child.start_byte : child.end_byte].decode(
                    "utf-8", errors="replace"
                )
                imports.append(text.strip())

        return imports

    def _find_enclosing_scopes(
        self, start_node: tree_sitter.Node | None, source_bytes: bytes, lang: str
    ) -> list[EnclosingScope]:
        """Traverse upwards to collect enclosing functions, methods, or classes."""
        scope_types = self.SCOPE_TYPES.get(lang, set())
        scopes: list[EnclosingScope] = []
        current = start_node

        while current:
            if current.type in scope_types:
                name = self._get_node_name(current, source_bytes)
                code = source_bytes[current.start_byte : current.end_byte].decode(
                    "utf-8", errors="replace"
                )
                scopes.append(
                    EnclosingScope(
                        scope_type=current.type,
                        name=name or current.type,
                        start_line=current.start_point[0] + 1,
                        end_line=current.end_point[0] + 1,
                        code=code,
                    )
                )
            current = current.parent

        return scopes

    def _get_node_name(self, node: tree_sitter.Node, source_bytes: bytes) -> str | None:
        """Extract identifier name from an AST node."""
        name_node = node.child_by_field_name("name")
        if name_node:
            return source_bytes[name_node.start_byte : name_node.end_byte].decode(
                "utf-8", errors="replace"
            )
        for child in node.children:
            if "identifier" in child.type or child.type == "name":
                return source_bytes[child.start_byte : child.end_byte].decode(
                    "utf-8", errors="replace"
                )
        return None

    def _build_surrounding_code(
        self, lines: list[str], scopes: list[EnclosingScope], target_line: int
    ) -> str:
        """Build surrounding code window, using innermost scope if present."""
        if scopes:
            # Innermost scope is scopes[0]
            return scopes[0].code
        # Fallback to +/- 15 lines around target
        start = max(0, target_line - 15)
        end = min(len(lines), target_line + 15)
        return "\n".join(lines[start:end])

    def _fallback_scope(
        self, file_path: str, lines: list[str], line_number: int
    ) -> CodeContextScope:
        """Fallback for non-parsed or unsupported file formats."""
        start = max(0, line_number - 15)
        end = min(len(lines), line_number + 15)
        code = "\n".join(lines[start:end])
        return CodeContextScope(
            file_path=file_path,
            imports=[],
            enclosing_scopes=[],
            surrounding_code=code,
        )
