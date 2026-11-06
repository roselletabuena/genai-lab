# CLI Contract: Remediation Agent CLI

**Binary / Command**: `remediation-agent` (or `python -m remediation_agent.cli`)  
**Feature**: `001-ast-patch-synthesis`  

---

## 1. Synopsis

```bash
remediation-agent run [OPTIONS] --repo <PATH> --cmd "<TEST_COMMAND>"
remediation-agent diagnose [OPTIONS] --input <SANDBOX_JSON_FILE>
```

---

## 2. Global & Subcommand Flags

### `remediation-agent run`

Orchestrates the full multi-attempt remediation loop: executes tests (or accepts initial failure), extracts AST scopes, prompts the LLM for unified diffs, applies patches, and iterates up to 3 attempts.

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--repo` | Path (required) | `.` | Target repository path to remediate |
| `--cmd` | String (required) | None | Test command to execute (e.g. `npm test` or `go test ./...`) |
| `--initial-failure` | Path | None | Path to pre-existing `RunResult` JSON file (skips initial test run) |
| `--max-attempts` | Integer | `3` | Maximum remediation iterations before terminating (hard limit: 3) |
| `--model-id` | String | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Bedrock model identifier |
| `--mock-llm` | Boolean | `false` | Run with deterministic mock LLM provider (for CI and offline tests) |
| `--output-log` | Path | `remediation-audit.json` | Path to export session audit log JSON |
| `--sandbox-bin` | Path | `sandbox-runner` | Path to sandbox-runner executable |

### `remediation-agent diagnose`

Standalone utility to parse a failure envelope and print extracted AST diagnostic scopes without invoking LLMs or modifying files.

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--input` | Path (required) | None | Path to sandbox `RunResult` JSON file |
| `--repo` | Path | `.` | Target repository path to locate source files |
| `--format` | Choice | `json` | Output format: `json` or `text` |

---

## 3. Process Exit Codes

| Exit Code | Constant | Meaning |
| :--- | :--- | :--- |
| `0` | `EXIT_RESOLVED` | Test suite passed; remediation succeeded. Patches committed or retained in worktree. |
| `1` | `EXIT_EXHAUSTED` | Test suite still failing after 3 attempts. Workspace cleanly rolled back to initial commit. |
| `2` | `EXIT_INVALID_INPUT` | Invalid CLI arguments, missing repository path, or malformed input JSON. |
| `3` | `EXIT_PARSER_ERROR` | Unable to locate or parse failing source files with Tree-sitter. |
| `4` | `EXIT_LLM_ERROR` | Unrecoverable Bedrock client authentication, rate limit, or network failure. |

