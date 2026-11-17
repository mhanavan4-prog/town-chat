#!/usr/bin/env bash
# Quiet deploy. Run on the VPS:  sudo bash /opt/town-chat/ops/deploy.sh
#
# The point of this script is that a deploy should not be something players
# feel. It looks at what changed since the server process was last started and
# does the least it can:
#
#   * Only client, site, test, tool or doc files changed
#       -> pull, rebuild the bundle, done. The server reads those from disk, so
#          the new build is live WITHOUT a restart and nobody is disconnected.
#   * Server code changed (server.js, lib/, data/, package files, ...)
#       -> if the town is empty: pull, build, restart, health-check.
#       -> if players are in town: touch nothing, and leave a waiter behind that
#          lands the update the moment the town empties (checked every 30 s).
#          If the town never empties for DEPLOY_MAX_WAIT_S (12 h), it goes
#          ahead with the usual friendly "updating" notice.
#
#   deploy.sh          the behaviour above (what the GitHub Action runs)
#   deploy.sh --now    do not wait for an empty town
#   deploy.sh --wait   (internal) the waiter
#
# Assumes the systemd unit from ops/thornreach.service is installed as
# "thornreach". Change APP_DIR / SERVICE / PORT below if yours differ.
set -euo pipefail

# Everything lives in functions and runs from the last line, so bash has read
# the whole file before `git reset` swaps it for a newer copy underneath us.

APP_DIR="${THORNREACH_APP_DIR:-/opt/town-chat}"
SERVICE="${THORNREACH_SERVICE:-thornreach}"
PORT="${PORT_OVERRIDE:-3000}"
MAX_WAIT_S="${DEPLOY_MAX_WAIT_S:-43200}"     # 12 h, then deploy regardless
POLL_S="${DEPLOY_POLL_S:-30}"

RUNNING_REV_FILE="$APP_DIR/.running-rev"     # commit the live process was started from
WAITER_PID_FILE="$APP_DIR/.deploy-waiter.pid"
WAIT_LOG="$APP_DIR/.deploy-wait.log"
DEPLOY_FLAG="$APP_DIR/.deploying"
SELF="$APP_DIR/ops/deploy.sh"

# Paths the running server never loads into memory: changing only these needs
# no restart. Anything not listed here is treated as server code.
QUIET_PATHS='^(client/|public/|test/|tools/|ops/|docs/|\.github/|\.gitignore$|eslint\.config\.[a-z]+$|tsconfig\.json$|[^/]+\.md$)'

players_online() {
  # Prints the number of connected players; 0 if the server is not answering
  # (a restart cannot hurt a server that is already down).
  local body n
  body="$(curl -fsS -m 5 "http://localhost:${PORT}/healthz" 2>/dev/null || true)"
  n="$(printf '%s' "$body" | sed -n 's/.*"players":\([0-9][0-9]*\).*/\1/p')"
  printf '%s\n' "${n:-0}"
}

running_rev() {
  # Before this script existed every deploy restarted, so HEAD is what is live.
  if [ -s "$RUNNING_REV_FILE" ]; then cat "$RUNNING_REV_FILE"; else git rev-parse HEAD; fi
}

needs_restart() {  # $1 = running rev, $2 = new rev
  if ! git cat-file -e "$1^{commit}" 2>/dev/null; then return 0; fi   # unknown rev: be safe
  # Collected first: `grep -q` leaving early would break the pipe and, under
  # pipefail, read as "nothing needs a restart".
  local changed
  changed="$(git diff --name-only "$1" "$2")"
  [ -n "$changed" ] && printf '%s\n' "$changed" | grep -Ev "$QUIET_PATHS" >/dev/null
}

build_client() {
  echo "→ building client bundle…"
  npm run build:client
}

