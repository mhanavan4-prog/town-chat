// Chat-engagement instrumentation (Session N, PR 4): chat.sent (+ by channel),
// the once-per-session spoke flag (sess.spoke / sess.silent), and chat.void —
// a world line sent when nobody else is online. In-process mock-socket harness.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-chateng-');

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

  function join(tag) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    return { s, p: h.players.get(s.lastOfType('init').id) };
  }
  const say = (s, text, channel) => s.emit('message', JSON.stringify({ type: 'chat', text, channel: channel || 'world' }));

  // ── A talks into an empty town (world channel, only player online) ──────────
  const a = join('Talker');
  const sent0 = n('chat.sent'), world0 = n('chat.sent.world'), void0 = n('chat.void');
  say(a.s, 'anyone here?');
  check('a delivered message bumps chat.sent', n('chat.sent') === sent0 + 1, n('chat.sent'));
  check('it is attributed to the world channel', n('chat.sent.world') === world0 + 1, n('chat.sent.world'));
  check('the session is flagged as having spoken', a.p.spoke === true, a.p.spoke);
  check('a world line with no one else online counts as into-the-void', n('chat.void') === void0 + 1, n('chat.void'));

  // ── B joins; now A is not alone — a world line is no longer "into the void" ──
  const b = join('Listener');
  const void1 = n('chat.void'), sent1 = n('chat.sent');
  say(a.s, 'oh hey!');
  check('a second message bumps chat.sent again', n('chat.sent') === sent1 + 1, n('chat.sent'));
  check('a world line with someone else online is NOT into-the-void', n('chat.void') === void1, n('chat.void'));

  // ── Session close: A spoke, B never did ─────────────────────────────────────
  const spoke0 = n('sess.spoke'), silent0 = n('sess.silent');
  a.s.emit('close', 1000);
  check('a session that spoke counts as sess.spoke', n('sess.spoke') === spoke0 + 1, n('sess.spoke'));
  b.s.emit('close', 1000);
  check('a session that never spoke counts as sess.silent', n('sess.silent') === silent0 + 1, n('sess.silent'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
