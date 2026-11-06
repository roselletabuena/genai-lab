# Feature Specification: GitHub Webhook Consumer and Worktree Container Supervisor

**Feature Branch**: `feat/GL-55-webhook-worktree-supervisor` (Spec: `002-webhook-worktree-supervisor`)  
**Created**: 2026-11-06  
**Status**: Clarified  
**Input**: User description: "https://the-three-devsketeers.atlassian.net/browse/GL-55: 1.3 GO [Daemon] Implement GitHub webhook consumer and worktree container supervisor"

## Clarifications

### Session 2026-11-06

- Q: Which specific GitHub webhook event types and conclusions should trigger automated remediation jobs? → A: Trigger on `check_run` (action `completed`, conclusion `failure` or `timed_out`) and `workflow_run` (conclusion `failure`) targeting pull requests.
- Q: How should the system handle ephemeral git worktrees when a remediation container run fails or times out? → A: Always prune and delete worktrees immediately upon completion, failure, or timeout, while persisting structured container execution logs and failure diagnostics to a dedicated audit directory.
- Q: How should the webhook daemon respond when the internal job queue reaches capacity during a traffic burst? → A: Return HTTP `429 Too Many Requests` with a `Retry-After: 60` header so GitHub schedules automatic redelivery.
- Q: What should the default worker concurrency limit, queue capacity, and per-task container timeout values be when not explicitly overridden by configuration? → A: Concurrency limit: 3 workers, queue capacity: 50 jobs, per-task container timeout: 10 minutes (600 seconds).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Webhook Authentication & CI Event Filtering (Priority: P1)

As a CI platform operator,  
I want incoming GitHub webhooks cryptographically verified against a configured shared secret and filtered for relevant failing pull request events,  
so that unauthorized or malformed requests are rejected immediately while legitimate failing CI runs are accurately detected and queued.

**Why this priority**: Boundary security and payload validation are fundamental. Untrusted requests must never trigger repository operations or consume container resources.

**Independent Test**: Can be tested by sending sample webhook payloads with valid signatures, invalid signatures, missing signatures, and non-target event types, verifying that valid events return 202 Accepted while invalid requests return 401/403 and unhandled events return 200 with an ignored status.

**Acceptance Scenarios**:

1. **Given** an incoming webhook with a valid HMAC SHA-256 signature matching the configured secret, **When** received by the daemon endpoint, **Then** the signature is validated and an acknowledgment response is returned immediately.
2. **Given** an incoming webhook payload with an invalid or missing signature header, **When** evaluated by the authentication handler, **Then** the request is rejected with an HTTP 401/403 status and no processing is queued.
3. **Given** a verified webhook payload for a `check_run` event with action `completed` and conclusion `failure` or `timed_out`, or a `workflow_run` event with conclusion `failure` targeting a pull request branch, **When** parsed, **Then** repository details, target branch name, and commit SHA are extracted into a structured remediation event.
4. **Given** a verified webhook payload for an unrelated or non-failing event (e.g. successful check run, closed PR, non-PR push), **When** evaluated, **Then** the daemon acknowledges the event with an HTTP 200 status and does not queue remediation work.

---

### User Story 2 - Ephemeral Worktree Provisioning & Lifecycle Management (Priority: P2)

As a CI platform operator,  
I want each validated remediation job to execute within an isolated, ephemeral git worktree directory that is automatically provisioned and torn down,  
so that concurrent jobs cannot contaminate the primary repository state or cross-contaminate each other.

**Why this priority**: Filesystem and branch isolation prevent side effects, git lock conflicts, and corrupted workspaces across concurrent remediation runs.

**Independent Test**: Can be tested by triggering a remediation job for a specific branch and commit, verifying that a distinct, clean worktree directory is created off the target commit, and confirming that upon job completion (success or failure) the worktree is cleanly pruned and removed from the host while diagnostic logs are preserved.

**Acceptance Scenarios**:

1. **Given** a queued remediation event with target repository and commit SHA, **When** worker processing begins, **Then** an ephemeral git worktree is created in a dedicated temporary directory linked to the target commit.
2. **Given** multiple concurrent jobs for different branches or the same repository, **When** worktrees are created, **Then** each job receives an isolated filesystem directory with independent working state.
3. **Given** a completed, failed, or timed-out remediation job, **When** the worker finishes execution, **Then** the temporary worktree is pruned and its directory removed without leaving orphaned git references or disk artifacts, and container execution logs and failure diagnostics are persisted to an audit directory.

---

### User Story 3 - Concurrent Task Queue & Container Execution Supervision (Priority: P3)

As a CI platform operator,  
I want incoming remediation jobs processed through a non-blocking bounded queue supervised by concurrent worker processes with configurable capacity and timeout limits,  
so that peak webhook bursts do not overwhelm host resources or hang indefinitely.

**Why this priority**: Controlled concurrency and resource bounds prevent denial of service and ensure deterministic orchestration during high CI traffic.

**Independent Test**: Can be tested by dispatching multiple simultaneous webhook events, verifying that workers process tasks up to the configured concurrency limit, tasks execute within enforced timeouts, and excess requests beyond queue capacity receive an immediate backpressure status.

**Acceptance Scenarios**:

