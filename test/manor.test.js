// The Coven Manor (Session N) — an 8-bedroom home in a coven's PRIVATE world.
// Verifies: entry is gated to your own coven's instance; bedrooms can be claimed
// (one per member, persisted on the coven); a taken room is refused; exit works.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-manor-');

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
    const SPOT = hooks.MANOR_WILDS_SPOT;

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

    // Accounts so bedroom nameplates resolve to display names.
    hooks.accounts.morgana = { username: 'Morgana', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
    hooks.accounts.circe = { username: 'Circe', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
    // A coven for both, and put them in its private world, standing at the manor.
    hooks.covens.cvm = { id: 'cvm', name: 'Night Hags', sigil: '🌙', members: ['morgana', 'circe'], leaderKey: 'morgana' };
    hooks.covenIndex.set('morgana', 'cvm'); hooks.covenIndex.set('circe', 'cvm');
    for (const m of [A, B]) { m.p.room = 'wilds'; m.p.instance = 'coven_cvm'; m.p.x = SPOT.x; m.p.y = SPOT.y; }

    // ── Entry is gated to your own coven's private world ─────────────────
    const pub = join('Stranger', 'stranger'); // no coven, public wilds
    pub.p.room = 'wilds'; pub.p.instance = null; pub.p.x = SPOT.x; pub.p.y = SPOT.y;
    pub.s.emit('message', JSON.stringify({ type: 'enter_manor' }));
    check('a non-coven player in the public wilds is refused', !!pub.s.lastOfType('manor_error') && pub.p.room === 'wilds');

    // A coven member standing in the PUBLIC wilds (not their instance) is refused.
    A.p.instance = null;
    A.s.emit('message', JSON.stringify({ type: 'enter_manor' }));
    check('a coven member outside their private world is refused', !!A.s.lastOfType('manor_error') && A.p.room === 'wilds');
    A.p.instance = 'coven_cvm';

    // ── A enters from the coven's private world ──────────────────────────
    A.s.emit('message', JSON.stringify({ type: 'enter_manor' }));
    const entered = A.s.lastOfType('manor_entered');
    check('entering from the coven world succeeds', !!entered && A.p.room === 'manor', { room: A.p.room });
    check('manor_entered carries the 8-bedroom map', entered && entered.count === hooks.MANOR_BEDROOMS && entered.bedrooms && Object.keys(entered.bedrooms).length === 8);
    check('no bedroom is claimed yet', entered && entered.yours === null);

    // ── Claim bedrooms ───────────────────────────────────────────────────
    A.s.emit('message', JSON.stringify({ type: 'manor_claim_bedroom', slot: 3 }));
    check('A claims bedroom 3 (persisted on the coven)', hooks.covens.cvm.manorBedrooms && hooks.covens.cvm.manorBedrooms[3] === 'morgana');
    let st = A.s.lastOfType('manor_state');
    check('A sees room 3 as theirs', st && st.yours === 3 && st.bedrooms[3] && st.bedrooms[3].name === 'Morgana');

    // One room per member: claiming another frees the first.
    A.s.emit('message', JSON.stringify({ type: 'manor_claim_bedroom', slot: 5 }));
    check('claiming a second room releases the first', hooks.covens.cvm.manorBedrooms[3] == null && hooks.covens.cvm.manorBedrooms[5] === 'morgana');

    // B enters and cannot take A's room, but can take an empty one.
    B.s.emit('message', JSON.stringify({ type: 'enter_manor' }));
    B.s.emit('message', JSON.stringify({ type: 'manor_claim_bedroom', slot: 5 }));
    check('B is refused A’s claimed room', !!B.s.lastOfType('manor_error') && hooks.covens.cvm.manorBedrooms[5] === 'morgana');
    B.s.emit('message', JSON.stringify({ type: 'manor_claim_bedroom', slot: 2 }));
    check('B claims an empty room', hooks.covens.cvm.manorBedrooms[2] === 'circe');

    // ── Exit returns to the wilds ────────────────────────────────────────
    A.s.emit('message', JSON.stringify({ type: 'exit_manor' }));
    check('exiting the manor returns to the wilds', !!A.s.lastOfType('manor_exited') && A.p.room === 'wilds');

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('FAIL - unexpected error:', e && e.stack || e);
    process.exit(1);
  }
}, 200);
