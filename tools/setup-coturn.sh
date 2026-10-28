#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Set up a coturn TURN relay for Thornreach coven voice (WebRTC).
#
#   Run as root ON THE GAME SERVER:   bash tools/setup-coturn.sh
#
# Why: STUN alone can't punch through symmetric NATs / locked-down wifi, so
# voice "connects but no one hears anyone" (roster shows "link failed"). A TURN
# relay is the fallback that makes the media path work anywhere. The game reads
# TURN_URLS + TURN_SECRET from /opt/town-chat/.env; this configures coturn to
# match server.js buildIceConfig()'s REST credential scheme (use-auth-secret).
#
# Overrides (env):  EXTERNAL_IP=1.2.3.4  REALM=example.com  ENV_FILE=/path/.env
# ---------------------------------------------------------------------------
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Run as root:  sudo bash $0"; exit 1; fi

EXTERNAL_IP="${EXTERNAL_IP:-$(ip -4 route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[0-9.]+' || true)}"
if [ -z "${EXTERNAL_IP:-}" ]; then echo "Could not detect public IP — re-run with EXTERNAL_IP=<your.ip>"; exit 1; fi
REALM="${REALM:-thornreach.com}"
ENV_FILE="${ENV_FILE:-/opt/town-chat/.env}"

echo "==> Installing coturn"
apt-get update -y
apt-get install -y coturn

echo "==> Generating a fresh TURN secret"
SECRET="$(openssl rand -hex 32)"

echo "==> Writing /etc/turnserver.conf  (external-ip=$EXTERNAL_IP, realm=$REALM)"
cat > /etc/turnserver.conf <<EOF
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=$SECRET
realm=$REALM
external-ip=$EXTERNAL_IP
min-port=49152
max-port=65535
no-multicast-peers
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
EOF

echo "==> Enabling the coturn daemon"
if grep -q '^#*TURNSERVER_ENABLED=' /etc/default/coturn 2>/dev/null; then
  sed -i 's/^#*TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
else
  echo 'TURNSERVER_ENABLED=1' >> /etc/default/coturn
fi
systemctl enable coturn >/dev/null 2>&1 || true
systemctl restart coturn

echo "==> Opening host firewall ports (ufw, if present)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 3478/tcp >/dev/null 2>&1 || true
  ufw allow 3478/udp >/dev/null 2>&1 || true
  ufw allow 49152:65535/udp >/dev/null 2>&1 || true
fi

echo "==> Updating $ENV_FILE"
if [ -f "$ENV_FILE" ]; then
  sed -i '/^TURN_URLS=/d;/^TURN_SECRET=/d' "$ENV_FILE"
  printf 'TURN_URLS=turn:%s:3478\nTURN_SECRET=%s\n' "$EXTERNAL_IP" "$SECRET" >> "$ENV_FILE"
  echo "    set TURN_URLS + TURN_SECRET in $ENV_FILE"
else
  echo "    $ENV_FILE not found — add these two lines to it yourself:"
  echo "    TURN_URLS=turn:$EXTERNAL_IP:3478"
  echo "    TURN_SECRET=$SECRET"
fi

echo
echo "==> coturn status:"
systemctl --no-pager --full status coturn | head -n 6 || true
echo
echo "----------------------------------------------------------------------"
echo "NEXT: restart the game so it picks up the new env:"
echo "    systemctl restart thornreach.service"
echo
echo "If you run the HETZNER CLOUD FIREWALL (in the web console, separate from"
echo "ufw), you MUST also allow there:  UDP 3478  and  UDP 49152-65535."
echo "That's the #1 reason TURN is configured but voice still fails."
echo "----------------------------------------------------------------------"
