# sandbox-runner & webhook supervisor

An isolated Docker-based test runner CLI and webhook container supervisor written in Go.

## Overview

`sandbox-runner` provides both an ephemeral container test execution engine and an asynchronous HTTP daemon that listens for GitHub CI webhooks, manages ephemeral git worktrees, and orchestrates remediation jobs concurrently.

### Core Capabilities

- **Isolated Docker Runner**: Runs tests inside ephemeral Docker containers with sanitized environments, host directory volume isolation, and timeouts.
- **Security Guardrails (`pkg/sandbox/security.go`)**: Enforces hard Docker `HostConfig` resource quotas (512 MB RAM cap with swap disabled, 1.0 CPU core quota via `NanoCPUs` and CFS `CPUQuota`), outbound network isolation (`--network=none`), non-root UID execution (`1000:1000`), Linux capability dropping (`CapDrop: ALL`, `no-new-privileges:true`), and a hard 60-second execution timeout with immediate `SIGKILL`.
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
│   ├── github/              # GitHub REST client, report decoder, redaction & idempotent PR commenter
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
# Run the webhook daemon (default port: 8080; supports --mock-llm for $0 offline mode)
go run ./cmd/daemon \
  --port 8080 \
  --secret "my-github-webhook-secret" \
  --repo . \
  --worktree-base /tmp/genai-lab-worktrees \
  --audit-dir ./audit-logs \
  --concurrency 3 \
  --queue-size 50 \
  --timeout 10m \
  --mock-llm
```

### Zero-Cost Local Ingress (Cloudflare Tunnel & GitHub CLI Webhook Forwarding)

Route incoming GitHub pull request webhooks (`check_run`, `workflow_run`) to the local Go supervisor daemon (`http://127.0.0.1:8080/webhook`) with **$0.00/month infrastructure cost** and **zero open inbound firewall ports**:

#### Option 1: Cloudflare Quick/Named Tunnel (`cloudflared`)

```bash
# Start outbound QUIC/TLS Cloudflare Quick Tunnel targeting http://127.0.0.1:8080
npm run ingress:tunnel
# Or directly:
bash ../scripts/ingress-cloudflared.sh --url http://127.0.0.1:8080
```

For custom domains on Cloudflare's Free Tier, copy [`infra/cloudflared/config.example.yml`](../infra/cloudflared/config.example.yml) and pass `--config`:

```bash
bash ../scripts/ingress-cloudflared.sh --config ../infra/cloudflared/config.example.yml
```

#### Option 2: GitHub CLI Webhook Forwarding (`gh webhook forward`)

```bash
# Stream check_run and workflow_run events directly from GitHub to local daemon
npm run ingress:gh
# Or directly:
gh webhook forward --events=check_run,workflow_run --url=http://127.0.0.1:8080/webhook
```

#### Option 3: One-Command Local Stack Startup (Script or Docker Compose)

```bash
# Verify local Go 1.22+, Python 3.12+, Git, and /var/run/docker.sock readiness
npm run stack:check

# Start local Go daemon + cloudflared tunnel with --mock-llm enabled ($0 cloud spend)
npm run stack:start

# Or via Docker Compose profile:
docker compose --profile ingress up --build
```

### Health Check

```bash
curl -i http://127.0.0.1:8080/healthz
```

### Simulating a Webhook Delivery

```bash
PAYLOAD='{"action":"completed","check_run":{"id":101,"head_sha":"c9a8f21e0123456789abcdef0123456789abcdef","status":"completed","conclusion":"failure","pull_requests":[{"number":55,"head":{"ref":"feat/test","sha":"c9a8f21e0123456789abcdef0123456789abcdef"}}]},"repository":{"full_name":"roselletabuena/genai-lab","clone_url":"https://github.com/roselletabuena/genai-lab.git"}}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "my-github-webhook-secret" | sed 's/^.* //')

curl -i -X POST http://127.0.0.1:8080/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: check_run" \
  -H "X-GitHub-Delivery: test-delivery-001" \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -d "$PAYLOAD"
```

### GitHub PR Feedback Environment Variables

When the supervisor finishes a remediation job, it can post or update a single marker-tagged pull request feedback comment via `pkg/github`:

| Variable | Required | Description |
| :--- | :--- | :--- |
| `GITHUB_TOKEN` | For live posting | Fine-grained PAT or installation token with `pull_requests: write` and `issues: write`. When unset, posting is skipped and recorded in the audit log as `skipped` (`no_credentials`). |
| `GITHUB_API_URL` | Optional | Defaults to `https://api.github.com`. Override in tests to point at an `httptest` mock server. |

