#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Thornreach offsite backup.
#
# Everything the game owns — the SQLite database (all accounts, purchases,
# progress), the image-evidence store, the security logs, the JSON backups,
# and the .env (so a rebuild has its keys) — is snapshotted, encrypted, and
# pushed OFF the server to object storage (Backblaze B2 via rclone). On
# success it pings a Healthchecks.io URL so you're alerted if a night is ever
# missed. Old archives are pruned past a retention window.
#
# This protects against the one failure the on-box .json.bak exports cannot:
# losing the whole VPS (deletion, disk death, corruption). Run it nightly.
#
# Config — set these in /opt/town-chat/.backup.env (sourced below, chmod 600):
#   DATA_DIR               where the game's data lives (same as the service)
#   BACKUP_REMOTE          rclone target, e.g. b2:thornreach-backups/nightly
#   BACKUP_GPG_PASSPHRASE  symmetric passphrase — SAVE A COPY OFF THE BOX, or
#                          these backups can never be decrypted (password mgr!)
#   BACKUP_HC_URL          Healthchecks.io ping URL (optional but recommended)
#   BACKUP_KEEP_DAYS       retention in days (default 30)
#
# Restore is documented in ops/README-ops.md.
# ---------------------------------------------------------------------------
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SELF_DIR")"

# Load config (secrets live here, not in git).
if [ -f "$APP_DIR/.backup.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$APP_DIR/.backup.env"; set +a
fi

DATA_DIR="${DATA_DIR:-$APP_DIR}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
HC="${BACKUP_HC_URL:-}"

log() { echo "[backup $(date -u +%FT%TZ)] $*"; }
hc_ping() { [ -n "$HC" ] && curl -fsS -m 10 --retry 3 "$HC$1" >/dev/null 2>&1 || true; }

# Tell Healthchecks we've started; on ANY failure, signal /fail before exiting.
hc_ping "/start"
fail() { log "FAILED: $*"; hc_ping "/fail"; exit 1; }
trap 'fail "unexpected error on line $LINENO"' ERR

[ -n "${BACKUP_REMOTE:-}" ] || fail "BACKUP_REMOTE is not set"
[ -n "${BACKUP_GPG_PASSPHRASE:-}" ] || fail "BACKUP_GPG_PASSPHRASE is not set"
command -v rclone >/dev/null || fail "rclone is not installed"
command -v gpg >/dev/null || fail "gpg is not installed"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
WORK="$(mktemp -d /tmp/tr-backup.XXXXXX)"
trap 'rm -rf "$WORK"; ' EXIT   # always clean the plaintext work dir

log "snapshotting from $DATA_DIR"

# 1) Consistent SQLite snapshot. .backup is safe while the server is live and
#    writing (WAL mode) — a plain cp could catch a torn write.
if [ -f "$DATA_DIR/thornreach.db" ]; then
  if command -v sqlite3 >/dev/null; then
    sqlite3 "$DATA_DIR/thornreach.db" ".backup '$WORK/thornreach.db'" || fail "sqlite .backup failed"
  else
    # No sqlite3 CLI: fall back to the always-current .json.bak exports the app
    # writes every 15 min, plus a raw copy (best-effort). Install sqlite3 to fix.
    log "WARN: sqlite3 not found — relying on .json.bak exports; install sqlite3 for a true DB snapshot"
    cp -a "$DATA_DIR/thornreach.db" "$WORK/thornreach.db.rawcopy" 2>/dev/null || true
  fi
fi

# 2) Everything else worth keeping. Evidence + security logs are legally
#    meaningful; the .json.bak files are the plaintext mirror of the DB; .env
#    carries the keys needed to stand the service back up.
mkdir -p "$WORK/data"
cp -a "$DATA_DIR"/*.json.bak "$WORK/data/" 2>/dev/null || true
cp -a "$DATA_DIR/evidence"   "$WORK/data/" 2>/dev/null || true
cp -a "$DATA_DIR/security"   "$WORK/data/" 2>/dev/null || true
cp -a "$APP_DIR/.env"        "$WORK/data/env.txt" 2>/dev/null || true

# 3) One archive, encrypted at rest (symmetric AES-256 via gpg).
ARCHIVE="$WORK/thornreach-$STAMP.tar.gz"
tar -C "$WORK" -czf "$ARCHIVE" thornreach.db data 2>/dev/null \
  || tar -C "$WORK" -czf "$ARCHIVE" data   # if no db snapshot, still back up the rest
ENC="$ARCHIVE.gpg"
printf '%s' "$BACKUP_GPG_PASSPHRASE" | gpg --batch --yes --quiet \
  --passphrase-fd 0 --cipher-algo AES256 --symmetric --output "$ENC" "$ARCHIVE" \
  || fail "gpg encryption failed"
SIZE="$(du -h "$ENC" | cut -f1)"
log "encrypted archive is $SIZE"

# 4) Push offsite and prune old copies past the retention window.
rclone copy "$ENC" "$BACKUP_REMOTE/" --no-traverse || fail "rclone copy failed"
rclone delete "$BACKUP_REMOTE/" --min-age "${BACKUP_KEEP_DAYS}d" --include '*.tar.gz.gpg' 2>/dev/null || true
log "uploaded $(basename "$ENC") to $BACKUP_REMOTE (keeping ${BACKUP_KEEP_DAYS}d)"

trap - ERR
hc_ping ""   # success ping
log "done"
