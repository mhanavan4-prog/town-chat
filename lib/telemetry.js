'use strict';
// Client-health telemetry (Session N).
//
// Two things the game had no eyes on until now:
//   1. How long it takes a real browser to reach "playable" (first render after
//      join), and whether the ~18MB of streamed KayKit assets ever fail/stall —
//      the exact blind spot behind the 90%-stuck loading regression, which was
//      only ever caught by eye.
//   2. Uncaught client crashes, which /api/client-error already received but
//      only ever console.error'd to the box — invisible without SSHing in.
//
// This module folds those into two places:
//   • AGGREGATE analytics counters (device + coarse buckets only — no names, no
//     IPs, no URLs, nothing per-user), consistent with lib/analytics.js.
//   • A small, bounded, in-memory ring of the most recent reports, so the
//     admin dashboard can show WHAT is breaking (message/source/stack) without
//     a server login. The ring is admin-gated, capped, never persisted, and
//     carries only the technical shape of a crash — the same fields
//     /api/client-error already accepted.
//
//   const telemetry = require('./lib/telemetry')({ analytics });

module.exports = function createTelemetry({ analytics, ringSize = 200 } = {}) {
  const ring = []; // most-recent LAST
  function push(entry) {
    ring.push(entry);
    if (ring.length > ringSize) ring.splice(0, ring.length - ringSize);
  }
  const dev = (d) => (d === 'mobile' ? 'mobile' : 'desktop');
  const bump = (m) => { try { if (analytics) analytics.bump(m); } catch (e) {} };

  // Record an uncaught client error: one aggregate tick (total + by device) and
  // a ring entry carrying the crash's technical shape for debugging.
  function recordError({ kind, message, source, line, stack, device } = {}) {
    const d = dev(device);
    bump('clienterr'); bump('clienterr.' + d);
    push({
      t: Date.now(), type: 'error', device: d,
      kind: String(kind || 'error').slice(0, 32),
      message: String(message || '').slice(0, 300),
      source: String(source || '').slice(0, 200),
      line: Number(line) || 0,
      stack: String(stack || '').slice(0, 600)
    });
  }

  // Coarse time-to-playable bucket (ms → slug the dashboard bar-charts).
  function ttpBucket(ms) {
    if (ms < 2000) return 'lt2s';
    if (ms < 4000) return '2_4s';
    if (ms < 6000) return '4_6s';
    if (ms < 10000) return '6_10s';
    if (ms < 20000) return '10_20s';
    return 'gt20s';
  }

  // Asset slugs are bounded to the known streamed bodies so a hostile client
  // can't inflate metric cardinality on this public write endpoint; anything
  // else still counts toward the asset_fail TOTAL but folds into "other".
  const ASSET_WHITELIST = new Set([
    'char0', 'char1', 'char2', 'char3', 'char4', 'char5',
    'skel_minion', 'skel_warrior', 'skel_rogue', 'town', 'props', 'socket'
  ]);

  // Landing-page dwell bucket (coarser than load time — this is attention, not
  // performance): did the pitch hold them for a glance, a read, or a sit?
  function landingBucket(ms) {
    if (ms < 5000) return 'lt5s';
    if (ms < 15000) return '5_15s';
    if (ms < 60000) return '15_60s';
    return 'gt60s';
  }

  // Record a health/engagement beacon. `event` is 'playable' (ms to first render
  // after join), 'assetfail' (a streamed model that failed to its fallback), or
  // 'landing' (time on the landing page + whether they headed to /play).
  function recordBeacon({ event, ms, asset, device, play } = {}) {
    const d = dev(device);
    if (event === 'landing') {
      const m = Math.max(0, Math.min(3600000, Number(ms) || 0));
      bump('landing.view');
      bump('landing.dwell.' + landingBucket(m));
      bump(play ? 'landing.play' : 'landing.left');
      push({ t: Date.now(), type: 'landing', device: d, ms: m, play: !!play });
      return true;
    }
    if (event === 'playable') {
      const m = Math.max(0, Math.min(600000, Number(ms) || 0));
      const b = ttpBucket(m);
      bump('playable');
      bump('ttp.' + b);
      bump('ttp.' + d + '.' + b);
      push({ t: Date.now(), type: 'playable', device: d, ms: m });
      return true;
    }
    if (event === 'assetfail') {
      let a = String(asset || 'other').slice(0, 24);
      if (!ASSET_WHITELIST.has(a)) a = 'other';
      bump('asset_fail');
      bump('asset_fail.' + a);
      bump('asset_fail.' + d);
      push({ t: Date.now(), type: 'assetfail', device: d, asset: a });
      return true;
    }
    return false;
  }

  // Most-recent `n` ring entries, newest first (for the admin dashboard).
  function recent(n) {
    const k = Math.max(1, Math.min(ringSize, parseInt(n, 10) || 100));
    return ring.slice(-k).reverse();
  }

  return { recordError, recordBeacon, recent, ttpBucket, landingBucket };
};
