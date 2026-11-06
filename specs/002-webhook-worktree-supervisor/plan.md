# Implementation Plan: GitHub Webhook Consumer and Worktree Container Supervisor

**Branch**: `feat/GL-55-webhook-worktree-supervisor` | **Date**: 2026-11-06 | **Spec**: [specs/002-webhook-worktree-supervisor/spec.md](spec.md)

**Input**: Feature specification from `/specs/002-webhook-worktree-supervisor/spec.md` (Jira [GL-55](https://the-three-devsketeers.atlassian.net/browse/GL-55))

---

## Summary

Implement a lightweight, high-performance Go HTTP daemon (`cmd/daemon`) that authenticates GitHub webhooks via constant-time HMAC SHA-256 verification, filters failing pull request events (`check_run` and `workflow_run`), enqueues remediation tasks into a bounded channel work queue (with HTTP 429 backpressure), provisions ephemeral git worktrees in isolated temporary directories, and supervises concurrent container test execution using the existing `sandbox-runner/pkg/sandbox` engine. Worktrees are pruned immediately upon task completion, failure, or timeout, and structured audit logs are persisted to disk.

---

## Technical Context

**Language/Version**: Go 1.22+ (co-located within `sandbox-runner` module, `go.mod`)

**Primary Dependencies**:
- Standard Library: `net/http`, `crypto/hmac`, `crypto/sha256`, `crypto/subtle`, `os/exec`, `sync`, `context`
- `github.com/docker/docker` (Client SDK, already vendored in `sandbox-runner`)
- `github.com/roselletabuena/genai-lab/sandbox-runner/pkg/sandbox` (Container execution engine from GL-53)

**Storage**: Local filesystem (temporary git worktree directories, persistent JSON audit records in `--audit-dir`)

**Testing**: Native Go testing (`go test -v -race ./...`), mock-based unit tests for Docker API and Git CLI execution

**Target Platform**: Cross-platform Linux / macOS / Windows x64 (container host environment with Docker and Git 2.20+)

**Project Type**: HTTP Daemon & CLI tool (`sandbox-runner/cmd/daemon`)

**Performance Goals**:
- Webhook response latency $<100\text{ms}$ (immediate 202 Accepted / 200 / 401 / 429 response)
- Worktree allocation & pruning $<150\text{ms}$ per job
- 100% ephemeral worktrees cleaned up with zero disk leaks

**Constraints**:
- **Zero Live Cloud Credentials**: Operates purely with local git and local Docker socket; fully testable offline
- **Bounded Memory & Goroutines**: Maximum 3 concurrent worker goroutines and 50-job buffer capacity
- **Constant-Time Verification**: Prevents timing attacks on HMAC signatures via `subtle.ConstantTimeCompare`

**Scale/Scope**:
- Processes bursts up to 50 queued webhook events with HTTP 429 backpressure
- Supervises concurrent container workloads bounded by host CPU/memory limits

---

## Constitution Check

*GATE: Verified before Phase 0 research and re-validated after Phase 1 design.*

| Principle | Requirement | Plan Compliance | Status |
| :--- | :--- | :--- | :---: |
| **I. TDD at Public Seams** | Red-green-refactor at public seams; boundary mocks only | All unit and integration tests written against public interfaces (`webhook.NewHandler`, `webhook.VerifySignature`, `worktree.NewManager`, `supervisor.NewSupervisor`). Boundary collaborators (`DockerAPI`, `GitExecutor`) abstracted via interfaces. | **PASS** |
| **II. Worktree Isolation** | Dedicated git worktree off `origin/main`; zero dirty working tree edits | Implementation will execute inside `.worktrees/feat-GL-55-webhook-worktree-supervisor` off `origin/main`. | **PASS** |
| **III. Strict Schema Validation** | Strong runtime schemas at entry boundaries | Webhook payloads, HTTP headers, and JSON audit logs strictly validated via typed Go structs with size and format guards. | **PASS** |
| **IV. Atomic Commits** | Conventional commits labeled with Jira key (`[GL-55]`) | Commits grouped into single-purpose units: webhook validator/parser, worktree manager, worker supervisor, daemon CLI, and integration tests. | **PASS** |
| **V. Cloud & Local Parity** | Local execution without cloud credentials | Daemon runs locally using standard Go and Docker socket; all integration test suites pass in offline mock mode. | **PASS** |

*All architectural gates pass without unjustified violations.*

---

## Project Structure

### Documentation (this feature)

```text
specs/002-webhook-worktree-supervisor/
├── spec.md                     # Feature specification (User stories, FRs, SCs, Clarifications)
├── plan.md                     # Technical implementation plan
├── research.md                 # Phase 0 architectural & library decisions
├── data-model.md               # Phase 1 domain entities, types & state machine
├── quickstart.md               # Phase 1 runnable validation scenarios
├── checklists/
│   └── requirements.md         # Specification quality checklist
└── contracts/
    ├── github-webhook-payload.json  # JSON schema for qualifying GitHub events
    ├── job-audit-schema.json        # JSON schema for persistent audit log envelopes
    └── http-api-contract.md         # HTTP API and CLI flag contract
```

### Source Code Layout (`sandbox-runner/`)

```text
sandbox-runner/
├── go.mod
├── go.sum
├── README.md
├── cmd/
│   ├── daemon/
│   │   ├── main.go                     # Webhook daemon & worker supervisor CLI entry point
│   │   └── main_test.go                # CLI flag, configuration & graceful shutdown tests
│   └── sandbox-runner/
│       ├── main.go                     # Existing CLI test runner from GL-53
│       └── main_test.go
└── pkg/
    ├── audit/
    │   ├── audit.go                    # AuditRecord JSON file persistence
    │   └── audit_test.go               # Audit log unit tests
    ├── sandbox/                        # Existing Docker container runner from GL-53
    │   ├── client.go
    │   ├── runner.go
    │   ├── runner_test.go
    │   └── types.go
    ├── supervisor/
    │   ├── queue.go                    # Bounded channel work queue & backpressure logic
    │   ├── queue_test.go               # Channel queue concurrency & saturation tests
    │   ├── supervisor.go               # Worker pool supervisor & container orchestration
    │   └── supervisor_test.go          # Worker pool lifecycle & timeout tests
    ├── webhook/
    │   ├── handler.go                  # HTTP POST /webhook & GET /healthz router
    │   ├── handler_test.go             # HTTP integration tests (202, 200, 401, 429)
    │   ├── parser.go                   # GitHub payload deserializer (check_run / workflow_run)
    │   ├── parser_test.go              # Payload parsing unit tests
    │   ├── validator.go                # Constant-time HMAC SHA-256 signature verifier
    │   └── validator_test.go           # Signature validation unit tests
    └── worktree/
        ├── executor.go                 # GitExecutor interface & exec.Command implementation
        ├── manager.go                  # WorktreeManager (add, remove, prune, isolation)
        └── manager_test.go             # Mock-based worktree isolation & cleanup tests
```

---

## Complexity Tracking

> **No Constitution violations detected.** Direct Go standard library and existing Docker client integration minimizes dependencies and complexity.
