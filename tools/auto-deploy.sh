#!/usr/bin/env bash
# ============================================================================
#  Thornreach auto-deploy — pull main and (only when needed) restart.
#
#  Runs on the production box from a systemd timer (see install-auto-deploy.sh).
#  Pull-based on purpose: the server reaches OUT to GitHub, so no prod SSH key
#  ever lives in CI and nothing inbound is exposed.
#
#  Smart restart: client-only changes (public/, client/) are served straight
#  off disk by express.static, so they need NO restart — players stay
#  connected. Only a change to server-side code/data (server.js, lib/, data/,
#  package*.json) bounces the service, and npm install runs only when the
#  lockfile moved.
#
#  Safe to run every couple of minutes: a no-op when main hasn't moved, and
#  flock-guarded so two ticks never overlap.
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/town-chat}"
RUN_USER="${RUN_USER:-thornreach}"
SERVICE="${SERVICE:-thornreach}"
BRANCH="${BRANCH:-main}"
LOG="${DEPLOY_LOG:-/var/log/thornreach-deploy.log}"

log(){ printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"; }

# Run the whole thing under a lock so overlapping timer ticks can't collide.
exec 9>"/tmp/thornreach-deploy.lock"
if ! flock -n 9; then
  exit 0   # a previous tick is still running; skip quietly
fi

cd "$APP_DIR"

# Git operations run as the owning user so file ownership stays clean.
asuser(){ sudo -u "$RUN_USER" "$@"; }

asuser git fetch --quiet origin "$BRANCH" || { log "ERROR: git fetch failed"; exit 1; }

OLD="$(asuser git rev-parse HEAD)"
NEW="$(asuser git rev-parse "origin/$BRANCH")"

if [ "$OLD" = "$NEW" ]; then
  exit 0   # already up to date — the common case, stay silent
fi

log "Updating $OLD -> $NEW"
if ! asuser git merge --ff-only "origin/$BRANCH" >>"$LOG" 2>&1; then
  log "ERROR: ff-only merge failed (local divergence?) — leaving prod untouched"
  exit 1
fi

CHANGED="$(asuser git diff --name-only "$OLD" "$NEW")"

# Dependencies first, but only if the lockfile actually moved.
if grep -qE '^(package\.json|package-lock\.json)$' <<<"$CHANGED"; then
  log "Lockfile changed — npm install --omit=dev"
  asuser npm install --omit=dev >>"$LOG" 2>&1 || { log "ERROR: npm install failed"; exit 1; }
fi

# Restart ONLY when something the running process holds in memory changed.
# Client assets (public/, client/) are read fresh from disk per request, so
# they need no bounce.
if grep -qE '^(server\.js|lib/|data/|package\.json|package-lock\.json)' <<<"$CHANGED"; then
  log "Server-side change detected — restarting $SERVICE"
  systemctl restart "$SERVICE"
  sleep 2
  if systemctl is-active --quiet "$SERVICE"; then
    log "OK: $SERVICE is active after restart"
  else
    log "ERROR: $SERVICE is NOT active after restart — check: journalctl -u $SERVICE"
    exit 1
  fi
else
  log "Client-only change — new files served live, no restart needed"
fi

log "Deploy complete: now at $NEW"
