// World-liveness instrumentation (Session N, PR 2): peak-concurrent-by-hour,
// the true "alone the whole session" signal, and clean-vs-dropped disconnects.
// Uses the in-process mock-socket harness (same as world-chat.test.js): join
// players, inspect the live player objects and the aggregate analytics counters.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-liveness-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

// Current hour in ET, matching the server's playHourSlug().
function hhET() {
  try { return String(parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }).format(new Date()), 10) % 24).padStart(2, '0'); }
  catch (e) { return String(new Date().getUTCHours()).padStart(2, '0'); }
}

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const A = h.analytics;
  const today = () => A.data[A.day()] || {};
  const n = (m) => today()[m] || 0;

  function join(tag) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    return { s, p };
  }

  const HH = hhET();

  // ── A joins to an empty town ────────────────────────────────────────────────
  const a = join('Solo');
  check('a lone arrival is flagged not-with-others', a.p.everWithOthers === false, a.p.everWithOthers);
  check('peak-concurrent-by-hour records the lone player', n('cc.hour.' + HH) >= 1, n('cc.hour.' + HH));

  // ── B joins while A is still online — both now "with others" ────────────────
  const b = join('Pair');
  check('the newcomer is flagged with-others', b.p.everWithOthers === true, b.p.everWithOthers);
  check('the player already online is lifted to with-others', a.p.everWithOthers === true, a.p.everWithOthers);
  check('hourly peak concurrent rises to 2', n('cc.hour.' + HH) >= 2, n('cc.hour.' + HH));

  // ── Disconnects: B drops (1006), A closes cleanly (1000) ────────────────────
  const dropBefore = n('disconnect.drop'), cleanBefore = n('disconnect.clean'), sawBefore = n('sess.saw_others');
  b.s.emit('close', 1006);
  check('an abnormal close counts as a dropped connection', n('disconnect.drop') === dropBefore + 1, n('disconnect.drop'));
  check('a session that overlapped someone counts as saw_others', n('sess.saw_others') === sawBefore + 1, n('sess.saw_others'));
  a.s.emit('close', 1000);
  check('a normal close counts as a clean disconnect', n('disconnect.clean') === cleanBefore + 1, n('disconnect.clean'));
  check('both overlapping sessions counted saw_others', n('sess.saw_others') === sawBefore + 2, n('sess.saw_others'));

  // ── C joins to a now-empty town and leaves without ever meeting anyone ──────
  const aloneBefore = n('sess.alone_whole');
  const c = join('Hermit');
  check('a fresh lone arrival is again not-with-others', c.p.everWithOthers === false, c.p.everWithOthers);
  c.s.emit('close', 1000);
  check('a start-to-finish solo session counts as alone_whole', n('sess.alone_whole') === aloneBefore + 1, n('sess.alone_whole'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
