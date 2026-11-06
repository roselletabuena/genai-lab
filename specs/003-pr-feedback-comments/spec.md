# Feature Specification: Automated GitHub PR Feedback Comments

**Feature Branch**: `feat/GL-56-pr-feedback-comments` (Spec: `003-pr-feedback-comments`)  
**Created**: 2026-11-07  
**Status**: Draft  
**Input**: User description: "https://the-three-devsketeers.atlassian.net/browse/GL-56: 1.4 FS [Integration] Automate GitHub PR feedback comments with unified diffs and verification logs"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Verified Fix Posted to the Pull Request (Priority: P1)

As a pull request author and reviewer,  
I want the remediation system to post a formatted comment on the pull request containing the diagnosed failure, the verified unified diff, and proof of the passing test run,  
so that I can review and apply the fix with a single click.

**Why this priority**: This is the end-to-end deliverable of the remediation pipeline. Without it, a verified fix is invisible to the people who need it.

**Independent Test**: Feed a successful remediation result (diagnosis, diff, passing test log, duration) for a pull request and verify exactly one structured comment appears on that pull request with all three required sections.

**Acceptance Scenarios**:

1. **Given** a remediation run whose tests passed in the sandbox, **When** the run completes, **Then** a structured comment is posted on the originating pull request.
2. **Given** the posted comment, **When** a reviewer reads it, **Then** it contains (1) a root-cause diagnosis, (2) the unified diff presented so it can be applied in one click or reached via a commit link, and (3) the sandbox test pass log with the execution duration.
3. **Given** a diff that touches multiple files or lines outside the pull request's changed lines, **When** the comment is built, **Then** the fix is still presented in a reviewable form (not silently dropped or truncated).

---

### User Story 2 - Informative Failure Report Without Broken Code (Priority: P2)

As a pull request author,  
I want a clear comment when the system could not produce a verified fix,  
so that I know automated remediation was attempted, why it failed, and that I must fix it manually.

**Why this priority**: Silence on failure looks like the system did nothing. Proposing unverified code would erode trust, so the failure path must be explicit and safe.

**Independent Test**: Feed a remediation result that exhausted its maximum retries and verify the posted comment lists each failed attempt and contains no proposed diff or suggestion.

**Acceptance Scenarios**:

1. **Given** a remediation run that exceeded its maximum retries, **When** the run completes, **Then** an informative comment is posted on the pull request.
2. **Given** that comment, **When** read, **Then** it lists each failed attempt with the reason it failed (for example test failure or patch could not apply).
3. **Given** a failed run, **When** the comment is built, **Then** it contains no code change proposal, suggestion block, or commit link for unverified code.
4. **Given** a remediation session that ended in an internal error rather than exhausted retries, **When** the run completes, **Then** the same failure-style comment is posted, with the error reason in place of an attempt failure.
5. **Given** an earlier comment on the same pull request proposed a fix, **When** a later run fails, **Then** the earlier suggestion is removed so no stale one-click change remains.

---

### User Story 3 - Safe, Repeatable Posting (Priority: P3)

As a CI platform operator,  
I want comment posting to be reliable and idempotent,  
so that transient GitHub errors do not lose feedback and re-runs do not spam the pull request.

**Why this priority**: Reliability hardening on top of the core flows; the feature is usable without it but noisy.

**Independent Test**: Simulate a transient GitHub API failure and a repeated completion for the same run; verify the comment is eventually posted once and duplicates are not created.

**Acceptance Scenarios**:

1. **Given** a transient GitHub API error while posting, **When** the system retries, **Then** the comment is posted once the error clears.
2. **Given** a comment was already posted for the same remediation run, **When** the completion is reported again, **Then** no duplicate comment is created.
3. **Given** posting ultimately fails after retries, **When** the job finishes, **Then** the failure is recorded in the job's audit record.

---

### Edge Cases

