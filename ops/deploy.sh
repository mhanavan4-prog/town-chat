#!/usr/bin/env bash
# Safe one-command deploy. Run on the VPS:  sudo bash /opt/town-chat/ops/deploy.sh
#
# Pulls latest, rebuilds the client bundle, restarts under systemd (which does a
# graceful SIGTERM → the server warns players and flushes before exit), then
# waits for /healthz to confirm it came back. Exits non-zero (and tells you where
# to look) if it didn't, so a bad deploy is obvious instead of silent.
#
# Assumes the systemd unit from ops/thornreach.service is installed as
# "thornreach". Change APP_DIR / SERVICE / PORT below if yours differ.
set -euo pipefail

APP_DIR=/opt/town-chat
SERVICE=thornreach
PORT=3000

cd "$APP_DIR"

# Tell the uptime heartbeat (ops/heartbeat.sh) a deploy is in progress, so the
# brief /healthz gap during the restart below doesn't trip a false DOWN alert.
# The flag is removed on EXIT — success OR failure — so a genuinely broken
# deploy still lets the heartbeat alert on the next cron tick.
DEPLOY_FLAG="$APP_DIR/.deploying"
trap 'rm -f "$DEPLOY_FLAG"' EXIT
# Load .backup.env (if present) for HEARTBEAT_HC_URL, used to nudge the monitor
# back to UP right after a good deploy instead of waiting for the next cron.
if [ -f "$APP_DIR/.backup.env" ]; then set -a; . "$APP_DIR/.backup.env"; set +a; fi

echo "→ syncing to origin/main (discarding local build-artifact changes)…"
# Hard-reset instead of `git pull --ff-only`: the build step below re-stamps
# public/index.html and rewrites public/client.js, both tracked files, so the
# working tree is always dirty after a deploy. A plain pull then aborts the
# next time an incoming commit touches those files ("local changes would be
# overwritten"). Fetch + reset throws away that build residue and lands exactly
# on origin/main every time; the bundle is rebuilt immediately after anyway.
git fetch origin main
git reset --hard origin/main

echo "→ installing runtime deps…"
npm install --omit=dev --no-audit --no-fund

echo "→ building client bundle…"
npm run build:client

echo "→ restarting $SERVICE…"
: > "$DEPLOY_FLAG"            # heartbeat holds its fail-ping while this exists
systemctl restart "$SERVICE"

echo "→ waiting for /healthz…"
for i in $(seq 1 20); do
  if curl -fsS "http://localhost:${PORT}/healthz" >/dev/null 2>&1; then
    echo "✓ deployed and healthy"
    # Nudge the uptime monitor straight back to UP (clears any fail that fired
    # during the restart) instead of waiting up to 5 min for the next cron.
    [ -n "${HEARTBEAT_HC_URL:-}" ] && curl -fsS -m 10 "${HEARTBEAT_HC_URL}" >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 1
done

echo "✗ server did not become healthy within 20s"
echo "  check logs:  journalctl -u ${SERVICE} -n 80 --no-pager"
exit 1
