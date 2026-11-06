# Quickstart: Validating PR Feedback Comments

Run from the repo root inside the feature worktree. Contracts: [feedback-report.schema.json](contracts/feedback-report.schema.json), [github-api-contract.md](contracts/github-api-contract.md). Entities: [data-model.md](data-model.md).

## Prerequisites

- Python 3.12+ with the agent installed (`cd agent; pip install -e ".[dev]"`)
- Go 1.22+
- No GitHub credentials needed; tests use a mock server

## 1. Agent formatter

```powershell
cd agent
pytest tests/unit -k reporting -v
pytest tests/unit/test_cli.py -k format_comment -v
```

Expected: golden Markdown tests pass for verified (single file, multi file) and failed sessions; redaction and truncation tests pass; failed reports contain no `diff` or `suggestion` fence.

## 2. Render a report from a sample session

```powershell
remediation-agent format-comment --session tests/fixtures/feedback/resolved_session.json --job-id job-1 --output report.json
```

Expected: exit 0; `report.json` validates against the schema; `verdict` is `verified_fix`; `markdown_body` has diagnosis, diff, test log and duration.

## 3. Go GitHub client

```powershell
cd sandbox-runner
go test -race ./pkg/github/... ./pkg/supervisor/... ./pkg/audit/...
```

Expected: create on first post, update on second post (no duplicate), retry on 502, backoff on rate limit, skip for closed PR and missing token, audit record contains `feedback` outcome.

## 4. End-to-end (mocked GitHub)

```powershell
cd sandbox-runner
go test -race -run TestEndToEndFeedback ./pkg/supervisor
```

Expected: a completed job with a `verified_fix` report produces one summary comment (and one suggestion comment when eligible); an exhausted job produces one failure comment with no code proposal.

## 4b. Manual check (SC-003)

On a scratch repository with a test PR and a real token, post a single-file verified fix and confirm the suggestion shows a **Commit suggestion** button that applies the change in one action. Then re-run with a failed result and confirm the suggestion comment is gone and the summary shows no code.

## 5. Repo quality gate

```powershell
npm run verify
cd agent; ruff check .; cd ..\sandbox-runner; go vet ./...
```

Expected: all exit 0.

