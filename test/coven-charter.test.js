// Coven Charter (Session N) — founding a coven requires a one-time real-money
// Charter. Verifies the gate: no charter -> refused with needCharter; a granted
// charter -> founds the coven and is consumed; grants are replay-proof.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-charter-');

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
  try {
    const wss = global.__wssInstances[0];
    const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
    const hooks = global.__testHooks;

    const s = makeMockSocket('Founder');
    connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: 'Founder', charId: 0 }));
    const p = hooks.players.get(s.lastOfType('init').id);
    p.accountKey = 'founder'; s._isGuest = false;

    // ── No charter: founding is refused, with a needCharter hint ──────────
    s.emit('message', JSON.stringify({ type: 'coven_create', name: 'The Hexwives', sigil: '🌙' }));
    let err = s.lastOfType('coven_error');
    check('without a Charter, founding is refused', !!err && err.needCharter === true, err);
    check('the refusal carries a price + payments flag', !!err && typeof err.priceCents === 'number' && 'paymentsEnabled' in err);
    check('no coven was created', !hooks.covenOf('founder'));

    // ── Grant a charter (replay-proof) ───────────────────────────────────
    let g = hooks.grantCharter('sess_abc', 'founder');
    check('granting a charter credits one', g.granted === 1 && g.balance === 1);
    g = hooks.grantCharter('sess_abc', 'founder');
    check('replaying the same grant id is a no-op', g.granted === 0 && g.balance === 1);
    check('charterBalance reflects the grant', hooks.charterBalance('founder') === 1);

    // ── With a charter: founding succeeds and consumes it ────────────────
    s.emit('message', JSON.stringify({ type: 'coven_create', name: 'The Hexwives', sigil: '🌙' }));
    const st = s.lastOfType('coven_state');
    check('with a Charter, the coven is founded', !!st && st.coven && st.coven.name === 'The Hexwives', st && st.coven);
    check('the founder now belongs to the coven', !!hooks.covenOf('founder') && hooks.covenOf('founder').name === 'The Hexwives');
    check('the coven is marked chartered', !!hooks.covenOf('founder').chartered);
    check('the charter was consumed', hooks.charterBalance('founder') === 0);

    // ── Already in a coven: a normal refusal, not a charter prompt ────────
    const s2 = makeMockSocket('Founder2');
    connHandler(s2);
    s2.emit('message', JSON.stringify({ type: 'join', name: 'Founder2', charId: 0 }));
    const p2 = hooks.players.get(s2.lastOfType('init').id);
    p2.accountKey = 'founder'; s2._isGuest = false; // same account, second device
    s2.emit('message', JSON.stringify({ type: 'coven_create', name: 'Another', sigil: '🌙' }));
    err = s2.lastOfType('coven_error');
    check('an existing member is refused without a charter prompt', !!err && !err.needCharter);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('FAIL - unexpected error:', e && e.stack || e);
    process.exit(1);
  }
}, 200);
