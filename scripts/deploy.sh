#!/usr/bin/env bash
#
# One-click production deploy for the Node/SQLite stack.
#
#   ./scripts/deploy.sh [start]    build everything and start both services
#                                  in the background (default)
#   ./scripts/deploy.sh stop       stop both services
#   ./scripts/deploy.sh restart    stop + start
#   ./scripts/deploy.sh status     show service status
#   ./scripts/deploy.sh logs [backend|frontend]   follow service logs
#
# Services:
#   backend   node backend/dist/server.js   (default port 8080)
#   frontend  node server/start.js          (default port 8082, serves dist/)
#
# Ports and most QUX_* environment variables can be overridden, e.g.:
#   QUX_BACKEND_PORT=9000 QUX_FRONTEND_PORT=8082 ./scripts/deploy.sh
#   QUX_WS_URL=ws://my-ws:8086 QUX_AI_TOKEN=sk-... ./scripts/deploy.sh
#
# A persistent JWT secret is generated once into backend/data/jwt.secret so
# login sessions survive restarts (set QUX_JWT_PASSWORD to use your own).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
LOG_DIR="$ROOT/logs"
DATA_DIR="$BACKEND/data"
PID_BACKEND="$LOG_DIR/prod-backend.pid"
PID_FRONTEND="$LOG_DIR/prod-frontend.pid"

BACKEND_PORT="${QUX_BACKEND_PORT:-8080}"
FRONTEND_PORT="${QUX_FRONTEND_PORT:-8082}"
BACKEND_URL="http://localhost:$BACKEND_PORT"
FRONTEND_URL="http://localhost:$FRONTEND_PORT"

log() { echo "[deploy] $*"; }

need_clean_port() {
  local port="$1" name="$2"
  # only LISTENING sockets matter; other apps may hold mere connections
  # on the same port number (e.g. chat clients)
  if lsof -ti :"$port" -sTCP:LISTEN > /dev/null 2>&1; then
    log "ERROR: port $port is already in use, $name cannot start."
    log "       Stop the other process or pick another port, e.g.:"
    log "       QUX_BACKEND_PORT=9000 QUX_FRONTEND_PORT=8083 ./scripts/deploy.sh"
    exit 1
  fi
}

pid_alive() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }

stop_service() {
  local pidfile="$1" name="$2"
  if pid_alive "$pidfile"; then
    local pid
    pid="$(cat "$pidfile")"
    log "Stopping $name (pid $pid)..."
    kill "$pid" 2>/dev/null || true
    for _ in $(seq 1 10); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 1
    done
    kill -9 "$pid" 2>/dev/null || true
  else
    log "$name is not running"
  fi
  rm -f "$pidfile"
}

wait_for_url() {
  local url="$1" name="$2" pid="$3" timeout="${4:-60}"
  local waited=0
  while true; do
    if ! kill -0 "$pid" 2>/dev/null; then
      log "ERROR: $name exited during startup. Last log lines:"
      tail -20 "$LOG_DIR/prod-$name.log" || true
      exit 1
    fi
    if curl -sf -o /dev/null "$url"; then
      log "$name ready: $url"
      return 0
    fi
    if [ "$waited" -ge "$timeout" ]; then
      log "ERROR: $name did not become ready in ${timeout}s ($url)"
      exit 1
    fi
    sleep 1
    waited=$((waited + 1))
  done
}

cmd_start() {
  cd "$ROOT"
  need_clean_port "$BACKEND_PORT" backend
  need_clean_port "$FRONTEND_PORT" frontend
  mkdir -p "$LOG_DIR" "$DATA_DIR"

  log "Installing dependencies (skipped when node_modules exists)..."
  [ -d node_modules ] || npm install
  [ -d backend/node_modules ] || (cd backend && npm install)

  log "Building frontend (dist/)..."
  npm run build > "$LOG_DIR/build-frontend.log" 2>&1

  log "Building backend (tsc)..."
  (cd backend && npm run build) > "$LOG_DIR/build-backend.log" 2>&1

  # Persistent JWT secret unless one is provided
  if [ -z "${QUX_JWT_PASSWORD:-}" ]; then
    if [ ! -s "$DATA_DIR/jwt.secret" ]; then
      node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" > "$DATA_DIR/jwt.secret"
      log "Generated new JWT secret at backend/data/jwt.secret"
    fi
    export QUX_JWT_PASSWORD="$(cat "$DATA_DIR/jwt.secret")"
  fi

  log "Starting backend on :$BACKEND_PORT ..."
  (
    cd "$BACKEND"
    export QUX_HTTP_PORT="$BACKEND_PORT"
    export QUX_SQLITE_PATH="${QUX_SQLITE_PATH:-$DATA_DIR/qux.db}"
    exec node dist/server.js
  ) > "$LOG_DIR/prod-backend.log" 2>&1 &
  echo $! > "$PID_BACKEND"
  wait_for_url "$BACKEND_URL/rest/status.json" backend "$(cat "$PID_BACKEND")"

  log "Starting frontend server on :$FRONTEND_PORT ..."
  (
    export QUX_HTTP_PORT="$FRONTEND_PORT"
    export QUX_PROXY_URL="$BACKEND_URL"
    exec node server/start.js
  ) > "$LOG_DIR/prod-frontend.log" 2>&1 &
  echo $! > "$PID_FRONTEND"
  wait_for_url "$FRONTEND_URL/config.json" frontend "$(cat "$PID_FRONTEND")"

  echo ""
  log "Deployment is up:"
  log "  App      : $FRONTEND_URL"
  log "  Backend  : $BACKEND_URL/rest/status.json"
  log "  Logs     : $LOG_DIR/prod-backend.log, $LOG_DIR/prod-frontend.log"
  log "  Stop with: ./scripts/deploy.sh stop"
}

cmd_stop() {
  stop_service "$PID_FRONTEND" frontend
  stop_service "$PID_BACKEND" backend
  log "All services stopped."
}

cmd_status() {
  local ok=0
  if pid_alive "$PID_BACKEND"; then
    log "backend  : running (pid $(cat "$PID_BACKEND")) -> $BACKEND_URL"
  else
    log "backend  : NOT running"; ok=1
  fi
  if pid_alive "$PID_FRONTEND"; then
    log "frontend : running (pid $(cat "$PID_FRONTEND")) -> $FRONTEND_URL"
  else
    log "frontend : NOT running"; ok=1
  fi
  exit "$ok"
}

case "${1:-start}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  status)  cmd_status ;;
  logs)
    case "${2:-}" in
      backend)  tail -f "$LOG_DIR/prod-backend.log" ;;
      frontend) tail -f "$LOG_DIR/prod-frontend.log" ;;
      *)        tail -f "$LOG_DIR/prod-backend.log" "$LOG_DIR/prod-frontend.log" ;;
    esac
    ;;
  *)
    echo "Usage: $0 [start|stop|restart|status|logs [backend|frontend]]"
    exit 1
    ;;
esac