wait_healthy() {
  echo "→ waiting for /healthz…"
  local i
  for i in $(seq 1 20); do
    if curl -fsS "http://localhost:${PORT}/healthz" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

quiet_deploy() {  # $1 = new rev
  echo "→ client and site changes only: going live without a restart"
  git reset --hard "$1"
  build_client
  if curl -fsS "http://localhost:${PORT}/healthz" >/dev/null 2>&1; then
    echo "✓ live, no restart, nobody disconnected"
  else
    echo "✗ files updated, but the server is not answering /healthz"
    echo "  check logs:  journalctl -u ${SERVICE} -n 80 --no-pager"
    return 1
  fi
}

full_deploy() {  # $1 = new rev
  # Tell the uptime heartbeat (ops/heartbeat.sh) a deploy is in progress, so the
  # brief /healthz gap during the restart doesn't trip a false DOWN alert. The
  # flag is removed on EXIT, success or failure, so a broken deploy still alerts.
  trap 'rm -f "$DEPLOY_FLAG"' EXIT
  if [ -f "$APP_DIR/.backup.env" ]; then set -a; . "$APP_DIR/.backup.env"; set +a; fi

  echo "→ syncing to origin/main (discarding local build-artifact changes)…"
  git reset --hard "$1"
  echo "→ installing runtime deps…"
  npm install --omit=dev --no-audit --no-fund
  build_client

  echo "→ restarting $SERVICE…"
  : > "$DEPLOY_FLAG"
  systemctl restart "$SERVICE"
  printf '%s\n' "$1" > "$RUNNING_REV_FILE"

  if wait_healthy; then
    echo "✓ deployed and healthy"
    [ -n "${HEARTBEAT_HC_URL:-}" ] && curl -fsS -m 10 "${HEARTBEAT_HC_URL}" >/dev/null 2>&1 || true
    return 0
  fi
  echo "✗ server did not become healthy within 20s"
  echo "  check logs:  journalctl -u ${SERVICE} -n 80 --no-pager"
  return 1
}

waiter_alive() {
  [ -s "$WAITER_PID_FILE" ] && kill -0 "$(cat "$WAITER_PID_FILE")" 2>/dev/null
}

start_waiter() {
  if waiter_alive; then echo "  (already waiting for the town to empty)"; return 0; fi
  # A transient systemd unit survives the SSH session ending for certain; fall
  # back to a detached process where systemd-run is not there.
  if [ -d /run/systemd/system ] && command -v systemd-run >/dev/null 2>&1 \
     && systemd-run --quiet --collect --unit="${SERVICE}-deploy-wait" bash "$SELF" --wait >/dev/null 2>&1; then
    return 0
  fi
  setsid nohup bash "$SELF" --wait >> "$WAIT_LOG" 2>&1 < /dev/null 9>&- &
}

run_waiter() {
  echo "$$" > "$WAITER_PID_FILE"
  trap 'rm -f "$WAITER_PID_FILE"' EXIT
  local waited=0 empty=0
  echo "[$(date -u +%FT%TZ)] waiting for an empty town (up to ${MAX_WAIT_S}s)"
  while [ "$waited" -lt "$MAX_WAIT_S" ]; do
    if [ "$(players_online)" = "0" ]; then empty=$((empty + 1)); else empty=0; fi
    [ "$empty" -ge 2 ] && break          # two looks in a row, not a blip
    sleep "$POLL_S"; waited=$((waited + POLL_S))
  done
  echo "[$(date -u +%FT%TZ)] going ahead after ${waited}s"
  rm -f "$WAITER_PID_FILE"; trap - EXIT
  exec bash "$SELF" --now
}

main() {
  local mode="auto"
  case " ${1:-} ${SSH_ORIGINAL_COMMAND:-} " in
    *" --wait "*) mode="wait" ;;
    *" --now "*)  mode="now" ;;
  esac

  cd "$APP_DIR"
  if [ "$mode" = "wait" ]; then run_waiter; return; fi

  # One deploy at a time.
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$APP_DIR/.deploy.lock"
    flock -w 600 9 || { echo "✗ another deploy has held the lock for 10 minutes"; exit 1; }
  fi

  git fetch origin main
  local running new online
  running="$(running_rev)"
  new="$(git rev-parse origin/main)"

  if [ "$running" = "$new" ] && [ "$(git rev-parse HEAD)" = "$new" ]; then
    echo "✓ nothing new to deploy"
    return 0
  fi

  if ! needs_restart "$running" "$new"; then
    quiet_deploy "$new"
    return
  fi

  online="$(players_online)"
  if [ "$mode" = "now" ] || [ "$online" = "0" ]; then
    [ "$online" = "0" ] && echo "→ the town is empty: a restart disturbs nobody"
    full_deploy "$new"
    return
  fi

  echo "→ server code changed and ${online} player(s) are in town"
  echo "  not restarting under them: the update lands when the town is empty"
  echo "  (or after $((MAX_WAIT_S / 3600)) h; force it with: deploy.sh --now)"
  start_waiter
}

main "$@"
exit $?
