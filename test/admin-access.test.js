// Admin / dev accounts (ADMIN_ACCOUNTS) — a named account walks through locked
// buildings and founds a coven with no paid Charter, so the whole world is
// testable. Verifies: the gate honours admin for locked rooms; a non-admin is
// still blocked; founding is free for an admin and consumes no charter.
process.env.PORT = '0';
process.env.ADMIN_ACCOUNTS = 'Boss, tester';   // case-insensitive, trimmed
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-admin-');

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
    const hooks = global.__testHooks;
    const lockedRoom = [...hooks.LOCKED_ROOMS][0]; // e.g. 'lounge'

    // ── isAdmin keys off the account name, case-insensitively ──
    check('a listed account is admin (case-insensitive)', hooks.isAdmin({ accountKey: 'boss' }) === true);
    check('a second listed account is admin', hooks.isAdmin({ accountKey: 'tester' }) === true);
    check('an unlisted account is not admin', hooks.isAdmin({ accountKey: 'random' }) === false);
    check('a guest (no accountKey) is never admin', hooks.isAdmin({ accountKey: null }) === false);

    // ── hasTownPass: admins pass without ever buying ──
    check('admin has a town pass with no purchase', hooks.hasTownPass({ accountKey: 'boss' }) === true);
    check('a plain player without a pass does not', hooks.hasTownPass({ accountKey: 'random', passUntil: 0 }) === false);
    check('the locked room set is non-empty', !!lockedRoom);

    // ── Founding a coven: free for an admin, no Charter needed ──
    const wss = global.__wssInstances[0];
    const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

    const s = makeMockSocket('Boss');
    connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: 'Boss', charId: 0 }));
    const p = hooks.players.get(s.lastOfType('init').id);
    p.accountKey = 'boss'; s._isGuest = false;

    // (The init payload's townPass.isAdmin is built from isAdmin(player) at join
    // time; the mock join can't carry account credentials — like the other coven
    // tests, accountKey is set afterward — so the flag is verified via isAdmin()
    // above rather than off this guest-time init.)
    check('admin holds no charter to begin with', hooks.charterBalance('boss') === 0);
    s.emit('message', JSON.stringify({ type: 'coven_create', name: 'Testers Circle', sigil: '🌙' }));
    const st = s.lastOfType('coven_state');
    check('an admin founds a coven with no Charter', !!st && st.coven && st.coven.name === 'Testers Circle', st && st.coven);
    check('no charter was consumed (still zero)', hooks.charterBalance('boss') === 0);
    check('no needCharter refusal was sent', !s.lastOfType('coven_error') || !s.lastOfType('coven_error').needCharter);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('FAIL - unexpected error:', e && e.stack || e);
    process.exit(1);
  }
}, 200);