1. **Given** an influx of valid webhook events, **When** submitted to the daemon, **Then** each event is queued asynchronously and the HTTP response returns an immediate 202 Accepted without blocking on job completion.
2. **Given** a configured concurrency limit $N$ (defaulting to 3), When more than $N$ jobs are queued, **Then** exactly $N$ worker instances execute concurrently while remaining jobs wait in the FIFO queue (capacity: 50).
3. **Given** a running container task exceeding the configured execution timeout (defaulting to 10 minutes / 600s), **When** the timeout expires, **Then** the supervisor terminates the container process, marks the job as timed out, cleans up the associated worktree, persists diagnostic logs, and frees the worker slot.
4. **Given** a job queue that has reached its buffer capacity of 50 jobs, **When** an additional webhook arrives, **Then** the daemon rejects the event with an HTTP 429 (Too Many Requests) status code, includes a `Retry-After: 60` response header, and logs a backpressure warning.

---

### Edge Cases

- **Webhook Payload Size & Malformed JSON**: When incoming payloads exceed maximum allowed size or contain malformed JSON, the daemon rejects the request with HTTP 400 Bad Request without panicking or allocating worker buffers.
- **Git Fetch & Reference Failures**: When a target branch or commit SHA cannot be fetched or resolved from the remote, the worker marks the job as failed, logs the failure, cleans up any partially allocated directory, and continues processing the queue.
- **Abrupt Daemon Shutdown & Graceful Termination**: When a termination signal (SIGINT, SIGTERM) is received, the daemon stops accepting new webhooks, allows in-flight worker tasks a bounded grace period to complete or terminate cleanly, and cleans up active worktrees.
- **Worktree Cleanup Failures**: When filesystem locks or permission issues prevent immediate worktree removal, the system logs an alert and enqueues a retry or background sweep to prevent disk leaks.
- **High-Concurrency Queue Saturation**: When incoming webhook rates exceed worker processing capacity, the bounded queue protects host memory and returns HTTP 429 Too Many Requests with a `Retry-After: 60` header to instruct callers to redeliver.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose an HTTP webhook receiver endpoint that accepts POST requests containing repository event notifications.
- **FR-002**: System MUST validate incoming payloads using constant-time cryptographic HMAC SHA-256 signature verification against a configured secret token.
- **FR-003**: System MUST reject requests with invalid, missing, or mismatched signatures with an HTTP 401/403 status code before parsing full payload bodies.
- **FR-004**: System MUST parse payload metadata specifically qualifying `check_run` events (action `completed`, conclusion `failure` or `timed_out`) and `workflow_run` events (conclusion `failure`) associated with pull requests to extract target repository, branch, and commit SHA.
- **FR-005**: System MUST immediately return an HTTP 202 Accepted acknowledgment for qualified events and enqueue them for asynchronous background execution without blocking the webhook caller.
- **FR-006**: System MUST enforce a bounded internal queue buffer (defaulting to 50 jobs) and return an HTTP 429 Too Many Requests status code with a `Retry-After: 60` header when the queue reaches capacity.
- **FR-007**: System MUST provision an isolated, ephemeral git worktree in a temporary directory for each queued remediation job.
- **FR-008**: System MUST execute remediation tasks within supervised isolated container environments pointing to the ephemeral worktree.
- **FR-009**: System MUST enforce a configurable concurrency limit (defaulting to 3 concurrent workers) restricting the maximum number of simultaneously executing container tasks.
- **FR-010**: System MUST enforce a configurable task execution timeout (defaulting to 10 minutes / 600 seconds) for each supervised container run.
- **FR-011**: System MUST reliably tear down, prune, and remove ephemeral worktrees immediately upon task completion, failure, or timeout.
- **FR-012**: System MUST persist container execution logs, failure traces, and job diagnostic records to a structured audit directory prior to worktree removal.
- **FR-013**: System MUST support graceful daemon shutdown, draining or safely canceling active jobs and releasing ephemeral resources without leaving orphaned processes or directories.
- **FR-014**: System MUST emit structured log events for all webhook verifications, queue events, worker lifecycle transitions, container exits, and cleanup actions.

### Key Entities

- **WebhookEvent**: Incoming payload containing event type, signature header, repository metadata, commit SHA, and event timestamp.
- **RemediationJob**: A queued task unit containing unique job ID, repository identifier, commit reference, pull request number, and status (Queued, Running, Completed, Failed, TimedOut).
- **WorktreeContext**: Represents an isolated working directory allocation, including path, parent repository reference, active commit SHA, creation timestamp, and lock state.
- **WorkerSupervisor**: Orchestrator managing worker pool lifecycle, concurrency limits, channel capacity, container process execution, and timeout monitoring.
- **AuditRecord**: Persistent diagnostic record capturing job identifier, container exit status, stderr logs, execution duration, and worktree cleanup status.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of webhook requests with invalid or missing HMAC signatures are rejected prior to workspace allocation.
- **SC-002**: Webhook response latency for incoming requests is under 100 milliseconds (immediate 202 Accepted / 200 / 401 response).
- **SC-003**: 100% of completed, failed, or timed-out jobs have their ephemeral worktrees completely pruned and cleaned up with zero orphaned disk artifacts.
- **SC-004**: System successfully handles concurrent bursts up to the configured worker limit (default: 3) without dropped jobs or race conditions.
- **SC-005**: Zero cross-contamination between concurrent jobs operating on different branches or the same repository.
- **SC-006**: Container tasks exceeding the timeout limit (default: 600s) are terminated and cleaned up within 5 seconds of threshold expiration.

---

## Assumptions

- The host system provides a container runtime environment accessible to the supervisor process.
- The daemon has filesystem permissions to create and remove temporary directories in the designated workspace root.
- Git CLI (version 2.20+) is available in the host environment for managing git worktree operations.
- The shared secret token is pre-configured in environment variables and matches the webhook secret configured in the source repository settings.
- The repository is accessible via standard git remote fetch protocols with appropriate read/write credentials.
