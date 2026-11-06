# Implementation Plan: Automated GitHub PR Feedback Comments

**Branch**: `feat/GL-56-pr-feedback-comments` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-pr-feedback-comments/spec.md` (Jira [GL-56](https://the-three-devsketeers.atlassian.net/browse/GL-56))

---

## Summary

Close the remediation loop by reporting results back to the pull request. The Python agent (`agent/`) gains a pure `reporting` package that turns a finished `RemediationSession` into a validated **FeedbackReport** (diagnosis, verified diff, test log, duration, attempt history, verdict) rendered as GitHub-flavored Markdown, exposed through a new `format-comment` CLI command. The Go supervisor (`sandbox-runner/`) gains a `pkg/github` client that upserts a single marker-tagged summary comment per PR through the REST API (retry with backoff, rate-limit aware, idempotent), plus an optional one-click suggestion review comment when the diff fits. Posting outcomes are written into the existing audit record.

---

## Technical Context

**Language/Version**: Python 3.12+ (agent formatter), Go 1.22+ (supervisor GitHub client, co-located in `sandbox-runner` module)

**Primary Dependencies**:
- Python: `pydantic` v2 (already used for models), standard library only for rendering and redaction
- Go: standard library `net/http`, `encoding/json`, `context`, `regexp`; no new third-party modules
- Existing: `remediation_agent.models.session`, `sandbox-runner/pkg/audit`, `pkg/supervisor`

**Storage**: Local filesystem only. Extends the JSON audit record with a `feedback` block. GitHub comment ID is discovered by marker search, so no new persistent store.

**Testing**: `pytest` (formatter unit tests, golden Markdown fixtures, CLI test); `go test -race ./...` with `httptest.Server` as the GitHub boundary mock

**Target Platform**: Cross-platform Linux / macOS / Windows (same as specs 001 and 002)

**Project Type**: Two cooperating components (Python CLI library + Go daemon package) joined by a JSON contract

**Performance Goals**:
- Comment visible within 30 s of run completion (SC-004)
- Rendering under 50 ms for a maximum-size report

**Constraints**:
- Comment body at most 65,536 characters; renderer budgets to 60,000 with logs truncated head/tail first, never the diagnosis, verdict, or duration
- Secrets redacted before the report leaves the agent (and re-checked in Go before posting)
- Failure reports MUST NOT contain a diff, suggestion block, or commit link (type-enforced)
- GitHub token supplied by environment variable, never logged or committed; document in `.env.example`-style docs
- Fully testable offline with a mocked GitHub server

**Scale/Scope**: One summary comment (plus at most one suggestion review comment) per PR; up to 3 attempts per report

---

## Constitution Check

*GATE: Verified before Phase 0 research and re-validated after Phase 1 design.*

| Principle | Requirement | Plan Compliance | Status |
| :--- | :--- | :--- | :---: |
| **I. TDD at Public Seams** | Red-green-refactor at public seams; boundary mocks only | Tests target `build_feedback_report`, `render_comment`, `github.Client.UpsertComment`; only the GitHub HTTP boundary is mocked (`httptest`). | **PASS** |
| **II. Worktree Isolation** | Dedicated worktree off `origin/main` | Implementation in `.worktrees/feat-GL-56-pr-feedback-comments`. | **PASS** |
| **III. Strict Schema Validation** | Strong schemas at boundaries | `FeedbackReport` validated by pydantic and by a JSON Schema contract; Go decodes into typed structs with `DisallowUnknownFields` and size caps. | **PASS** |
| **IV. Atomic Commits** | Conventional commits with `[GL-56]` | Units: report models, redaction/truncation, renderer, CLI, Go client, supervisor wiring, audit extension. | **PASS** |
| **V. Cloud & Local Parity** | No live credentials for integration runs | All tests use mock GitHub server; live posting only when `GITHUB_TOKEN` is set. | **PASS** |

*All gates pass; no complexity violations.*

---

## Project Structure

### Documentation (this feature)

```text
specs/003-pr-feedback-comments/
├── spec.md
├── plan.md                         # This file
├── research.md                     # Phase 0 decisions
├── data-model.md                   # Phase 1 entities and state
├── quickstart.md                   # Phase 1 validation guide
├── contracts/
│   ├── feedback-report.schema.json # Agent -> supervisor result contract (FR-014)
│   └── github-api-contract.md      # GitHub calls, marker format, comment layout
├── checklists/requirements.md
└── tasks.md                        # Created by /speckit-tasks
```

### Source Code (repository root)

```text
agent/
├── src/remediation_agent/
│   ├── reporting/                  # NEW
│   │   ├── __init__.py
│   │   ├── models.py               # FeedbackReport, AttemptSummary, Verdict
│   │   ├── builder.py              # RemediationSession -> FeedbackReport
│   │   ├── redaction.py            # secret scrubbing
│   │   ├── truncation.py           # head/tail log budgeting
│   │   └── renderer.py             # FeedbackReport -> Markdown (+ suggestion eligibility)
│   └── cli.py                      # + `format-comment` subcommand
└── tests/
    ├── unit/test_reporting_*.py
    └── fixtures/feedback/          # golden .md and .json files

sandbox-runner/
├── pkg/github/                     # NEW
│   ├── client.go                   # REST client, auth, retry/backoff, rate limits
│   ├── comment.go                  # marker, upsert (list -> create or patch)
│   ├── report.go                   # typed FeedbackReport decode + validation
│   └── *_test.go                   # httptest-based
├── pkg/supervisor/supervisor.go    # call commenter after job completion
└── pkg/audit/audit.go              # + Feedback outcome fields
```

**Structure Decision**: Extend the two existing components rather than add a new service. Rendering lives in Python (it owns diagnosis, diff, and attempt data); network posting lives in Go (it owns PR identity, credentials, retries, and the audit record). The JSON `FeedbackReport` is the only coupling.

---

## Complexity Tracking

No constitution violations to justify.

## Notes and Deviations

- The Jira technical note names the issue-comments endpoint. That endpoint cannot render one-click suggestions (only pull request review comments can), so the design uses the issues endpoint for the always-present summary and the pull request review comments endpoint for the optional suggestion. See [research.md](research.md) R2.
