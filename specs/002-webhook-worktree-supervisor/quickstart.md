# Quickstart & Verification Guide: GitHub Webhook Consumer and Worktree Container Supervisor

**Feature**: GitHub Webhook Consumer and Worktree Container Supervisor  
**Branch**: `feat/GL-55-webhook-worktree-supervisor`  
**Date**: 2026-11-06  

---

## 1. Prerequisites

- **Go**: 1.22+ (`go version`)
- **Docker**: Docker Engine or Desktop daemon running locally (`docker info`)
- **Git**: Git 2.20+ (`git --version`) supporting `git worktree`
- **Curl** / `openssl`: For crafting signed webhook payloads

---

## 2. Environment Setup

From the repository root:

```bash
cd sandbox-runner

# Verify all Go packages compile and existing unit tests pass
go test -v ./...
```

Export test environment variables:

```bash
export GITHUB_WEBHOOK_SECRET="test-secret-key-12345"
export DAEMON_PORT=8088
export AUDIT_DIR="/tmp/genai-lab-audit"
export WORKTREE_BASE_DIR="/tmp/genai-lab-worktrees"
```

---

## 3. Build & Start Daemon

Compile and start the daemon in local test mode:

```bash
# Build daemon binary
go build -o bin/daemon ./cmd/daemon

# Run daemon with local test configuration
./bin/daemon \
  --port 8088 \
  --secret "test-secret-key-12345" \
  --audit-dir /tmp/genai-lab-audit \
  --worktree-base /tmp/genai-lab-worktrees \
  --concurrency 3 \
  --queue-size 50 \
  --timeout 2m
```

Verify daemon health probe:

```bash
curl -i http://localhost:8088/healthz
```

**Expected Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"healthy","active_workers":0,"queued_jobs":0,"queue_capacity":50}
```

---

## 4. End-to-End Validation Scenarios

### Scenario 1: Missing or Invalid Signature Rejection

Send a webhook payload with an invalid HMAC signature:

```bash
curl -i -X POST http://localhost:8088/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: check_run" \
  -H "X-Hub-Signature-256: sha256=invalidhexsignature000000000000000000000000000000000000000000000000" \
  -d '{"action":"completed"}'
```

**Expected Response**:
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{"error":"unauthorized","message":"invalid or missing HMAC SHA-256 signature"}
```

---

### Scenario 2: Successful / Non-Failing Event Handled Gracefully

Send a validly signed webhook representing a successful CI run (`conclusion: "success"`):

```bash
PAYLOAD='{"action":"completed","check_run":{"id":101,"head_sha":"a1b2c3d4e5f60718293a4b5c6d7e8f9012345678","status":"completed","conclusion":"success","pull_requests":[{"number":42,"head":{"ref":"feat/login","sha":"a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"}}]},"repository":{"full_name":"roselletabuena/genai-lab","clone_url":"https://github.com/roselletabuena/genai-lab.git"}}'

# Compute valid HMAC SHA-256 signature
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "test-secret-key-12345" | sed 's/^.* //')

curl -i -X POST http://localhost:8088/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: check_run" \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -d "$PAYLOAD"
```

**Expected Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ignored","reason":"event conclusion is 'success', no remediation needed"}
```

---

### Scenario 3: Valid Failing CI Run Enqueued & Executed

Send a validly signed failing check run payload:

```bash
FAIL_PAYLOAD='{"action":"completed","check_run":{"id":102,"head_sha":"c9a8f21e0123456789abcdef0123456789abcdef","status":"completed","conclusion":"failure","pull_requests":[{"number":55,"head":{"ref":"feat/auth","sha":"c9a8f21e0123456789abcdef0123456789abcdef"}}]},"repository":{"full_name":"roselletabuena/genai-lab","clone_url":"https://github.com/roselletabuena/genai-lab.git"}}'

SIG=$(echo -n "$FAIL_PAYLOAD" | openssl dgst -sha256 -hmac "test-secret-key-12345" | sed 's/^.* //')

curl -i -X POST http://localhost:8088/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: check_run" \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -d "$FAIL_PAYLOAD"
```

**Expected Response**:
```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{"status":"queued","job_id":"job-pr55-c9a8f21","message":"remediation job successfully enqueued"}
```

**Verification Steps**:
1. Daemon logs show:
   - Webhook signature validated.
   - Job `job-pr55-c9a8f21` enqueued.
   - Worker dequeues job and creates worktree at `/tmp/genai-lab-worktrees/job-pr55-c9a8f21`.
   - Sandbox runner container executed.
   - Audit record written to `/tmp/genai-lab-audit/job-pr55-c9a8f21.json`.
   - Worktree `/tmp/genai-lab-worktrees/job-pr55-c9a8f21` pruned and removed.
2. Verify audit record:
   ```bash
   cat /tmp/genai-lab-audit/job-pr55-c9a8f21.json
   ```
   Contains `job_id`, `pull_request_number: 55`, `exit_code`, and `duration_ms`.
3. Verify zero lingering directories:
   ```bash
   ls /tmp/genai-lab-worktrees/
   ```
   Should be empty.

---

### Scenario 4: Queue Saturation Backpressure

Simulate queue saturation by exceeding the queue capacity:

```bash
# Saturated queue returns HTTP 429
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json

{"error":"too_many_requests","message":"job queue capacity reached, retry after 60 seconds"}
```

---

## 5. Automated Unit & Integration Testing

Run the automated test suite verifying all components with mock executors:

```bash
cd sandbox-runner
go test -v -race ./pkg/webhook/... ./pkg/worktree/... ./pkg/supervisor/... ./pkg/audit/...
```

**Expected Outcome**: All tests PASS with zero data races.
