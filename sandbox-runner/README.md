# sandbox-runner & webhook supervisor

An isolated Docker-based test runner CLI and webhook container supervisor written in Go.

## Overview

`sandbox-runner` provides both an ephemeral container test execution engine and an asynchronous HTTP daemon that listens for GitHub CI webhooks, manages ephemeral git worktrees, and orchestrates remediation jobs concurrently.

### Core Capabilities

- **Isolated Docker Runner**: Runs tests inside ephemeral Docker containers with sanitized environments, host directory volume isolation, and timeouts.
- **GitHub Webhook Consumer**: Validates HMAC SHA-256 signatures via constant-time comparison, filters failing pull request events (`check_run` and `workflow_run`), and returns non-blocking HTTP responses.
- **Git Worktree Isolation**: Dynamically provisions ephemeral `git worktree` directories off target commits, guaranteeing zero cross-contamination and immediate post-task pruning.
- **Worker Pool Supervisor**: Bounded FIFO channel queue (capacity: 50) with HTTP 429 backpressure, supervising concurrent worker goroutines (default: 3) with execution timeouts.
- **Audit Persistence**: Writes machine-readable JSON envelopes capturing job status, execution duration, and container logs to disk before worktree removal.

---

## Directory Layout

```text
sandbox-runner/
├── cmd/
│   ├── daemon/
│   │   ├── main.go          # HTTP webhook daemon & supervisor entrypoint
│   │   └── main_test.go     # Daemon CLI argument & configuration tests
│   └── sandbox-runner/
│       ├── main.go          # Standalone CLI test runner entrypoint
│       └── main_test.go     # CLI argument validation tests
├── pkg/
│   ├── audit/               # JSON audit log persistence
│   ├── sandbox/             # Docker container orchestration & client abstraction
│   ├── supervisor/          # Bounded job queue & worker pool supervisor
│   ├── webhook/             # HMAC validator, payload parser & HTTP handler
│   └── worktree/            # GitExecutor & ephemeral worktree manager
├── testdata/                # Mock webhook JSON payloads & test helpers
├── go.mod
├── go.sum
└── README.md
```

---

## Usage

### Run Tests

```bash
# Run all unit and integration tests with data race detector
go test -v -race ./...
```

### Standalone Runner CLI

```bash
# Execute npm test inside an isolated container
go run ./cmd/sandbox-runner -repo . -cmd "npm test" -timeout 60s -image "node:24-alpine"
```

### Webhook Daemon

```bash
# Run the webhook daemon
go run ./cmd/daemon \
  --port 8088 \
  --secret "my-github-webhook-secret" \
  --repo . \
  --worktree-base /tmp/genai-lab-worktrees \
  --audit-dir ./audit-logs \
  --concurrency 3 \
  --queue-size 50 \
  --timeout 10m
```

### Health Check

```bash
curl -i http://localhost:8088/healthz
```

### Simulating a Webhook Delivery

```bash
PAYLOAD='{"action":"completed","check_run":{"id":101,"head_sha":"c9a8f21e0123456789abcdef0123456789abcdef","status":"completed","conclusion":"failure","pull_requests":[{"number":55,"head":{"ref":"feat/test","sha":"c9a8f21e0123456789abcdef0123456789abcdef"}}]},"repository":{"full_name":"roselletabuena/genai-lab","clone_url":"https://github.com/roselletabuena/genai-lab.git"}}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "my-github-webhook-secret" | sed 's/^.* //')

curl -i -X POST http://localhost:8088/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: check_run" \
  -H "X-GitHub-Delivery: test-delivery-001" \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -d "$PAYLOAD"
```
