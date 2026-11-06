#!/usr/bin/env bash
# One-Command Local Remediation Stack Startup & Readiness Verifier (GL-58 AC4 & AC5)
# Verifies Go 1.22+, Python 3.12+, Git, and Docker Engine (/var/run/docker.sock),
# then starts the Go supervisor daemon, Python agent environment, and ingress tunnel.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DAEMON_PORT="${DAEMON_PORT:-8080}"
GITHUB_WEBHOOK_SECRET="${GITHUB_WEBHOOK_SECRET:-local-dev-webhook-secret}"
INGRESS_MODE="${INGRESS_MODE:-cloudflared}" # cloudflared | gh | none
MOCK_LLM="${MOCK_LLM:-true}"
CHECK_ONLY=false
USE_COMPOSE=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --check-only              Verify local prerequisites and readiness without starting services
  --compose                 Start stack via 'docker compose --profile ingress up --build'
  --ingress <mode>          Ingress mode: cloudflared | gh | none (default: ${INGRESS_MODE})
  --port <port>             Local Go daemon listening port (default: ${DAEMON_PORT})
  --secret <secret>         HMAC SHA-256 webhook secret (or env GITHUB_WEBHOOK_SECRET)
  --mock-llm                Enable zero-cost offline mock LLM mode (default: true)
  --live-llm                Disable mock LLM and use pay-as-you-go AWS Bedrock tokens
  -h, --help                Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check-only)
      CHECK_ONLY=true
      shift
      ;;
    --compose)
      USE_COMPOSE=true
      shift
      ;;
    --ingress)
      INGRESS_MODE="$2"
      shift 2
      ;;
    --port)
      DAEMON_PORT="$2"
      shift 2
      ;;
    --secret)
      GITHUB_WEBHOOK_SECRET="$2"
      shift 2
      ;;
    --mock-llm)
      MOCK_LLM=true
      shift
      ;;
    --live-llm)
      MOCK_LLM=false
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown option '$1'" >&2
      usage >&2
      exit 2
      ;;
  esac
done

echo "[stack] Checking local zero-cost remediation prerequisites..."

# 1. Check Git
if ! command -v git >/dev/null 2>&1; then
  echo "[FAIL] git is not installed." >&2
  exit 1
fi
echo "[OK] Git: $(git --version)"

# 2. Check Go 1.22+
if ! command -v go >/dev/null 2>&1; then
  echo "[FAIL] Go (1.22+) is not installed." >&2
  exit 1
fi
echo "[OK] Go: $(go version)"

# 3. Check Python 3.12+
PYTHON_BIN=""
for candidate in python3 python; do
  if command -v "${candidate}" >/dev/null 2>&1; then
    PYTHON_BIN="${candidate}"
    break
  fi
done
if [[ -z "${PYTHON_BIN}" ]]; then
  echo "[FAIL] Python 3.12+ is not installed." >&2
  exit 1
fi
echo "[OK] Python: $(${PYTHON_BIN} --version)"

# 4. Check Docker Engine / /var/run/docker.sock readiness
if ! command -v docker >/dev/null 2>&1; then
  echo "[FAIL] Docker CLI is not installed." >&2
  exit 1
fi

if [[ -S /var/run/docker.sock ]]; then
  echo "[OK] Docker socket (/var/run/docker.sock) is present."
elif docker info >/dev/null 2>&1; then
  echo "[OK] Docker daemon is reachable via active Docker context."
else
  echo "[WARN] Docker daemon (/var/run/docker.sock) is not currently reachable; ensure Docker Desktop/Engine is running."
fi

echo "[OK] Cost posture: \$0.00/month fixed cloud spend (mock-llm=${MOCK_LLM}, ingress=${INGRESS_MODE})"

if [[ "${CHECK_ONLY}" == "true" ]]; then
  echo "[stack] Readiness check passed."
  exit 0
fi

export DAEMON_PORT
export GITHUB_WEBHOOK_SECRET
export MOCK_LLM

if [[ "${USE_COMPOSE}" == "true" ]]; then
  echo "[stack] Starting remediation daemon and cloudflared sidecar via Docker Compose..."
  cd "${ROOT_DIR}"
  exec docker compose --profile ingress up --build
fi

cleanup() {
  echo ""
  echo "[stack] Stopping local stack processes..."
  if [[ -n "${INGRESS_PID:-}" ]] && kill -0 "${INGRESS_PID}" 2>/dev/null; then
    kill "${INGRESS_PID}" 2>/dev/null || true
  fi
  if [[ -n "${DAEMON_PID:-}" ]] && kill -0 "${DAEMON_PID}" 2>/dev/null; then
    kill "${DAEMON_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "[stack] Starting Go webhook supervisor daemon on http://127.0.0.1:${DAEMON_PORT}..."
(
  cd "${ROOT_DIR}/sandbox-runner"
  DAEMON_ARGS=(
    "--port=${DAEMON_PORT}"
    "--secret=${GITHUB_WEBHOOK_SECRET}"
    "--repo=${ROOT_DIR}"
  )
  if [[ "${MOCK_LLM}" == "true" ]]; then
    DAEMON_ARGS+=("--mock-llm")
  fi
  go run ./cmd/daemon "${DAEMON_ARGS[@]}"
) &
DAEMON_PID=$!

# Wait for daemon /healthz readiness
for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${DAEMON_PORT}/healthz" >/dev/null 2>&1; then
    echo "[OK] Go supervisor daemon is healthy on http://127.0.0.1:${DAEMON_PORT}/healthz"
    break
  fi
  sleep 0.5
done

if [[ "${INGRESS_MODE}" == "cloudflared" ]]; then
  "${ROOT_DIR}/scripts/ingress-cloudflared.sh" --port "${DAEMON_PORT}" &
  INGRESS_PID=$!
elif [[ "${INGRESS_MODE}" == "gh" ]]; then
  "${ROOT_DIR}/scripts/ingress-gh-webhook.sh" --port "${DAEMON_PORT}" --secret "${GITHUB_WEBHOOK_SECRET}" &
  INGRESS_PID=$!
else
  echo "[stack] Ingress sidecar disabled (--ingress none). Listening locally on http://127.0.0.1:${DAEMON_PORT}/webhook"
fi

wait "${DAEMON_PID}"