- **Oversized content**: When logs or diffs exceed the platform's comment size limit, logs are truncated (keeping the head and tail with a visible truncation marker) and the complete content is placed in the audit record; the diagnosis and pass/fail verdict are never truncated.
- **Pull request closed or merged**: When the pull request is no longer open at completion time, no comment is posted and the skip is logged.
- **Insufficient permissions**: When the credentials cannot comment on the repository, the failure is logged to the audit record and the job is not retried indefinitely.
- **Rate limiting**: When GitHub signals rate limiting, posting backs off according to the response guidance before retrying.
- **Sensitive data in logs**: Secrets or tokens appearing in sandbox logs are redacted before being posted publicly.
- **Empty diff on success**: A "passing" result with no changes is reported as "no change needed" rather than posted as a fix.
- **Re-run on a new commit**: When a later run targets the same pull request after new commits, the system updates its existing comment in place rather than posting a new one.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST post a structured comment on the originating pull request when a remediation run completes with passing sandbox tests.
- **FR-002**: The success comment MUST include a root-cause diagnosis of the original failure.
- **FR-003**: The success comment MUST include the verified unified diff presented as a one-click suggestion block when the diff fits (single file, within lines changed by the pull request), and otherwise as a collapsible unified diff (with a commit link added when a fix commit already exists).
- **FR-004**: The success comment MUST include the sandbox test pass log and the execution duration.
- **FR-005**: System MUST post an informative failure comment when a remediation run exhausts its maximum retries, listing each failed attempt and its failure reason.
- **FR-006**: System MUST NOT include any proposed code change, suggestion, or commit link for unverified code in a failure comment.
- **FR-007**: System MUST only present a diff as a fix when it was verified by a passing sandbox run.
- **FR-008**: System MUST keep comments within the platform size limit by truncating logs with a visible marker while preserving the diagnosis, verdict, and duration.
- **FR-009**: System MUST redact secrets and credentials from logs before posting.
- **FR-010**: System MUST NOT post duplicate comments for the same remediation run, and MUST update its single existing comment on a pull request when a later run reports new results for that pull request.
- **FR-011**: System MUST retry transient posting failures with backoff and respect rate-limit guidance.
- **FR-012**: System MUST record the outcome of every posting attempt (posted, skipped, failed) in the job's audit record.
- **FR-013**: System MUST skip posting, with a logged reason, when the pull request is closed or merged.
- **FR-014**: System MUST define a stable result contract between the supervisor and the agent output formatter carrying the diagnosis, diff, test logs, duration, attempt history, and final verdict.

### Key Entities

- **FeedbackReport**: Final outcome of a run: verdict (verified fix or failed), diagnosis, unified diff (verified runs only), sandbox test log, execution duration, attempt history, and the rendered comment body.
- **AttemptSummary**: One remediation attempt with its number, outcome, and failure reason.
- **CommentPostingOutcome**: Result of posting the comment (posted, updated, skipped, failed) with reason and comment identifiers, stored in the existing audit record.
- **AuditRecord** *(existing, spec 002)*: Extended with the comment posting outcome.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful remediation runs result in exactly one pull request comment containing diagnosis, diff, and test log with duration.
- **SC-002**: 100% of failed remediation runs result in an explanatory comment containing zero proposed code changes.
- **SC-003**: Reviewers can apply a verified fix in a single action from the comment for single-file fixes.
- **SC-004**: The comment appears within 30 seconds of run completion under normal conditions.
- **SC-005**: Zero duplicate comments are created for the same run, including under retries.
- **SC-006**: 100% of posted comments stay within the platform size limit and contain no detected secrets.

---

## Clarifications

### Session 2026-11-07

- Q: How should the verified diff be presented? → A: Suggestion block when it fits, with a commit link or collapsible diff fallback for multi-file or out-of-range changes.
- Q: When a later run hits the same PR, update or post new? → A: Update the existing bot comment.

## Assumptions

- The pipeline from specs 001 (patch synthesis) and 002 (webhook and worktree supervisor) provides the remediation result, pull request number, and audit record.
- Credentials with permission to comment on pull requests are provisioned through configuration and never committed.
- Posting uses GitHub's comment capability on the pull request; line-level review comments are out of scope unless required by the diff format decision.
- Only the pull request that triggered the run receives a comment; notifications to other channels are out of scope.
- Maximum retry count for remediation is defined by the existing agent configuration.
- Pushing fix commits is out of scope; a commit link is only included when a fix commit already exists.
