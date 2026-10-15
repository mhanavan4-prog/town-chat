// Client-health telemetry (Session N) — the lib/telemetry.js module that folds
// load-time / asset-failure / crash signal into aggregate analytics and keeps a
// bounded ring of recent reports for the admin dashboard. Pure unit test: a fake
// analytics records the metric slugs bumped, and we assert the aggregate buckets,
// the ring contents, device derivation, asset whitelisting, and ms clamping.
const createTelemetry = require('../lib/telemetry.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name); }
}

function fakeAnalytics() {
  const counts = {};
  return { bump: (m) => { counts[m] = (counts[m] || 0) + 1; }, counts };
}

(() => {
  // ── errors ────────────────────────────────────────────────────────────────
  {
    const a = fakeAnalytics();
    const t = createTelemetry({ analytics: a });
    t.recordError({ kind: 'error', message: 'boom', source: 'client.js', line: 42, stack: 'at fn', device: 'mobile' });
    check('error bumps clienterr total', a.counts['clienterr'] === 1);
    check('error bumps clienterr by device', a.counts['clienterr.mobile'] === 1);
    const r = t.recent(10);
    check('error lands in the ring', r.length === 1 && r[0].type === 'error');
    check('ring entry keeps message/source/line', r[0].message === 'boom' && r[0].source === 'client.js' && r[0].line === 42);
    check('unknown device folds to desktop', (() => { const b = fakeAnalytics(); createTelemetry({ analytics: b }).recordError({ message: 'x' }); return b.counts['clienterr.desktop'] === 1; })());
  }

  // ── playable beacons ────────────────────────────────────────────────────────
  {
    const a = fakeAnalytics();
    const t = createTelemetry({ analytics: a });
    t.recordBeacon({ event: 'playable', ms: 3500, device: 'desktop' });
    check('playable bumps the playable counter', a.counts['playable'] === 1);
    check('playable buckets by time (2_4s)', a.counts['ttp.2_4s'] === 1);
    check('playable buckets by device+time', a.counts['ttp.desktop.2_4s'] === 1);
    check('ttpBucket boundaries', t.ttpBucket(0) === 'lt2s' && t.ttpBucket(1999) === 'lt2s' && t.ttpBucket(2000) === '2_4s' && t.ttpBucket(25000) === 'gt20s');
    // ms is clamped into range so a bogus value can't skew the buckets.
    const b = fakeAnalytics();
    createTelemetry({ analytics: b }).recordBeacon({ event: 'playable', ms: 9e9 });
    check('absurd ms clamps to gt20s', b.counts['ttp.gt20s'] === 1);
    const c = fakeAnalytics();
    createTelemetry({ analytics: c }).recordBeacon({ event: 'playable', ms: -5 });
    check('negative ms clamps to lt2s', c.counts['ttp.lt2s'] === 1);
  }

  // ── asset-fail beacons ──────────────────────────────────────────────────────
  {
    const a = fakeAnalytics();
    const t = createTelemetry({ analytics: a });
    t.recordBeacon({ event: 'assetfail', asset: 'char5', device: 'mobile' });
    check('assetfail bumps the total', a.counts['asset_fail'] === 1);
    check('whitelisted asset keeps its slug', a.counts['asset_fail.char5'] === 1);
    check('assetfail bumps by device', a.counts['asset_fail.mobile'] === 1);
    // A non-whitelisted (possibly hostile) asset name folds to "other" so it
    // can't inflate metric cardinality on the public endpoint.
    const b = fakeAnalytics();
    createTelemetry({ analytics: b }).recordBeacon({ event: 'assetfail', asset: 'evil_$(rm -rf)_key_name' });
    check('unknown asset folds to other', b.counts['asset_fail.other'] === 1 && b.counts['asset_fail'] === 1);
  }

  // ── landing beacons ─────────────────────────────────────────────────────────
  {
    const a = fakeAnalytics();
    const t = createTelemetry({ analytics: a });
    t.recordBeacon({ event: 'landing', ms: 8000, play: true, device: 'desktop' });
    check('landing bumps landing.view', a.counts['landing.view'] === 1);
    check('landing buckets dwell (5_15s)', a.counts['landing.dwell.5_15s'] === 1);
    check('a converting landing counts landing.play', a.counts['landing.play'] === 1 && !a.counts['landing.left']);
    check('landingBucket boundaries', t.landingBucket(0) === 'lt5s' && t.landingBucket(5000) === '5_15s' && t.landingBucket(60000) === 'gt60s');
    const b = fakeAnalytics();
    createTelemetry({ analytics: b }).recordBeacon({ event: 'landing', ms: 2000, play: false });
    check('a non-converting landing counts landing.left', b.counts['landing.left'] === 1 && !b.counts['landing.play']);
  }

  // ── validation + ring bound ─────────────────────────────────────────────────
  {
    const a = fakeAnalytics();
    const t = createTelemetry({ analytics: a });
    check('unknown event is a no-op (returns false)', t.recordBeacon({ event: 'nonsense' }) === false);
    check('playable returns true', t.recordBeacon({ event: 'playable', ms: 1 }) === true);
    const t2 = createTelemetry({ analytics: fakeAnalytics(), ringSize: 5 });
    for (let i = 0; i < 20; i++) t2.recordError({ message: 'e' + i });
    const rec = t2.recent(100);
    check('ring is bounded to ringSize', rec.length === 5);
    check('ring keeps the newest, newest-first', rec[0].message === 'e19' && rec[4].message === 'e15');
  }

  // ── works without analytics wired ───────────────────────────────────────────
  {
    const t = createTelemetry({});
    let threw = false;
    try { t.recordError({ message: 'x' }); t.recordBeacon({ event: 'playable', ms: 10 }); } catch (e) { threw = true; }
    check('degrades gracefully with no analytics', !threw && t.recent(5).length === 2);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
