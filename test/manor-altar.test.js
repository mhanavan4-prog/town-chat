// The Coven Manor — the beds became personal witch-altars. Verifies altar
// adornment: free pieces place without cost, premium pieces need a one-time
// Moonstone unlock, placement is gated to a bedroom owner, clearing works, and
// manorStateBody broadcasts every claimed altar's arrangement to all viewers.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-manoraltar-');

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

    const join = (name, accountKey) => {
      const s = makeMockSocket(name);
      connHandler(s);
      s.emit('message', JSON.stringify({ type: 'join', name, charId: 0 }));
      const p = hooks.players.get(s.lastOfType('init').id);
      p.accountKey = accountKey; s._isGuest = false;
      return { s, p };
    };
    const A = join('Morgana', 'morgana');
    const B = join('Circe', 'circe');
    hooks.accounts.morgana = { username: 'Morgana', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
    hooks.accounts.circe = { username: 'Circe', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
    // Morgana owns bed 2; Circe owns none yet.
    hooks.covens.cvs = { id: 'cvs', name: 'Night Hags', sigil: '🌙', members: ['morgana', 'circe'], leaderKey: 'morgana', manorBedrooms: { 2: 'morgana' } };
    hooks.covenIndex.set('morgana', 'cvs'); hooks.covenIndex.set('circe', 'cvs');
    for (const m of [A, B]) { m.p.room = 'manor'; m.p.instance = 'coven_cvs'; }
    const cv = hooks.covens.cvs;

    // ── Free decoration places with no cost ──────────────────────────────
    A.s.emit('message', JSON.stringify({ type: 'manor_altar_place', display: 0, decoId: 'candles' }));
    check('free piece (candles) lands in the owner’s altar slot 0', cv.manorAltarsByAccount && cv.manorAltarsByAccount.morgana && cv.manorAltarsByAccount.morgana[0] === 'candles',
      cv.manorAltarsByAccount);
    let st = A.s.lastOfType('manor_state');
    check('owner is pushed a manor_state after placing', !!st);
    check('manor_state carries the altar arrangement for the claimed bed', st && st.altars && Array.isArray(st.altars[2]) && st.altars[2][0] === 'candles', st && st.altars);

    // ── Premium piece is refused until unlocked ─────────────────────────
    A.s.emit('message', JSON.stringify({ type: 'manor_altar_place', display: 1, decoId: 'mirror' }));
    check('premium piece (mirror) is refused before unlock', !(cv.manorAltarsByAccount.morgana[1] === 'mirror'));
    check('an ms_error explains the lock', !!A.s.lastOfType('ms_error'));

    // ── Unlock needs enough Moonstones ──────────────────────────────────
    A.s.emit('message', JSON.stringify({ type: 'manor_altar_unlock', decoId: 'mirror' }));
    check('unlock refused with no Moonstones', !(hooks.accounts.morgana.altarUnlocks && hooks.accounts.morgana.altarUnlocks.mirror));
    hooks.msAdjust('morgana', 100); // grant a stash
    A.s.emit('message', JSON.stringify({ type: 'manor_altar_unlock', decoId: 'mirror' }));
    check('mirror unlocks once she can afford it', hooks.accounts.morgana.altarUnlocks && hooks.accounts.morgana.altarUnlocks.mirror === true);
    check('Moonstones were spent (100 - 40 = 60)', hooks.msBalance('morgana') === 60, hooks.msBalance('morgana'));
    check('an altar_unlocks message reflects the new unlock', (A.s.lastOfType('altar_unlocks') || {}).unlocks && A.s.lastOfType('altar_unlocks').unlocks.mirror === true);

    // ── Now the premium piece places ────────────────────────────────────
    A.s.emit('message', JSON.stringify({ type: 'manor_altar_place', display: 1, decoId: 'mirror' }));
    check('mirror places after unlock', cv.manorAltarsByAccount.morgana[1] === 'mirror');

    // ── Clearing a slot (decoId null) ───────────────────────────────────
    A.s.emit('message', JSON.stringify({ type: 'manor_altar_place', display: 0, decoId: null }));
    check('a slot clears to null', cv.manorAltarsByAccount.morgana[0] === null);

    // ── A non-owner (no bedroom) cannot adorn ───────────────────────────
    B.s.emit('message', JSON.stringify({ type: 'manor_altar_place', display: 0, decoId: 'candles' }));
    check('a member with no claimed bedroom is refused', !(cv.manorAltarsByAccount && cv.manorAltarsByAccount.circe && cv.manorAltarsByAccount.circe[0] === 'candles'));
    check('the non-owner gets a manor_error', !!B.s.lastOfType('manor_error'));

    // ── Everyone in the manor sees the arrangement via manorStateBody ────
    const body = hooks.manorStateBody(cv, 'circe');
    check('a viewer sees the owner’s altar arrangement', body.altars && Array.isArray(body.altars[2]) && body.altars[2][1] === 'mirror', body.altars);
    check('the viewer’s own unlocks are reported', typeof body.yourUnlocks === 'object');

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('FAIL - unexpected error:', e && e.stack || e);
    process.exit(1);
  }
}, 200);
