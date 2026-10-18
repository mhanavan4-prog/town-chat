// Live site presence (Session N) — a tiny in-memory "who's on the site right
// now" tracker. Every non-game page beacons a per-tab id to /api/presence on a
// timer; a tab counts as present for TTL ms after its last beacon, so closing
// the tab (beacons stop) drops it within one window. In-game players are NOT
// tracked here — they already hold a live WebSocket, and are counted from that
// — so the two populations don't double up except briefly while a visitor is
// walking from the landing page into the game.
//
// This is deliberately ephemeral and PII-free: just opaque tab ids and the last
// time each pinged. Nothing is persisted; a restart simply re-fills within one
// window as tabs beacon again. Bounded so a flood of junk ids can't grow it
// without limit.
module.exports = function createPresence(opts) {
  opts = opts || {};
  const TTL = opts.ttlMs || 35000;     // a tab is "present" for 35s after its last ping
  const MAX = opts.max || 50000;       // hard cap on tracked tabs (memory guard)
  const seen = new Map();              // sid -> lastSeen (ms)

  function prune(now) {
    now = now || Date.now();
    for (const [sid, t] of seen) if (now - t > TTL) seen.delete(sid);
  }
  // Record a heartbeat from one tab. Ignores anything that isn't a short string
  // id; caps id length so a caller can't wedge huge keys into the map.
  function touch(sid) {
    if (!sid || typeof sid !== 'string') return;
    sid = sid.slice(0, 64);
    const now = Date.now();
    if (!seen.has(sid) && seen.size >= MAX) { prune(now); if (seen.size >= MAX) return; }
    seen.set(sid, now);
  }
  // Live count of present tabs (prunes stale ones first).
  function count() { prune(); return seen.size; }

  return { touch, count, prune };
};
