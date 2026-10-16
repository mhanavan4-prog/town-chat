// In-game bug reporter (Session N): the lib/bugreports.js store (clamp, bound,
// recent/resolve/counts) and the server's bug_report WS handler — context
// capture, rate-limiting, and the bug_ack reply. Admin read path is covered by
// the store's recent()/counts() here; the HTTP routes are thin gates over them.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-bugs-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

// ── Pure store logic ──────────────────────────────────────────────────────────
(function storeTests() {
  const noop = () => {};
  const store = require('../lib/bugreports.js')({
    dataDir: process.env.DATA_DIR, persistLoad: () => null, persistSave: noop, persistRegister: noop, max: 3
  });

  const r = store.add({ text: 'wolf clips through the inn wall', name: 'Lupa', account: 'lupa', room: 'town', charId: 1, level: 7, device: 'desktop', build: 'abc123', ip: '1.2.3.4', errors: ['TypeError: x'] });
  check('add returns a report with an id + open status', r.id && /^bug_/.test(r.id) && r.status === 'open', r);
  check('add captures the context fields', r.charId === 1 && r.level === 7 && r.room === 'town' && r.build === 'abc123', r);

  const long = store.add({ text: 'x'.repeat(5000), name: 'y'.repeat(200), errors: ['e'.repeat(1000), 'a', 'b', 'c', 'd', 'e', 'f'] });
  check('text is clamped to 1000', long.text.length === 1000, long.text.length);
  check('name is clamped to 40', long.name.length === 40, long.name.length);
  check('errors are clamped to 5 × 300', long.errors.length === 5 && long.errors[0].length === 300, [long.errors.length, long.errors[0].length]);

  const bogus = store.add({ device: 'satellite' });
  check('an unknown device clamps to desktop', bogus.device === 'desktop', bogus.device);
  check('a missing charId/level becomes null', bogus.charId === null && bogus.level === null, bogus);

  // max=3 → the ring trims the oldest.
  check('the store is bounded (oldest dropped)', store.counts().total === 3, store.counts());
  check('recent() is newest-first', store.recent(3)[0].id === bogus.id, store.recent(3).map((x) => x.id));

  const ok = store.resolve(store.recent(1)[0].id, 'resolved');
  check('resolve marks a report resolved', ok && store.counts().open === 2, store.counts());
  check('recent(open) hides the resolved one', store.recent(10, 'open').every((x) => x.status === 'open'), store.recent(10, 'open').map((x) => x.status));
  check('recent(all) still shows everything', store.recent(10, 'all').length === 3, store.recent(10, 'all').length);
  check('resolve on a missing id is a no-op', store.resolve('bug_nope', 'resolved') === false);
})();

// ── Server handler ────────────────────────────────────────────────────────────
function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag, charId) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: charId || 0 }));
    return { s, p: h.players.get(s.lastOfType('init').id) };
  }

  const before = h.bugReports.counts().total;

  const g = join('Tester', 3);
  g.s.emit('message', JSON.stringify({ type: 'bug_report', text: '  the greatsword floats above my hand  ', build: 'df4fd51fac', errors: ['RangeError: bad'] }));
  check('a valid report is acked ok', (() => { const a = g.s.lastOfType('bug_ack'); return a && a.ok === true; })(), g.s.lastOfType('bug_ack'));
  check('the report landed in the store', h.bugReports.counts().total === before + 1, h.bugReports.counts());
  check('the server trimmed the free text', (() => { const r = h.bugReports.recent(1, 'all')[0]; return r.text === 'the greatsword floats above my hand'; })(), h.bugReports.recent(1, 'all')[0]);
  check('the server attached authoritative identity', (() => { const r = h.bugReports.recent(1, 'all')[0]; return r.name === 'Tester' && r.charId === 3 && r.room; })(), h.bugReports.recent(1, 'all')[0]);
  check('the client-supplied build + errors rode along', (() => { const r = h.bugReports.recent(1, 'all')[0]; return r.build === 'df4fd51fac' && r.errors[0] === 'RangeError: bad'; })(), h.bugReports.recent(1, 'all')[0]);
  check('a bug report bumps analytics', h.analytics.total('bug.report') >= 1, h.analytics.total('bug.report'));

  // Empty text is rejected without storing.
  const midCount = h.bugReports.counts().total;
  g.s.emit('message', JSON.stringify({ type: 'bug_report', text: '   ' }));
  check('an empty report is rejected (not ok)', (() => { const a = g.s.lastOfType('bug_ack'); return a && a.ok === false; })(), g.s.lastOfType('bug_ack'));
  check('an empty report is not stored', h.bugReports.counts().total === midCount, h.bugReports.counts());

  // Rate limit: the handler allows a few, then throttles.
  const spammer = join('Spammer', 0);
  let throttled = false;
  for (let i = 0; i < 8; i++) {
    spammer.s.emit('message', JSON.stringify({ type: 'bug_report', text: 'report number ' + i }));
    const a = spammer.s.lastOfType('bug_ack');
    if (a && a.ok === false && /already/i.test(a.message || '')) { throttled = true; break; }
  }
  check('rapid reports get rate-limited', throttled);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
