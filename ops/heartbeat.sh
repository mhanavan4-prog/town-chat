#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Thornreach uptime heartbeat.
#
# Run from cron every few minutes. It checks the game is actually serving
# (/healthz returns 200) and, only then, pings a Healthchecks.io URL. The
# logic covers both failure modes with one free check:
#   * the whole box/network is down  -> cron can't run -> no ping -> HC alerts
#   * the box is up but Node is dead  -> /healthz fails  -> no ping -> HC alerts
# Healthchecks then routes the alert to Discord/email (configured in HC).
#
# Config — set in /opt/town-chat/.backup.env (shared with backup.sh), chmod 600:
#   HEARTBEAT_HC_URL   Healthchecks.io ping URL for the "heartbeat" check
#   HEALTHZ_URL        local health endpoint (default http://localhost:3000/healthz)
# ---------------------------------------------------------------------------
set -uo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SELF_DIR")"
if [ -f "$APP_DIR/.backup.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$APP_DIR/.backup.env"; set +a
fi

HC="${HEARTBEAT_HC_URL:-}"
HEALTHZ="${HEALTHZ_URL:-http://localhost:3000/healthz}"

[ -n "$HC" ] || { echo "HEARTBEAT_HC_URL not set"; exit 0; }

# A deploy restarts the server for a second or two; deploy.sh drops a
# "$APP_DIR/.deploying" flag across that window. If the flag is present AND
# fresh (touched within the last 3 min), we skip the fail-ping for a transient
# unhealthy reading — a real outage still alerts, because a stale flag is
# ignored and a stuck deploy stops pinging success entirely.
deploying=0
FLAG="$APP_DIR/.deploying"
if [ -f "$FLAG" ]; then
  now="$(date +%s)"
  mt="$(stat -c %Y "$FLAG" 2>/dev/null || stat -f %m "$FLAG" 2>/dev/null || echo 0)"
  [ $((now - mt)) -lt 180 ] && deploying=1
fi

code="$(curl -fsS -m 10 -o /dev/null -w '%{http_code}' "$HEALTHZ" 2>/dev/null || echo 000)"
if [ "$code" = "200" ]; then
  curl -fsS -m 10 --retry 3 "$HC" >/dev/null 2>&1 || true   # healthy -> ping
elif [ "$deploying" = "1" ]; then
  :   # deploy in progress — ignore the brief restart gap, don't fail yet
else
  curl -fsS -m 10 --retry 3 "$HC/fail" >/dev/null 2>&1 || true   # serving but unhealthy -> fail now
fi
