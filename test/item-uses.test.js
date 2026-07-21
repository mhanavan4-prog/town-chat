// 🧪 Item uses — every catalog item has a real, on-theme use, and two fixes:
//   1. Wilds flora brews (and every PLANT_CATALOG consumable) are USABLE: the
//      use_item handler resolves a real effect, and the server ships the
//      authoritative usable-item list to the client so a Use button appears
//      (this is what stopped the flora brews reading as "can't be equipped").
//   2. The Hard Drive binds to the account on first open: the physical item is
//      consumed (frees the pack slot) and access lives on as the 💽 tab.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-itemuses-test-');

const { PLANT_CATALOG } = require('../data/world');

function makeMockSocket(label) {
  return {
    label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; },
    send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; }
  };
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); }
}

require('../server.js');

setTimeout(() => {
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const hooks = global.__testHooks;

  const join = (name, charId = 3) => {
    const s = makeMockSocket(name);
    connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name, charId }));
    const id = s.lastOfType('init').id;
    return { s, id, p: hooks.players.get(id) };
  };
  const slotOf = (p, itemId) => hooks.getInventory(p).slots.findIndex(sl => sl && sl.itemId === itemId);

  // ─── 1. Every consumable has a real, resolvable effect ──────────────────
  const VALID_STATUS = new Set(['bats', 'colorcycle', 'feather', 'giant', 'gibberish',
    'meditate', 'pumpkin', 'ravencloak', 'regen', 'shrink', 'speedboost', 'stumble',
    'toad', 'wolfmark', 'wolfpact']);
  const inert = Object.entries(PLANT_CATALOG).filter(([, pl]) => !(
    (pl.effect === 'status' && VALID_STATUS.has(pl.statusType) && pl.durationMs > 0) ||
    (pl.effect === 'heal' && pl.amount > 0) ||
    (pl.effect === 'cleanse')
  )).map(([k]) => k);
  check('no consumable is inert — every PLANT_CATALOG item resolves a real effect',
    inert.length === 0, inert);

  // ─── 2. The client is TOLD which items are usable (drift-proof) ─────────
  const { s: alice, p: aliceP } = join('Alice');
  const init = alice.lastOfType('init');
  const FLORA_BREWS = ['barkbind_salve', 'capwood_elixir', 'nightsight_draught',
    'fernstep_philtre', 'bramble_poultice', 'witchwood_balm'];
  check('init ships the authoritative usable-item list',
    Array.isArray(init.usableItems) && init.usableItems.length === Object.keys(PLANT_CATALOG).length);
  check('every flora brew is advertised as usable (no more "can\'t be equipped")',
    FLORA_BREWS.every(id => init.usableItems.includes(id)),
    FLORA_BREWS.filter(id => !init.usableItems.includes(id)));

  // ─── 3. Using a status brew actually applies its status ─────────────────
  hooks.addItemToAccount(hooks.getInventory(aliceP), 'nightsight_draught', 1);
  alice.emit('message', JSON.stringify({ type: 'use_item', slotIdx: slotOf(aliceP, 'nightsight_draught') }));
  check('using the Nightsight Draught grants its status (ravencloak)',
    aliceP.activeStatus && aliceP.activeStatus.type === 'ravencloak', aliceP.activeStatus);
  check('using a consumable sends a use_result and consumes the item',
    !!alice.lastOfType('use_result') && slotOf(aliceP, 'nightsight_draught') === -1);

  // ─── 4. Using a heal brew restores HP ──────────────────────────────────
  aliceP.health = 10;
  hooks.addItemToAccount(hooks.getInventory(aliceP), 'bramble_poultice', 1);
  alice.emit('message', JSON.stringify({ type: 'use_item', slotIdx: slotOf(aliceP, 'bramble_poultice') }));
  check('using the Bramble Poultice heals (+50, capped at max)',
    aliceP.health === Math.min(hooks.playerMaxHealth(aliceP), 60), aliceP.health);

  // ─── 5. The Hard Drive binds to the account on first open ───────────────
  const { s: bob, p: bobP } = join('Bob');
  // No drive yet → opening is refused.
  bob.emit('message', JSON.stringify({ type: 'harddrive_open' }));
  check('opening with no drive is refused', !!bob.lastOfType('harddrive_error'));

  hooks.addItemToAccount(hooks.getInventory(bobP), 'hard_drive', 1);
  check('the drive starts life as a real inventory item', slotOf(bobP, 'hard_drive') !== -1);

  bob.emit('message', JSON.stringify({ type: 'harddrive_open' }));
  check('first open reveals the drive', !!bob.lastOfType('harddrive_state'));
  check('first open DISSOLVES the physical item (frees the slot)',
    slotOf(bobP, 'hard_drive') === -1);
  check('the drive is now bound to the account', hooks.getHardDrive(bobP).opened === true);
  const invAfter = bob.lastOfType('inventory_state');
  check('inventory_state reports the drive as owned (tab stays live)',
    invAfter && invAfter.hardDriveOwned === true);

  // Access persists with no item in the pack.
  bob.emit('message', JSON.stringify({ type: 'harddrive_open' }));
  check('the drive re-opens later with no item carried',
    !!bob.lastOfType('harddrive_state') && slotOf(bobP, 'hard_drive') === -1);
  bob.emit('message', JSON.stringify({ type: 'harddrive_save_clip', audio: 'data:audio/webm;base64,' + 'B'.repeat(64), label: 'boo' }));
  const hd = bob.lastOfType('harddrive_state');
  check('a bound (item-less) drive still stores media', hd && hd.clips.length === 1);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 150);
