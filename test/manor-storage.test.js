// The Coven Manor — a claimed bed doubles as personal storage. Verifies the
// chest is keyed to the ACCOUNT (not the bed slot), gated to the bed's owner,
// and that deposit/withdraw move items between the pack and the chest.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-manorstore-');

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
    const ITEM = Object.keys(hooks.ITEM_CATALOG)[0]; // any real item id

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
    hooks.covens.cvs = { id: 'cvs', name: 'Night Hags', sigil: '🌙', members: ['morgana', 'circe'], leaderKey: 'morgana', manorBedrooms: { 3: 'morgana' } };
    hooks.covenIndex.set('morgana', 'cvs'); hooks.covenIndex.set('circe', 'cvs');
    for (const m of [A, B]) { m.p.room = 'manor'; m.p.instance = 'coven_cvs'; }

    // Give Morgana an item stack in her pack.
    const inv = hooks.getInventory(A.p);
    inv.slots[0] = { itemId: ITEM, qty: 5 };

    // ── Ownership: only the bed's owner can open its chest ───────────────
    B.s.emit('message', JSON.stringify({ type: 'manor_storage_open', slot: 3 })); // B doesn't own bed 3
    check('a non-owner is refused the chest', !!B.s.lastOfType('manor_error') && !B.s.lastOfType('manor_storage_state'));

    A.s.emit('message', JSON.stringify({ type: 'manor_storage_open', slot: 3 }));
    let st = A.s.lastOfType('manor_storage_state');
    check('the owner opens her chest', !!st && Array.isArray(st.slots) && st.slots.length === hooks.MANOR_STORAGE_SLOTS, st && st.slots && st.slots.length);
    check('chest starts empty', st && st.slots.every(s => s === null));

    // ── Deposit: pack → chest ────────────────────────────────────────────
    A.s.emit('message', JSON.stringify({ type: 'manor_storage_deposit', slot: 3, invIdx: 0 }));
    st = A.s.lastOfType('manor_storage_state');
    check('deposited item lands in the chest', st && st.slots[0] && st.slots[0].itemId === ITEM && st.slots[0].qty === 5, st && st.slots[0]);
    check('the pack slot is now empty', !hooks.getInventory(A.p).slots[0]);
    check('chest is persisted on the coven, keyed by account', hooks.manorChest(hooks.covens.cvs, 'morgana')[0].itemId === ITEM);

    // ── The chest follows the account, not the bed slot ──────────────────
    // Morgana switches to bed 5; her stored items must still be hers (not exposed
    // to whoever takes bed 3).
    hooks.covens.cvs.manorBedrooms = { 5: 'morgana', 3: 'circe' };
    B.s.emit('message', JSON.stringify({ type: 'manor_storage_open', slot: 3 })); // Circe now owns bed 3
    st = B.s.lastOfType('manor_storage_state');
    check('the new owner of bed 3 sees an EMPTY chest (not Morgana’s)', st && st.slots.every(s => s === null));
    A.s.emit('message', JSON.stringify({ type: 'manor_storage_open', slot: 5 })); // Morgana at her new bed
    st = A.s.lastOfType('manor_storage_state');
    check('Morgana’s items followed her to bed 5', st && st.slots[0] && st.slots[0].itemId === ITEM);

    // ── Withdraw: chest → pack ───────────────────────────────────────────
    A.s.emit('message', JSON.stringify({ type: 'manor_storage_withdraw', slot: 5, chestIdx: 0 }));
    st = A.s.lastOfType('manor_storage_state');
    check('withdrawn item leaves the chest', st && st.slots[0] === null);
    check('withdrawn item is back in the pack', hooks.getInventory(A.p).slots.some(s => s && s.itemId === ITEM && s.qty === 5));

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('FAIL - unexpected error:', e && e.stack || e);
    process.exit(1);
  }
}, 200);
