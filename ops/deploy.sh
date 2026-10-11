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

echo "→ pulling latest (fast-forward only)…"
git pull --ff-only

echo "→ installing runtime deps…"
npm install --omit=dev --no-audit --no-fund

echo "→ building client bundle…"
npm run build:client

echo "→ restarting $SERVICE…"
systemctl restart "$SERVICE"

echo "→ waiting for /healthz…"
for i in $(seq 1 20); do
  if curl -fsS "http://localhost:${PORT}/healthz" >/dev/null 2>&1; then
    echo "✓ deployed and healthy"
    exit 0
  fi
  sleep 1
done

echo "✗ server did not become healthy within 20s"
echo "  check logs:  journalctl -u ${SERVICE} -n 80 --no-pager"
exit 1
