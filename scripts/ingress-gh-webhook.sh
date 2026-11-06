#!/usr/bin/env bash
# Zero-Setup GitHub CLI Webhook Forwarding Helper (GL-58 AC2)
# Streams failing PR webhook events (check_run, workflow_run) from GitHub directly
# to the local Go supervisor daemon (http://127.0.0.1:8080/webhook) at $0 cost.

set -euo pipefail

DAEMON_HOST="${DAEMON_HOST:-127.0.0.1}"
DAEMON_PORT="${DAEMON_PORT:-8080}"
WEBHOOK_URL="http://${DAEMON_HOST}:${DAEMON_PORT}/webhook"
EVENTS="${GITHUB_WEBHOOK_EVENTS:-check_run,workflow_run}"
REPO="${GITHUB_REPOSITORY:-}"
SECRET="${GITHUB_WEBHOOK_SECRET:-}"
DRY_RUN=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --repo <owner/repo>  Target GitHub repository (defaults to current gh repo or GITHUB_REPOSITORY)
  --url <url>          Local webhook receiver endpoint (default: ${WEBHOOK_URL})
  --port <port>        Local daemon port (default: ${DAEMON_PORT})
  --events <list>      Comma-separated GitHub events (default: ${EVENTS})
  --secret <secret>    Webhook HMAC secret (or env GITHUB_WEBHOOK_SECRET)
  --dry-run            Print the resolved gh webhook forward command without executing
  -h, --help           Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO="$2"
      shift 2
      ;;
    --url)
      WEBHOOK_URL="$2"
      shift 2
      ;;
    --port)
      DAEMON_PORT="$2"
      WEBHOOK_URL="http://${DAEMON_HOST}:${DAEMON_PORT}/webhook"
      shift 2
      ;;
    --events)
      EVENTS="$2"
      shift 2
      ;;
    --secret)
      SECRET="$2"
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

CMD_ARGS=(webhook forward "--events=${EVENTS}" "--url=${WEBHOOK_URL}")

if [[ -n "${REPO}" ]]; then
  CMD_ARGS+=("--repo=${REPO}")
fi

if [[ -n "${SECRET}" ]]; then
  CMD_ARGS+=("--secret=${SECRET}")
fi

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "gh ${CMD_ARGS[*]}"
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI ('gh') is not installed. Install from https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: GitHub CLI ('gh') is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

if [[ -z "${REPO}" ]]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
  if [[ -n "${REPO}" ]]; then
    CMD_ARGS+=("--repo=${REPO}")
  fi
fi

echo "[ingress] Forwarding GitHub events (${EVENTS}) -> ${WEBHOOK_URL} ($0 cost)..."
exec gh "${CMD_ARGS[@]}"
