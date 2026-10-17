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

# Send a ping to Healthchecks, returning 0 only if it actually landed. The box
# reaches healthchecks.io over IPv6 and that path can flap independently of the
# game's own connectivity; a silently-dropped ping reads as "down" even while
# players are connected fine. So fall back to IPv4 if the first try fails.
hc_ping() {
  curl -fsS -m 10 --retry 2 "$1" >/dev/null 2>&1 && return 0
  curl -fsS -m 10 --retry 2 --ipv4 "$1" >/dev/null 2>&1 && return 0
  return 1
}

# /healthz can momentarily time out when the event loop is busy; retry a few
# times before concluding the server is unhealthy, so a single blip under load
# doesn't fire a false fail.
code=000
for _ in 1 2 3; do
  code="$(curl -fsS -m 8 -o /dev/null -w '%{http_code}' "$HEALTHZ" 2>/dev/null || echo 000)"
  [ "$code" = "200" ] && break
  sleep 2
done

action="?"; ping="na"
if [ "$code" = "200" ]; then
  action="up";   hc_ping "$HC"      && ping="sent" || ping="SEND-FAILED"
elif [ "$deploying" = "1" ]; then
  action="skip(deploy)"            # brief restart gap — don't fail yet
else
  action="fail"; hc_ping "$HC/fail" && ping="sent" || ping="SEND-FAILED"
fi

# One line per run so a false "down" is diagnosable after the fact: was the
# server unhealthy (healthz!=200), or did the ping just fail to egress
# (ping=SEND-FAILED)? Keep the tail trimmed so it never grows unbounded.
LOG="$APP_DIR/heartbeat.log"
printf '%s healthz=%s action=%s ping=%s\n' "$(date -u +%FT%TZ)" "$code" "$action" "$ping" >> "$LOG" 2>/dev/null || true
if [ "$(wc -l < "$LOG" 2>/dev/null || echo 0)" -gt 600 ]; then
  tail -n 500 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG" 2>/dev/null || true
fi
