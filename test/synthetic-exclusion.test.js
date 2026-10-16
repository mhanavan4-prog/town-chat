// Load-test / synthetic-traffic exclusion: a join carrying the LOADTEST_TOKEN is
// kept out of every product-analytics counter, while real joins count normally.
// In-process mock-socket harness.
process.env.PORT = '0';
process.env.LOADTEST_TOKEN = 'testtok123';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-synthetic-');

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

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const A = h.analytics;
  const today = () => A.data[A.day()] || {};
  const n = (m) => today()[m] || 0;

  function join(tag, extra) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify(Object.assign({ type: 'join', name: tag, charId: 0 }, extra || {})));
    return { s, p: h.players.get(s.lastOfType('init').id) };
  }

  // ── A real join counts ──────────────────────────────────────────────────────
  const j0 = n('join'), g0 = n('join.guest'), w0 = n('class.witch');
  const real = join('RealPerson');
  check('a real join is not flagged synthetic', real.p._synthetic === false, real.p._synthetic);
  check('a real join bumps join', n('join') === j0 + 1, n('join'));
  check('a real join bumps join.guest', n('join.guest') === g0 + 1);
  check('a real join bumps class.witch', n('class.witch') === w0 + 1);

  // ── A synthetic join (matching token) is excluded ───────────────────────────
  const j1 = n('join'), g1 = n('join.guest'), w1 = n('class.witch');
  const bot = join('bot_7_abcd', { synthetic: 'testtok123' });
  check('a token-matched join IS flagged synthetic', bot.p._synthetic === true, bot.p._synthetic);
  check('a synthetic join does NOT bump join', n('join') === j1, n('join'));
  check('a synthetic join does NOT bump join.guest', n('join.guest') === g1);
  check('a synthetic join does NOT bump class.witch', n('class.witch') === w1);

  // ── A synthetic close is excluded too ───────────────────────────────────────
  const d0 = n('disconnect'), s0 = n('sess.lt1m');
  bot.s.emit('close', 1000);
  check('a synthetic close does NOT bump disconnect', n('disconnect') === d0, n('disconnect'));
  check('a synthetic close does NOT bump a session bucket', n('sess.lt1m') === s0);

  // ── A WRONG token counts as a real player (no silent opt-out) ───────────────
  const j2 = n('join');
  const wrong = join('Sneaky', { synthetic: 'not-the-token' });
  check('a wrong token is NOT treated as synthetic', wrong.p._synthetic === false, wrong.p._synthetic);
  check('a wrong-token join still counts', n('join') === j2 + 1, n('join'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
