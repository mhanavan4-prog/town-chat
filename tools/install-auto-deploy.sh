#!/usr/bin/env bash
# ============================================================================
#  Install Thornreach auto-deploy — one-time, run as root ON THE SERVER:
#
#      sudo bash /opt/town-chat/tools/install-auto-deploy.sh
#
#  Sets up a systemd timer that runs tools/auto-deploy.sh every 2 minutes:
#  it pulls origin/main and restarts the service only when a server-side file
#  changed (client-only changes land live with no restart). Pull-based, so no
#  SSH key to prod ever lives in CI.
#
#  Idempotent: re-running just refreshes the unit files. Remove it later with:
#      sudo systemctl disable --now thornreach-deploy.timer
#      sudo rm /etc/systemd/system/thornreach-deploy.{service,timer}
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/town-chat}"
RUN_USER="${RUN_USER:-thornreach}"
SERVICE="${SERVICE:-thornreach}"
BRANCH="${BRANCH:-main}"
INTERVAL="${INTERVAL:-2min}"
LOG="/var/log/thornreach-deploy.log"

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root: sudo bash $0" >&2
  exit 1
fi

if [ ! -x "$APP_DIR/tools/auto-deploy.sh" ]; then
  chmod +x "$APP_DIR/tools/auto-deploy.sh" 2>/dev/null || {
    echo "Can't find $APP_DIR/tools/auto-deploy.sh — pull main first." >&2; exit 1; }
fi

touch "$LOG"; chown "$RUN_USER":"$RUN_USER" "$LOG" 2>/dev/null || true

echo "Writing /etc/systemd/system/thornreach-deploy.service"
cat > /etc/systemd/system/thornreach-deploy.service <<EOF
[Unit]
Description=Thornreach auto-deploy (pull origin/$BRANCH, restart only on server-side changes)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
# Runs as root so it can restart the service; the script itself drops to
# $RUN_USER (sudo -u) for every git/npm step so repo ownership stays clean.
Environment=APP_DIR=$APP_DIR RUN_USER=$RUN_USER SERVICE=$SERVICE BRANCH=$BRANCH
ExecStart=/usr/bin/env bash $APP_DIR/tools/auto-deploy.sh
EOF

echo "Writing /etc/systemd/system/thornreach-deploy.timer"
cat > /etc/systemd/system/thornreach-deploy.timer <<EOF
[Unit]
Description=Run Thornreach auto-deploy every $INTERVAL

[Timer]
OnBootSec=1min
OnUnitActiveSec=$INTERVAL
AccuracySec=15s
Unit=thornreach-deploy.service

[Install]
WantedBy=timers.target
EOF

echo "Reloading systemd + enabling the timer"
systemctl daemon-reload
systemctl enable --now thornreach-deploy.timer

echo
echo "Done. The server now checks origin/$BRANCH every $INTERVAL."
echo "  Watch it:     journalctl -u thornreach-deploy.service -f"
echo "  Deploy log:   tail -f $LOG"
echo "  Force a run:  sudo systemctl start thornreach-deploy.service"
echo "  Timer status: systemctl list-timers thornreach-deploy.timer"
