#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Thornreach backups — one-shot, idempotent installer.
#
# Does everything the ops/README-ops.md walkthrough does, in one run:
#   1. installs deps (rclone, gpg, sqlite3, curl)
#   2. configures the rclone "b2" remote (optional — skip if already set)
#   3. writes /opt/town-chat/.backup.env (chmod 600), REUSING an existing
#      encryption passphrase so re-runs never orphan old backups
#   4. makes backup.sh / heartbeat.sh executable
#   5. installs the nightly-backup + 5-min-heartbeat cron lines (idempotent)
#   6. runs one real backup + one heartbeat as a smoke test
#
# What it canNOT do (accounts live in a browser): create the Backblaze B2
# bucket + application key, or the two Healthchecks.io checks. Have those ready
# first (see ops/README-ops.md §2–§3); the script prompts for the values.
#
# Safe to re-run any time (e.g. standing up a replacement VPS). Run as root:
#   sudo bash /opt/town-chat/ops/setup-backups.sh
# ---------------------------------------------------------------------------
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SELF_DIR")"
ENVF="$APP_DIR/.backup.env"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
die()  { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run as root:  sudo bash $0"

# Pull any existing values so re-runs default to what's already configured
# (critically, the existing passphrase — regenerating it would make every
# archive already in B2 impossible to decrypt).
OLD_DATA_DIR=""; OLD_REMOTE=""; OLD_PASS=""; OLD_BK_HC=""; OLD_HB_HC=""; OLD_KEEP=""; OLD_HEALTHZ=""
if [ -f "$ENVF" ]; then
  # shellcheck disable=SC1090
  . "$ENVF"
  OLD_DATA_DIR="${DATA_DIR:-}"; OLD_REMOTE="${BACKUP_REMOTE:-}"; OLD_PASS="${BACKUP_GPG_PASSPHRASE:-}"
  OLD_BK_HC="${BACKUP_HC_URL:-}"; OLD_HB_HC="${HEARTBEAT_HC_URL:-}"; OLD_KEEP="${BACKUP_KEEP_DAYS:-}"; OLD_HEALTHZ="${HEALTHZ_URL:-}"
  bold "Found an existing $ENVF — its values are the defaults below (press Enter to keep)."
fi

ask() { # ask VAR "prompt" "default"
  local __var="$1" __prompt="$2" __def="${3:-}" __ans
  if [ -n "$__def" ]; then read -rp "$__prompt [$__def]: " __ans; else read -rp "$__prompt: " __ans; fi
  printf -v "$__var" '%s' "${__ans:-$__def}"
}

bold "== Thornreach backup installer =="

# 1) Dependencies -----------------------------------------------------------
bold "[1/6] Installing dependencies (rclone, gpg, sqlite3, curl)…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1 || info "apt update had warnings (continuing)"
apt-get install -y rclone gpg sqlite3 curl openssl >/dev/null 2>&1 || die "apt install failed — run it by hand to see why"
info "ok: $(rclone version 2>/dev/null | head -1)"

# 2) rclone B2 remote -------------------------------------------------------
bold "[2/6] rclone 'b2' remote"
if rclone listremotes 2>/dev/null | grep -qx 'b2:'; then
  info "an rclone 'b2' remote already exists."
  ask RECONF "Reconfigure it with a new key? (y/N)" "N"
else
  RECONF="y"; info "no 'b2' remote yet — let's add one."
fi
if [ "${RECONF,,}" = "y" ]; then
  read -rp "  Backblaze keyID: " B2_ID
  read -rsp "  Backblaze applicationKey (hidden): " B2_KEY; echo
  [ -n "$B2_ID" ] && [ -n "$B2_KEY" ] || die "both keyID and applicationKey are required"
  rclone config create b2 b2 account "$B2_ID" key "$B2_KEY" >/dev/null || die "rclone config failed"
  info "rclone 'b2' remote configured."
fi

# 3) Collect the rest + write .backup.env -----------------------------------
bold "[3/6] Backup configuration"
ask DATA_DIR  "  DATA_DIR (the game's data dir)" "${OLD_DATA_DIR:-/opt/town-chat/data}"
ask BUCKETPATH "  B2 target (remote:bucket/path)" "${OLD_REMOTE:-b2:thornreach-backups/nightly}"
ask KEEP      "  Retention in days" "${OLD_KEEP:-30}"
ask HEALTHZ   "  Local health URL" "${OLD_HEALTHZ:-http://localhost:3000/healthz}"
read -rp "  Healthchecks BACKUP ping URL [${OLD_BK_HC:-none}]: " BK_HC; BK_HC="${BK_HC:-$OLD_BK_HC}"
read -rp "  Healthchecks HEARTBEAT ping URL [${OLD_HB_HC:-none}]: " HB_HC; HB_HC="${HB_HC:-$OLD_HB_HC}"

# Passphrase: reuse the existing one; only generate when there isn't one, so
# re-running against live B2 archives never locks you out of them.
if [ -n "$OLD_PASS" ]; then
  PASS="$OLD_PASS"; info "reusing the existing encryption passphrase."
else
  PASS="$(openssl rand -base64 48)"
  echo
  bold   "  A NEW encryption passphrase was generated. SAVE IT OFF THIS SERVER NOW:"
  printf '\033[33m    %s\033[0m\n' "$PASS"
  bold   "  It is the ONLY thing that can decrypt your backups. Put it in a password manager."
  ack=""; while [ "$ack" != "saved" ]; do read -rp "  Type 'saved' once it's stored safely: " ack; done
fi

umask 077
cat > "$ENVF" <<EOF
# Thornreach backup config — written by ops/setup-backups.sh. chmod 600.
DATA_DIR=$DATA_DIR
BACKUP_REMOTE=$BUCKETPATH
BACKUP_GPG_PASSPHRASE=$PASS
BACKUP_HC_URL=$BK_HC
BACKUP_KEEP_DAYS=$KEEP
HEARTBEAT_HC_URL=$HB_HC
HEALTHZ_URL=$HEALTHZ
EOF
chmod 600 "$ENVF"
info "wrote $ENVF (-rw-------)"

# 4) Make the runners executable -------------------------------------------
bold "[4/6] Marking scripts executable"
chmod +x "$SELF_DIR/backup.sh" "$SELF_DIR/heartbeat.sh"
info "ok"

# 5) Cron (idempotent: strip any prior Thornreach lines, then add) ----------
bold "[5/6] Scheduling cron (nightly backup 04:17 UTC + 5-min heartbeat)"
NEW_CRON="$(crontab -l 2>/dev/null | grep -vF 'ops/backup.sh' | grep -vF 'ops/heartbeat.sh' || true)"
{
  printf '%s\n' "$NEW_CRON"
  echo "17 4 * * * $SELF_DIR/backup.sh >> /var/log/thornreach-backup.log 2>&1"
  echo "*/5 * * * * $SELF_DIR/heartbeat.sh"
} | crontab -
info "cron installed:"; crontab -l | sed 's/^/    /'

# 6) Smoke test -------------------------------------------------------------
bold "[6/6] Running one backup + one heartbeat now…"
if "$SELF_DIR/backup.sh"; then info "backup ok"; else die "backup.sh failed — fix the config above and re-run"; fi
"$SELF_DIR/heartbeat.sh" && info "heartbeat sent"

echo
bold "Done. Thornreach is backing up nightly, offsite and encrypted."
info "Verify in B2:   rclone ls $BUCKETPATH"
info "Restore drill:  see ops/README-ops.md §7 (do it once so you trust it)."
[ -n "$OLD_PASS" ] || info "Reminder: your encryption passphrase must live in a password manager, off this box."
