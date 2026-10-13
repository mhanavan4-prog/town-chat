#!/usr/bin/env bash
# Bootstrap + run the Thornreach load swarm on a fresh Linux VM (Ubuntu/Debian).
# One generator machine is capped as a *receiver* around ~100 streams, so to
# certify a big concurrent count you run this on several VMs at once, each
# throwing a slice, all firing in unison via a shared START_AT.
#
# Usage (on each VM, after this script + swarm.mjs are present together):
#   TARGET=ws://5.161.162.55:3000 N=80 DUR=60 WILDS=0.5 SCATTER=1 \
#   START_AT=$(($(date +%s)+120)) bash remote-swarm.sh
#
# Env:
#   TARGET    ws://host:port of the game server            (required)
#   N         clients this VM runs                         (default 80)
#   DUR       seconds to hold after ramp                   (default 60)
#   WILDS     fraction sent to the Wilds (0..1)            (default 0.5)
#   SCATTER   1 = spread clients across the map            (default 1)
#   MOVE      moves/sec per client                         (default 3)
#   START_AT  unix-seconds for a synchronized start; use   (default: now)
#             the SAME value on every VM so they fire together
set -euo pipefail
cd "$(dirname "$0")"

TARGET="${TARGET:?set TARGET=ws://host:port}"
N="${N:-80}"; DUR="${DUR:-60}"; WILDS="${WILDS:-0.5}"; SCATTER="${SCATTER:-1}"
MOVE="${MOVE:-3}"; START_AT="${START_AT:-0}"

if [ ! -f swarm.mjs ]; then
  echo "error: swarm.mjs must sit next to this script (git clone the repo, or scp loadtest/swarm.mjs here)." >&2
  exit 2
fi

# Node (skip if already present). Uses NodeSource for a current LTS.
if ! command -v node >/dev/null 2>&1; then
  echo "installing node…"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null 2>&1
  sudo apt-get install -y nodejs >/dev/null 2>&1
fi
echo "node $(node -v)"

# ws (local, throwaway)
if [ ! -d node_modules/ws ]; then
  echo "installing ws…"
  npm init -y >/dev/null 2>&1 || true
  npm install ws@8 >/dev/null 2>&1
fi

ARGS=( "$TARGET" --n "$N" --dur "$DUR" --wilds "$WILDS" --move "$MOVE" )
[ "$SCATTER" = "1" ] && ARGS+=( --scatter )
[ "$START_AT" != "0" ] && ARGS+=( --at "$START_AT" )

echo "running: node swarm.mjs ${ARGS[*]}"
exec node swarm.mjs "${ARGS[@]}"
