// Device-split session metrics (Session N, PR 6): sess.<device>.<bucket> and
// sess.<device>.spoke/silent, so mobile vs desktop churn + engagement compare
// directly. In-process mock-socket harness; device is forced on the socket
// (the harness calls the connection handler without a real upgrade request).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-devsplit-');

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

  // Connect, force the device class, then join (device is read onto the player at join).
  function joinDev(tag, device) {
    const s = makeMockSocket(tag); connHandler(s); s._device = device;
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    return { s, p: h.players.get(s.lastOfType('init').id) };
  }

  // ── A mobile session that never speaks ──────────────────────────────────────
  const m = joinDev('Phone', 'mobile');
  check('the player is tagged with its device', m.p.device === 'mobile', m.p.device);
  const mb0 = n('sess.mobile.lt1m'), msil0 = n('sess.mobile.silent');
  m.s.emit('close', 1000);
  check('a mobile session records a device-split length bucket', n('sess.mobile.lt1m') === mb0 + 1, n('sess.mobile.lt1m'));
  check('a silent mobile session records sess.mobile.silent', n('sess.mobile.silent') === msil0 + 1, n('sess.mobile.silent'));

  // ── A desktop session that speaks ───────────────────────────────────────────
  const d = joinDev('Desk', 'desktop');
  check('desktop device is tagged', d.p.device === 'desktop', d.p.device);
  d.s.emit('message', JSON.stringify({ type: 'chat', text: 'hi', channel: 'world' }));
  const db0 = n('sess.desktop.lt1m'), dsp0 = n('sess.desktop.spoke');
  d.s.emit('close', 1000);
  check('a desktop session records a device-split length bucket', n('sess.desktop.lt1m') === db0 + 1, n('sess.desktop.lt1m'));
  check('a desktop session that spoke records sess.desktop.spoke', n('sess.desktop.spoke') === dsp0 + 1, n('sess.desktop.spoke'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
