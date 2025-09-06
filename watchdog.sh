#!/usr/bin/env bash
set -Eeuo pipefail
# Simple watchdog loop: ensures server.js is running and healthy.
# Usage: ./watchdog.sh (runs forever) or env PORT=3010 INTERVAL=10 ./watchdog.sh
PORT="${PORT:-3010}"
HEALTH="http://127.0.0.1:${PORT}/health"
INTERVAL="${INTERVAL:-10}"
RESTART_DELAY="${RESTART_DELAY:-2}"
LOG="watchdog.log"
MAX_RESTARTS_MIN="${MAX_RESTARTS_MIN:-10}" # throttle restarts per minute
WINDOW_START=$(date +%s)
RESTARTS=0

log(){ echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG"; }

is_listening(){ lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n1 || true; }

start_server(){
  log "Starting server.js on port $PORT"
  nohup env PORT="$PORT" node server.js >> server.log 2>&1 &
}

maybe_restart(){
  now=$(date +%s)
  if (( now - WINDOW_START >= 60 )); then
    WINDOW_START=$now; RESTARTS=0
  fi
  if (( RESTARTS >= MAX_RESTARTS_MIN )); then
    log "Restart throttle exceeded (MAX_RESTARTS_MIN=$MAX_RESTARTS_MIN). Skipping restart."; return 0; fi
  RESTARTS=$((RESTARTS+1))
  start_server
  sleep "$RESTART_DELAY"
}

log "Watchdog started (PORT=$PORT INTERVAL=${INTERVAL}s)"

while true; do
  pid=$(is_listening)
  if [ -z "$pid" ]; then
    log "No process listening on $PORT. Restarting..."
    maybe_restart
    sleep "$INTERVAL"; continue
  fi
  # Health check
  if ! curl -fsS --max-time 4 "$HEALTH" > /dev/null 2>&1; then
    log "Health check failed. Restarting process PID=$pid";
    kill "$pid" 2>/dev/null || true
    sleep 1
    maybe_restart
  fi
  sleep "$INTERVAL"
done
