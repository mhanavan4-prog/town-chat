// Altar rituals — performing a rite at your own altar grants one timed blessing
// (on a cooldown) that really changes a derived stat, and you can bestow your
// active blessing on a nearby player, coven or not.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-ritual-');

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
    const A = join('Morgana', 'morgana');   // altar owner
    const B = join('Wanderer', 'wander');   // NOT in a coven
    hooks.accounts.morgana = { username: 'Morgana', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
    hooks.accounts.wander = { username: 'Wanderer', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
    hooks.covens.cvs = { id: 'cvs', name: 'Night Hags', sigil: '🌙', members: ['morgana'], leaderKey: 'morgana', manorBedrooms: { 0: 'morgana' } };
    hooks.covenIndex.set('morgana', 'cvs');
    A.p.room = 'manor'; A.p.instance = 'coven_cvs';

    // ── Perform a rite at your own altar ─────────────────────────────────
    const hpBefore = hooks.playerMaxHealth(A.p);
    A.s.emit('message', JSON.stringify({ type: 'altar_ritual_perform', ritualId: 'vigor' }));
    const rs = A.s.lastOfType('ritual_state');
    check('a ritual_state with the active blessing is returned', rs && rs.active && rs.active.id === 'vigor', rs);
    check('Brew of Vigor raises max health by 40', hooks.playerMaxHealth(A.p) === hpBefore + 40, { before: hpBefore, after: hooks.playerMaxHealth(A.p) });
    check('the altar goes on cooldown', rs && rs.cdUntil > Date.now());

    // ── Cooldown blocks an immediate second rite ─────────────────────────
    A.s.emit('message', JSON.stringify({ type: 'altar_ritual_perform', ritualId: 'ward' }));
    check('a second rite is refused while on cooldown', hooks.accounts.morgana.ritual.id === 'vigor', hooks.accounts.morgana.ritual);
    check('the cooldown refusal is explained', !!A.s.lastOfType('manor_error'));

    // ── Bestow the blessing on a nearby NON-coven player ─────────────────
    // Move both out to the shared wilds, standing close together.
    A.p.room = 'wilds'; A.p.instance = null; A.p.x = 1000; A.p.y = 1000;
    B.p.room = 'wilds'; B.p.instance = null; B.p.x = 1040; B.p.y = 1010; // ~41u away, within range
    const bHpBefore = hooks.playerMaxHealth(B.p);
    A.s.emit('message', JSON.stringify({ type: 'bless_player', targetId: B.p.id }));
    check('the non-coven target receives the blessing', hooks.accounts.wander.ritual && hooks.accounts.wander.ritual.id === 'vigor', hooks.accounts.wander.ritual);
    check('the target’s max health rises too', hooks.playerMaxHealth(B.p) === bHpBefore + 40);
    check('the target is told who blessed them', (B.s.lastOfType('toast') || {}).message && /blesses you/.test(B.s.lastOfType('toast').message));

    // ── Out of range is refused ──────────────────────────────────────────
    hooks.accounts.wander.ritual = null; // reset the target
    B.p.x = 5000; B.p.y = 5000;          // far away
    A.p.blessCdUntil = 0;                 // clear the bestow cooldown for the test
    A.s.emit('message', JSON.stringify({ type: 'bless_player', targetId: B.p.id }));
    check('a far target is not blessed', !hooks.accounts.wander.ritual);

    // ── A caster with no blessing can't bestow ───────────────────────────
    hooks.accounts.morgana.ritual = null;
    B.p.x = 1040; B.p.y = 1010;
    A.p.blessCdUntil = 0;
    A.s.emit('message', JSON.stringify({ type: 'bless_player', targetId: B.p.id }));
    check('no blessing to give → target stays unblessed', !hooks.accounts.wander.ritual);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('FAIL - unexpected error:', e && e.stack || e);
    process.exit(1);
  }
}, 200);
