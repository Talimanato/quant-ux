#!/usr/bin/env bash
#
# One-click local development setup.
#
# Starts:
#   - the Node backend (ts-node, SQLite) on http://localhost:8080
#   - the webpack dev server on http://localhost:8081 (proxies /rest and /ai
#     to the backend)
#
# Both processes log to logs/dev-*.log and are stopped together on Ctrl-C
# (or with "kill -TERM $$" when launched in the background).
#
# Usage: ./scripts/dev.sh
#
set -euo pipefail
# Job control puts every background job into its own process group, so the
# cleanup trap can kill the whole tree (npm -> ts-node / vue-cli-service)
# instead of orphaning npm's children.
set -m

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
LOG_DIR="$ROOT/logs"
BACKEND_URL="http://localhost:8080"
FRONTEND_URL="http://localhost:8081"

BACKEND_PID=""
FRONTEND_PID=""

mkdir -p "$LOG_DIR"

log() { echo "[dev] $*"; }

wait_for_url() {
  local url="$1" name="$2" pid="$3" logfile="$4" timeout="${5:-90}"
  local waited=0
  while true; do
    # fail fast when the child died
    if ! kill -0 "$pid" 2>/dev/null; then
      log "ERROR: $name exited during startup. Last log lines:"
      tail -20 "$logfile" || true
      cleanup
      exit 1
    fi
    if curl -sf -o /dev/null "$url"; then
      log "$name ready: $url"
      return 0
    fi
    if [ "$waited" -ge "$timeout" ]; then
      log "ERROR: $name did not become ready in ${timeout}s ($url)"
      cleanup
      exit 1
    fi
    sleep 1
    waited=$((waited + 1))
  done
}

cleanup() {
  for pid in $FRONTEND_PID $BACKEND_PID; do
    if [ -n "$pid" ]; then
      # negative pid = the job's whole process group
      kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd "$ROOT"

# --- dependencies -----------------------------------------------------------
if [ ! -d node_modules ]; then
  log "Installing frontend dependencies..."
  npm install
fi
if [ ! -d backend/node_modules ]; then
  log "Installing backend dependencies..."
  (cd backend && npm install)
fi

# --- start backend ----------------------------------------------------------
log "Starting backend (SQLite at backend/data/qux.db) ..."
(cd "$BACKEND" && exec npm run dev) > "$LOG_DIR/dev-backend.log" 2>&1 &
BACKEND_PID=$!
wait_for_url "$BACKEND_URL/rest/status.json" backend "$BACKEND_PID" "$LOG_DIR/dev-backend.log" 60

# --- start frontend dev server ----------------------------------------------
# The port is pinned so the order the two processes bind no longer matters
# (vue-cli would otherwise auto-increment from 8080).
log "Starting webpack dev server..."
(npm run serve -- --port 8081) > "$LOG_DIR/dev-frontend.log" 2>&1 &
FRONTEND_PID=$!
wait_for_url "$FRONTEND_URL" frontend "$FRONTEND_PID" "$LOG_DIR/dev-frontend.log" 120

echo ""
log "Development stack is running:"
log "  Frontend : $FRONTEND_URL"
log "  Backend  : $BACKEND_URL/rest/status.json"
log "  Logs     : $LOG_DIR/dev-backend.log, $LOG_DIR/dev-frontend.log"
log "Press Ctrl-C to stop both."
echo ""

wait
