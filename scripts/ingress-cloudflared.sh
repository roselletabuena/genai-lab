#!/usr/bin/env bash
# Zero-Cost Cloudflare Tunnel Ingress Launcher (GL-58 AC1)
# Establishes an outbound encrypted QUIC/TLS tunnel to Cloudflare's Free Tier edge
# targeting the local Go supervisor daemon (http://127.0.0.1:8080) with 0 open inbound ports.

set -euo pipefail

DAEMON_HOST="${DAEMON_HOST:-127.0.0.1}"
DAEMON_PORT="${DAEMON_PORT:-8080}"
TARGET_URL="http://${DAEMON_HOST}:${DAEMON_PORT}"
CONFIG_FILE="${CLOUDFLARED_CONFIG:-}"
DRY_RUN=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --url <url>        Local daemon URL to forward to (default: ${TARGET_URL})
  --port <port>      Local daemon port (default: ${DAEMON_PORT})
  --config <path>    Path to named tunnel config YAML (optional; defaults to Quick Tunnel)
  --dry-run          Print the resolved cloudflared command without executing
  -h, --help         Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      TARGET_URL="$2"
      shift 2
      ;;
    --port)
      DAEMON_PORT="$2"
      TARGET_URL="http://${DAEMON_HOST}:${DAEMON_PORT}"
      shift 2
      ;;
    --config)
      CONFIG_FILE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
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

if [[ "${DRY_RUN}" == "true" ]]; then
  if [[ -n "${CONFIG_FILE}" ]]; then
    echo "cloudflared tunnel --no-autoupdate --config ${CONFIG_FILE} run"
  else
    echo "cloudflared tunnel --no-autoupdate --url ${TARGET_URL}"
  fi
  exit 0
fi

if command -v cloudflared >/dev/null 2>&1; then
  echo "[ingress] Starting local cloudflared tunnel -> ${TARGET_URL} (0 inbound firewall ports)..."
  if [[ -n "${CONFIG_FILE}" ]]; then
    exec cloudflared tunnel --no-autoupdate --config "${CONFIG_FILE}" run
  else
    exec cloudflared tunnel --no-autoupdate --url "${TARGET_URL}"
  fi
elif command -v docker >/dev/null 2>&1; then
  echo "[ingress] cloudflared binary not found; launching via cloudflare/cloudflared Docker container..."
  DOCKER_TARGET="${TARGET_URL/127.0.0.1/host.docker.internal}"
  DOCKER_TARGET="${DOCKER_TARGET/localhost/host.docker.internal}"
  exec docker run --rm \
    --add-host=host.docker.internal:host-gateway \
    cloudflare/cloudflared:latest \
    tunnel --no-autoupdate --url "${DOCKER_TARGET}"
else
  echo "Error: neither 'cloudflared' binary nor 'docker' is installed." >&2
  exit 1
fi
