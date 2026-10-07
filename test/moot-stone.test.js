// The Moot Stone (Session N) — a coven's private, instanced copy of the world.
// Verifies the instance toggle and, crucially, that presence/chat are isolated:
// players inside a coven's moot and players in the public town cannot see or
// hear each other, while coven members inside the moot can.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-moot-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    countSince(n, t) { let c = 0; for (let i = n; i < this.sent.length; i++) if (this.sent[i].type === t) c++; return c; },
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

    const join = (name, accountKey) => {
      const s = makeMockSocket(name);
      connHandler(s);
      s.emit('message', JSON.stringify({ type: 'join', name, charId: 0 }));
      const id = s.lastOfType('init').id;
      const p = hooks.players.get(id);
      if (accountKey) { p.accountKey = accountKey; s._isGuest = false; }
      return { s, id, p };
    };
    const chat = (who, text) => who.s.emit('message', JSON.stringify({ type: 'chat', text }));

    // Two coven members + one unaffiliated public player, all in 'outside'.
    const A = join('Morgana', 'morgana');
    const B = join('Circe', 'circe');
    const C = join('Stranger', null); // guest, no coven

    // Form a coven containing A and B directly in the store.
    hooks.covens['cv_test'] = { id: 'cv_test', name: 'The Night Hags', sigil: '🌙', members: ['morgana', 'circe'], leaderKey: 'morgana' };
    hooks.covenIndex.set('morgana', 'cv_test');
    hooks.covenIndex.set('circe', 'cv_test');
    check('coven lookup works for a member', !!hooks.covenOf('morgana') && hooks.covenOf('morgana').id === 'cv_test');

    // ── A non-coven player can't use the stone ───────────────────────────
    C.s.emit('message', JSON.stringify({ type: 'moot_teleport' }));
    check('a coven-less player is refused by the stone', !!C.s.lastOfType('moot_error'));
    check('the refused player stays in the public world', (C.p.instance || null) === null);

    // ── A steps through: enters the coven instance ───────────────────────
    A.s.emit('message', JSON.stringify({ type: 'moot_teleport' }));
    check('stepping through sends moot_entered', !!A.s.lastOfType('moot_entered'));
    check('moot_entered carries the coven name', A.s.lastOfType('moot_entered').covenName === 'The Night Hags');
    check('A is now in the coven instance', A.p.instance === 'coven_cv_test');

    // Public players are told A left their world.
    check('C sees A leave the public world', !!C.s.lastOfType('player_left') && C.s.lastOfType('player_left').id === A.id);

    // ── Isolation: A (private) and C (public) can't hear each other ───────
    let cMark = C.s.sent.length, aMark = A.s.sent.length;
    chat(A, 'secret coven words');
    check('C (public) does NOT receive the private coven chat', C.s.countSince(cMark, 'chat') === 0);

    cMark = C.s.sent.length; aMark = A.s.sent.length;
    chat(C, 'hello town');
    check('A (private) does NOT receive the public chat', A.s.countSince(aMark, 'chat') === 0);

    // ── B steps through too: now A and B share the private instance ──────
    B.s.emit('message', JSON.stringify({ type: 'moot_teleport' }));
    check('B is now in the coven instance', B.p.instance === 'coven_cv_test');
    let bMark = B.s.sent.length;
    chat(A, 'sisters, gather');
    check('B (same coven instance) DOES receive A’s chat', B.s.countSince(bMark, 'chat') >= 1);

    // ── A steps back out: returns to the public world ───────────────────
    A.s.emit('message', JSON.stringify({ type: 'moot_teleport' }));
    check('stepping back sends moot_exited', !!A.s.lastOfType('moot_exited'));
    check('A is back in the public world', (A.p.instance || null) === null);
    cMark = C.s.sent.length;
    chat(A, 'back in town');
    check('C (public) now hears A again', C.s.countSince(cMark, 'chat') >= 1);
    bMark = B.s.sent.length;
    check('B (still private) does NOT hear A’s public chat', B.s.countSince(bMark, 'chat') === 0);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('FAIL - unexpected error:', e && e.stack || e);
    process.exit(1);
  }
}, 200);
