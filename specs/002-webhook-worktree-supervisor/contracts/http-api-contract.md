# HTTP API Contract: Webhook Daemon & Container Supervisor

**Base Path**: `/`  
**Protocol**: HTTP/1.1 or HTTP/2  
**Default Port**: 8088 (configurable via `--port` or `DAEMON_PORT`)  

---

## 1. Endpoints

### 1.1 `POST /webhook`

Receives, verifies, and queues GitHub webhook events for CI failure remediation.

#### Request Headers

| Header | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `Content-Type` | `string` | Yes | Must be `application/json` |
| `X-Hub-Signature-256` | `string` | Yes | HMAC SHA-256 signature in format `sha256=<hex_digest>` |
| `X-GitHub-Event` | `string` | Yes | GitHub event type (e.g., `check_run`, `workflow_run`, `ping`) |
| `X-GitHub-Delivery` | `string` | Yes | Unique delivery GUID |

#### Responses

##### `202 Accepted`
Returned when a qualifying failing PR event is authenticated, validated, and successfully enqueued for worker execution.

```json
{
  "status": "queued",
  "job_id": "job-pr42-7a8f9b1",
  "delivery_id": "720c26c0-ec32-11ec-8770-4f51e04fa055",
  "message": "remediation job successfully enqueued"
}
```

##### `200 OK`
Returned when an incoming webhook is authenticated and verified, but ignored because it does not represent a failing CI event on a pull request (e.g. `ping` event, completed success, non-PR branch).

```json
{
  "status": "ignored",
  "reason": "event conclusion is 'success', no remediation needed"
}
```

##### `400 Bad Request`
Returned when the body is not valid JSON, exceeds the 10 MB payload ceiling, or lacks required fields.

```json
{
  "error": "bad_request",
  "message": "payload exceeds maximum allowed limit of 10MB"
}
```

##### `401 Unauthorized`
Returned when `X-Hub-Signature-256` header is missing or does not match the configured secret.

```json
{
  "error": "unauthorized",
  "message": "invalid or missing HMAC SHA-256 signature"
}
```

##### `429 Too Many Requests`
Returned when the internal worker task queue buffer (capacity 50) is saturated. Instructs GitHub to re-attempt delivery.

**Response Headers**:
- `Retry-After: 60`

```json
{
  "error": "too_many_requests",
  "message": "job queue capacity reached, retry after 60 seconds"
}
```

---

### 1.2 `GET /healthz`

Health and readiness probe endpoint for Kubernetes or load balancer health checks.

#### Responses

##### `200 OK`
```json
{
  "status": "healthy",
  "active_workers": 1,
  "queued_jobs": 0,
  "queue_capacity": 50,
  "uptime_seconds": 3600
}
```

---

## 2. CLI Interface Contract

### Command: `cmd/daemon`

```bash
daemon [options]
```

#### Flags

| Flag | Env Variable | Default | Description |
| :--- | :--- | :--- | :--- |
| `--port` | `DAEMON_PORT` | `8088` | HTTP daemon listening port |
| `--secret` | `GITHUB_WEBHOOK_SECRET` | *(required)* | HMAC SHA-256 shared webhook secret |
| `--repo` | `BASE_REPO_PATH` | `.` | Host path to root git repository for worktree branching |
| `--worktree-base`| `WORKTREE_BASE_DIR` | `~/.genai-lab/worktrees` | Host directory where ephemeral worktrees are created |
| `--audit-dir` | `AUDIT_DIR` | `./audit-logs` | Directory where JSON audit logs are persisted |
| `--concurrency` | `WORKER_CONCURRENCY` | `3` | Maximum number of concurrent worker goroutines |
| `--queue-size` | `QUEUE_CAPACITY` | `50` | Maximum capacity of buffered job queue |
| `--timeout` | `TASK_TIMEOUT` | `10m` | Maximum container execution timeout per job |
| `--image` | `CONTAINER_IMAGE` | `node:24-alpine` | Container image used for sandbox test execution |
| `--test-cmd` | `TEST_COMMAND` | `npm test` | Default test command executed in sandbox |
| `--network` | `ENABLE_NETWORK` | `false` | Enable networking inside sandbox (default: disabled) |
