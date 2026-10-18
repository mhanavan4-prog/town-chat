// Séance Board — server plumbing (Phase 2). Gating, offering charge, per-coven
// cooldown, kill-switch, and the in-sync broadcast to members present in the
// Manor. The planchette answer comes from the hand-written fallback bank.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-seance-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, _ip: '127.0.0.1',
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    countOfType(t) { return this.sent.filter((m) => m.type === t).length; },
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

    const A = join('Morgana', 'morgana'); // the asker
    const B = join('Bramble', 'bramble'); // coven-mate present
    hooks.accounts.morgana = { username: 'Morgana', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
    hooks.accounts.bramble = { username: 'Bramble', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
    hooks.covens.cvs = { id: 'cvs', name: 'Night Hags', sigil: '🌙', members: ['morgana', 'bramble'], leaderKey: 'morgana' };
    hooks.covenIndex.set('morgana', 'cvs');
    hooks.covenIndex.set('bramble', 'cvs');
    const cv = hooks.covens.cvs;
    // both stand in the coven's Manor
    A.p.room = 'manor'; A.p.instance = 'coven_cvs';
    B.p.room = 'manor'; B.p.instance = 'coven_cvs';
    hooks.ensureBankAccount('morgana').balance = 100;

    const OFFERING = hooks.seance.CONFIG.OFFERING_GOLD;

    // ── state read: two members present ──────────────────────────────────
    check('manorMembersOf counts both members', hooks.manorMembersOf(cv).length === 2);
    A.s.emit('message', JSON.stringify({ type: 'seance_state' }));
    const st = A.s.lastOfType('seance_state');
    check('seance_state reports idle + members present', st && st.phase === 'idle' && st.membersPresent === 2, st);

    // ── begin a ritual: charges the offering, locks the cooldown, broadcasts ─
    const goldBefore = hooks.ensureBankAccount('morgana').balance;
    A.s.emit('message', JSON.stringify({ type: 'seance_start', question: "who's there?" }));
    check('the offering is charged to the asker', hooks.ensureBankAccount('morgana').balance === goldBefore - OFFERING, hooks.ensureBankAccount('morgana').balance);
    check('a bank_state refresh is sent to the asker', !!A.s.lastOfType('bank_state'));
    check('the coven cooldown is set', cv.seanceCdUntil > Date.now());
    check('a session is active', hooks.seanceSessions.has('cvs'));
    check('seance_begin reaches the asker', !!A.s.lastOfType('seance_begin'));
    check('seance_begin reaches the present coven-mate (in sync)', !!B.s.lastOfType('seance_begin'));
    const begin = A.s.lastOfType('seance_begin');
    // total is 0 at begin by design — the answer resolves asynchronously during
    // the buildup, so the step count isn't known until spelling starts.
    check('seance_begin carries a buildup window', begin && begin.buildupMs > 0, begin);

    // clean up the active session's timers so the test can continue + exit
    hooks.clearSeance(cv);

    // ── cooldown blocks an immediate second call ─────────────────────────
    hooks.ensureBankAccount('morgana').balance = 100;
    A.s.emit('message', JSON.stringify({ type: 'seance_start' }));
    const cdErr = A.s.lastOfType('seance_error');
    check('a second call is refused while the veil is spent', cdErr && /spent/i.test(cdErr.message), cdErr);
    check('no new session was started on the refusal', !hooks.seanceSessions.has('cvs'));

    // ── too few members present ──────────────────────────────────────────
    cv.seanceCdUntil = 0;              // clear cooldown
    B.p.room = 'wilds';                // mate steps out
    A.s.emit('message', JSON.stringify({ type: 'seance_start' }));
    const memErr = A.s.lastOfType('seance_error');
    check('a lone witch is told the ritual needs more hands', memErr && /needs 2|coven-mates/i.test(memErr.message), memErr);

    // ── can't afford the offering ────────────────────────────────────────
    B.p.room = 'manor';                       // mate back in
    hooks.ensureBankAccount('morgana').balance = OFFERING - 1;
    A.s.emit('message', JSON.stringify({ type: 'seance_start' }));
    const poorErr = A.s.lastOfType('seance_error');
    check('an underfunded offering is refused', poorErr && /offering/i.test(poorErr.message), poorErr);

    // ── ops kill-switch ──────────────────────────────────────────────────
    hooks.ensureBankAccount('morgana').balance = 100;
    hooks.setSeanceEnabled(false);
    A.s.emit('message', JSON.stringify({ type: 'seance_start' }));
    const offErr = A.s.lastOfType('seance_error');
    check('the kill-switch quiets the board', offErr && /quiet|veil/i.test(offErr.message), offErr);
    hooks.setSeanceEnabled(true);
    check('the kill-switch flips back on', hooks.seanceEnabled() === true);

    // ── not in the manor ─────────────────────────────────────────────────
    A.p.room = 'wilds';
    A.s.emit('message', JSON.stringify({ type: 'seance_start' }));
    const placeErr = A.s.lastOfType('seance_error');
    check('calling outside the Manor is refused', placeErr && /Manor/i.test(placeErr.message), placeErr);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('FAIL - unexpected error:', (e && e.stack) || e);
    process.exit(1);
  }
}, 200);
