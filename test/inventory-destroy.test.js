// Inventory destroy — a full satchel stops progress, so a stack can be binned to
// free a slot. Drives the destroy_item ws handler: it removes the whole stack (or
// a qty) at a slot, refuses an empty slot and a guest, and ships a fresh
// inventory_state so the freed slot shows at once.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-invdestroy-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    clear() { this.sent.length = 0; },
  };
}

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    if (key) { p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {}; }
    return { s, p };
  }
  const give = (p, id, n) => { const inv = h.getInventory(p); for (let i = 0; i < n; i++) h.addItemToAccount(inv, id, 1); };
  const qty = (p, id) => h.countItemQty(h.getInventory(p), id);
  const slotOf = (p, id) => h.getInventory(p).slots.findIndex((s) => s && s.itemId === id);

  // ── Destroy a whole stack frees the slot ───────────────────────────────────
  const w = join('Witch', 'id_witch');
  give(w.p, 'healing_herb', 4);
  give(w.p, 'glass_vial', 2);
  const herbSlot = slotOf(w.p, 'healing_herb');
  check('the stack is there to start', qty(w.p, 'healing_herb') === 4 && herbSlot >= 0);
  w.s.clear();
  w.s.emit('message', JSON.stringify({ type: 'destroy_item', slotIdx: herbSlot }));
  check('destroying a stack removes all of it', qty(w.p, 'healing_herb') === 0, qty(w.p, 'healing_herb'));
  check('the slot is freed (now empty)', h.getInventory(w.p).slots[herbSlot] == null);
  check('other items are untouched', qty(w.p, 'glass_vial') === 2);
  check('a fresh inventory_state is shipped', w.s.lastOfType('inventory_state') !== null);
  check('a discard confirmation is sent', /discard/i.test((w.s.lastOfType('use_result') || {}).message || ''));

  // ── A qty destroys only part of the stack ──────────────────────────────────
  give(w.p, 'salt', 5);
  const saltSlot = slotOf(w.p, 'salt');
  w.s.emit('message', JSON.stringify({ type: 'destroy_item', slotIdx: saltSlot, qty: 2 }));
  check('a partial qty leaves the rest', qty(w.p, 'salt') === 3, qty(w.p, 'salt'));
  // An over-large qty just clears the stack (clamped), never goes negative.
  w.s.emit('message', JSON.stringify({ type: 'destroy_item', slotIdx: saltSlot, qty: 999 }));
  check('an over-large qty clears the stack, not below zero', qty(w.p, 'salt') === 0, qty(w.p, 'salt'));

  // ── An empty slot is refused ───────────────────────────────────────────────
  w.s.clear();
  w.s.emit('message', JSON.stringify({ type: 'destroy_item', slotIdx: herbSlot }));
  check('destroying an empty slot is refused', w.s.lastOfType('use_error') !== null && w.s.lastOfType('inventory_state') === null);

  // ── A guest (no account) is refused ────────────────────────────────────────
  const guest = join('Guest', null);
  guest.s.emit('message', JSON.stringify({ type: 'destroy_item', slotIdx: 0 }));
  check('a guest cannot destroy (no account)', guest.s.lastOfType('use_error') !== null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
