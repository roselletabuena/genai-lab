# Research: Automated GitHub PR Feedback Comments

All Technical Context unknowns are resolved below.

## R1. Where does rendering vs posting live?

- **Decision**: Python renders Markdown from a validated `FeedbackReport`; Go posts it. The JSON report is the handoff.
- **Rationale**: The agent already owns `RemediationSession` (attempts, diffs, diagnostics, durations). The supervisor owns PR number, repo, audit directory, and runtime config. Matches the ticket note (Go supervisor plus Python formatter).
- **Alternatives**: Render in Go (would duplicate session knowledge); post from Python (would need PR credentials inside the sandboxed agent path).

## R2. Which GitHub endpoints and comment shapes?

- **Decision**:
  1. Summary comment via `POST /repos/{owner}/{repo}/issues/{pr}/comments` (and `PATCH /repos/{owner}/{repo}/issues/comments/{id}` for updates). Always posted.
  2. When the diff is eligible (single file, one contiguous hunk, within lines changed by the PR), also post a review comment with a ```` ```suggestion ```` block via `POST /repos/{owner}/{repo}/pulls/{pr}/comments` (`commit_id`, `path`, `line`, `side=RIGHT`), updated via `PATCH /repos/{owner}/{repo}/pulls/comments/{id}`.
  3. Otherwise the summary contains a collapsible ```` ```diff ```` block and, if the supervisor pushed a branch, a commit link.
- **Rationale**: Suggestion blocks are only applyable in PR review comments, not issue comments. The summary stays universal; the suggestion gives the one-click path (clarification Q1: C).
- **Alternatives**: Issue comment only (no one-click apply); review comment only (fails for multi-file diffs).

## R3. Idempotency and update-in-place (Q2: A)

- **Decision**: Embed a hidden marker `<!-- remediation-agent:pr-feedback -->` (plus `run=<job_id>` attribute) in the body. Upsert = list comments (paginated), find one authored with the marker, `PATCH` it, else `POST`. Same job ID reposted = no-op PATCH with identical body.
- When an update's report has no `suggestion` (or is `failed`), the existing suggestion review comment is deleted (`DELETE /pulls/comments/{id}`). A stale one-click change must never outlive a failed or ineligible run.
- **Rationale**: Stateless, survives daemon restarts, no duplicate comments, satisfies FR-010.
- **Alternatives**: Persist comment IDs locally (breaks across hosts); always create (violates Q2).

## R4. Authentication

- **Decision**: Fine-grained token read from `GITHUB_TOKEN` (needs `pull_requests: write` and `issues: write`). Fails closed: if absent, posting is skipped and recorded as `skipped: no_credentials` in audit. Token is never logged.
- **Rationale**: Simplest sanctioned path, consistent with other env-configured secrets. GitHub App auth can replace it later behind the same client interface.
- **Alternatives**: GitHub App installation tokens (more setup; deferred).

## R5. Comment size handling

- **Decision**: Hard limit 65,536 chars; budget 60,000. Truncate logs first (keep first 40% / last 60% of the log budget with a `… N lines truncated …` marker), then collapse the diff to a link if still too large. Diagnosis, verdict, and duration are exempt. Full log stays in the audit record.
- **Rationale**: Failures usually appear at the end of test output, hence the tail-heavy split.
- **Alternatives**: Gist upload (extra permission and surface); split into multiple comments (breaks update-in-place).

## R6. Secret redaction

- **Decision**: Regex-based scrubbing in Python (`GITHUB_TOKEN` patterns `gh[pousr]_…`, `github_pat_…`, AWS access keys `AKIA…`, bearer tokens, `KEY=value` style env assignments for names containing `SECRET|TOKEN|PASSWORD|KEY`), plus a second pass in Go before sending. Replace with `[REDACTED]`.
- **Rationale**: Defense in depth; comments are public to repo readers.
- **Alternatives**: Redact only at one layer (single point of failure).

## R7. Retry and rate limiting

- **Decision**: Up to 4 attempts, exponential backoff (1 s, 2 s, 4 s) with jitter on 5xx and network errors. On 403/429 with `Retry-After` or `X-RateLimit-Reset`, wait the indicated time if at most 60 s, else give up and record. 401/403 without rate-limit headers and 404 are non-retryable.
- **Rationale**: Bounded delay keeps worker slots from stalling; non-retryable failures are recorded not retried indefinitely (spec edge case).

## R8. Skip when PR is not open

- **Decision**: `GET /repos/{owner}/{repo}/pulls/{pr}` before posting; if `state != open`, skip and audit `skipped: pr_closed`.

## R9. Failure-path safety

- **Decision**: `FeedbackReport` is a discriminated union: `VerifiedFix` has `diff`, `FailedRemediation` has no diff field at all. Renderer is typed per variant, so a failure comment cannot contain a diff.
- **Rationale**: Enforces FR-006/FR-007 structurally rather than by convention.

