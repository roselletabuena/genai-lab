# Contract: GitHub API Usage and Comment Layout

## CLI contract (agent)

```text
remediation-agent format-comment --session <audit.json> --job-id <id> [--commit-url <url>] [--pr-files <files.json>] --output <report.json>
```

- Exit `0`: report written and valid against [feedback-report.schema.json](feedback-report.schema.json).
- Exit `2`: invalid or unreadable session input (message on stderr, no output file).

## Supervisor configuration

| Env var | Required | Purpose |
| :--- | :--- | :--- |
| `GITHUB_TOKEN` | For posting | `pull_requests: write`, `issues: write`. Absent means skip, audited as `no_credentials`. |
| `GITHUB_API_URL` | No | Defaults to `https://api.github.com`; overridden to the mock server in tests. |

## GitHub calls

| Step | Request | Notes |
| :--- | :--- | :--- |
| 1. PR state | `GET /repos/{o}/{r}/pulls/{n}` | `state != open` → skip (`pr_closed`) |
| 1b. Changed lines | `GET /repos/{o}/{r}/pulls/{n}/files?per_page=100` (paginate) | Parse each file's `patch` into right-side changed line ranges for suggestion eligibility. Missing `patch` or API error means no `suggestion`. |
| 2. Find existing | `GET /repos/{o}/{r}/issues/{n}/comments?per_page=100` (paginate) | Match body containing the marker |
| 3a. Create | `POST /repos/{o}/{r}/issues/{n}/comments` `{ "body": ... }` | |
| 3b. Update | `PATCH /repos/{o}/{r}/issues/comments/{id}` `{ "body": ... }` | |
| 4. Suggestion (optional) | `POST /repos/{o}/{r}/pulls/{n}/comments` `{ body, commit_id, path, start_line, line, side:"RIGHT" }` or `PATCH /repos/{o}/{r}/pulls/comments/{id}` | Only when `suggestion` present; marker `<!-- remediation-agent:pr-suggestion -->` |
| 5. Remove stale suggestion | `DELETE /repos/{o}/{r}/pulls/comments/{id}` | When an update's report has no `suggestion` or is `failed`, so a stale one-click change never outlives the run that produced it |

## Handoff (supervisor <-> agent)

All files live in the audit directory, keyed by job ID:

1. Supervisor writes `<job_id>.pr-files.json` (`{ "path": [[start,end], ...] }`) from step 1b.
2. Supervisor runs `remediation-agent format-comment --session <job_id>.session.json --job-id <job_id> --pr-files <job_id>.pr-files.json --output <job_id>.feedback.json`.
3. Supervisor loads `<job_id>.feedback.json`, validates it, and posts. A missing or invalid report is recorded as `skipped` with reason `no_report`.

Pushing fix commits is out of scope; `commit_url` is only populated when supplied by the caller.

Headers: `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, `User-Agent: genai-lab-remediation`.

## Marker

```html
<!-- remediation-agent:pr-feedback run=<job_id> -->
```

Appears exactly once, first line of the summary body.

## Summary layout: verified fix

```markdown
<!-- remediation-agent:pr-feedback run=abc123 -->
## ✅ Automated fix verified

**Root cause**: <diagnosis>

### Proposed change
<one-click suggestion note, if suggestion posted>
<details><summary>Unified diff (N files)</summary>

```diff
...
```
</details>
[View commit](url)   <!-- only if commit_url -->

### Verification
Sandbox tests passed in **12.4s** (attempt 2 of 3)
<details><summary>Test log</summary>

```text
...
```
</details>
```

## Summary layout: failed

```markdown
<!-- remediation-agent:pr-feedback run=abc123 -->
## ❌ Automated remediation could not verify a fix

**Root cause (best diagnosis)**: <diagnosis>

| Attempt | Result | Reason |
| :-- | :-- | :-- |
| 1 | Tests failed | ... |
| 2 | Patch did not apply | ... |
| 3 | Tests failed | ... |

No change is proposed. Please fix this manually.
```

The failed layout never contains a `diff` or `suggestion` fenced block or a commit link.

