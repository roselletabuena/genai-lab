# Phase 0 Research: GitHub Webhook Consumer and Worktree Container Supervisor

**Feature**: GitHub Webhook Consumer and Worktree Container Supervisor  
**Jira Issue**: [GL-55](https://the-three-devsketeers.atlassian.net/browse/GL-55)  
**Parent Epic**: [GL-52](https://the-three-devsketeers.atlassian.net/browse/GL-52) (Autonomous Code Remediation & Sandbox Agent)  
**Date**: 2026-11-06  

---

## 1. Webhook Signature Verification & Constant-Time Comparison

### Decision
Implement GitHub HMAC SHA-256 webhook signature verification using Go's standard library `crypto/hmac`, `crypto/sha256`, and `crypto/subtle.ConstantTimeCompare`.

### Rationale
- GitHub signs all webhook deliveries with an HMAC SHA-256 signature placed in the `X-Hub-Signature-256` HTTP header in the format `sha256=<hex_digest>`.
- Standard string comparison (`==`) is vulnerable to timing attacks where attackers can deduce secret bytes based on variable comparison durations. `crypto/subtle.ConstantTimeCompare` guarantees constant-time evaluation across valid and invalid tokens.
- Zero external dependencies: Go standard library packages are robust, audited, and have zero supply-chain risk.

### Alternatives Considered
- `google/go-github/github`: Includes webhook validation helpers, but adds heavy external dependency trees for what is essentially a 25-line standard library function.
- Express/Fastify Node backend: Rejected because GL-55 explicitly mandates a lightweight Go daemon (`cmd/daemon`) co-located with `sandbox-runner`.

---

## 2. Git Worktree Isolation & Host Concurrency Model

### Decision
Abstract Git CLI worktree operations behind a mockable `GitExecutor` interface executing `git worktree add`, `git worktree remove --force`, and `git worktree prune`.

### Rationale
- Git worktrees allow multiple working directories linked to a single bare or cloned repository (`git worktree add <path> <commit-sha>`).
- Unlike full repository cloning, creating a worktree takes $<100\text{ms}$ and shares the underlying `.git` object store, consuming minimal disk space.
- In-process Git libraries (e.g. `go-git`) have incomplete support for git worktrees, sparse checkout, and submodules. Shelling out to standard `git` CLI (v2.20+) is the recommended, reliable industry standard.
- Encapsulating the shell execution behind `GitExecutor` enables 100% unit test coverage using mock command runners without requiring live disk git repositories during CI runs.

### Alternatives Considered
- `go-git` pure Go library: `go-git` does not natively support `git worktree add` and struggles with shallow submodule fetching.
- Full independent `git clone` per job: Consumes gigabytes of duplicate disk storage and takes 10-30 seconds per PR event, causing latency spikes and worker starvation.

---

## 3. Work Queue, Concurrency Control, and Backpressure Model

### Decision
Use a bounded Go channel (`chan *RemediationJob`) of size 50 as a thread-safe FIFO work queue, supervised by a fixed worker pool of $N=3$ goroutines synchronized with `sync.WaitGroup` and `context.Context`.

### Rationale
- Go channels provide lock-free, race-safe message passing between the HTTP receiver goroutine and worker pool goroutines.
- Non-blocking enqueue using `select ... default`:
  ```go
  select {
  case q.jobs <- job:
      // Enqueued successfully -> 202 Accepted
  default:
      // Queue is full -> 429 Too Many Requests + Retry-After: 60
  }
  ```
  This immediately informs GitHub that the receiver is saturated. GitHub's webhook delivery system automatically backs off exponentially and retries within 1–5 minutes.
- Graceful shutdown is natively handled by closing the channel or canceling the root `context.Context`, allowing in-flight worker tasks to drain cleanly.

### Alternatives Considered
- External message broker (RabbitMQ / Redis / SQS): Unnecessary architectural overhead and deployment dependencies for a local/edge CI daemon.
- Unbounded in-memory queue (`slice` + mutex): Risk of OOM (Out Of Memory) crashes during massive webhook delivery bursts.

---

## 4. Integration with `sandbox-runner/pkg/sandbox`

### Decision
Directly import and reuse `github.com/roselletabuena/genai-lab/sandbox-runner/pkg/sandbox` (`Runner` and `DockerAPI`).

### Rationale
- GL-53 already implemented a high-performance, containerized test runner (`sandbox.Runner`) with timeout enforcement, stdcopy multiplexing, Docker client abstraction, and structured JSON output.
- Reusing `sandbox.NewRunner(dockerClient)` eliminates duplicate container orchestration code, guarantees consistency with the CLI runner, and enables unit testing via `MockDockerAPI`.

### Alternatives Considered
- Shelling out to `sandbox-runner` binary via `exec.Command`: Adds process invocation overhead, fragile CLI parsing, and loss of programmatic context cancellation.

---

## 5. Ephemeral Resource Cleanup & Audit Persistence

### Decision
Implement strict post-execution `defer` cleanup for worktrees while persisting a JSON audit envelope to `audit-dir` (`<job_id>.json`).

### Rationale
- If a container task fails, panics, or times out, the `defer worktreeMgr.Prune(ctx, worktreePath)` pattern guarantees the temporary directory is removed from the host.
- Capturing `RunResult` (stdout, stderr, exit code, duration) into a standalone JSON file preserves full operator visibility and enables downstream integrations (e.g. GL-56 PR comment poster) to ingest diagnostic results.

---

## 6. Summary of Architectural Decisions

| Area | Selection | Trade-off / Benefit |
| :--- | :--- | :--- |
| **Language & Module** | Go 1.22+ (`sandbox-runner` module) | Shared types, zero-overhead Docker SDK integration |
| **HTTP Routing** | Go standard library `net/http` | Zero dependencies, high performance, robust TLS/HTTP2 |
| **Authentication** | `crypto/hmac` + `crypto/subtle` | Timing-attack resistant, constant-time verification |
| **Worktree Mgmt** | `git worktree` via `GitExecutor` interface | Fast $(<100\text{ms})$, storage efficient, 100% mockable in unit tests |
| **Worker Queue** | Bounded buffered channel (`cap: 50`, `workers: 3`) | Memory safe, non-blocking HTTP 202/429 semantics |
| **Container Execution**| `pkg/sandbox.Runner` | Proven GL-53 implementation, isolated Docker execution |
| **Failure Auditing** | JSON files in `--audit-dir` | Ephemeral disk safety + permanent diagnostic traceability |
