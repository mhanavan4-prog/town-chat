// The pack can be moved about and put in order, every slot says what it holds, and the herb bag takes what is
// gathered off trees and bushes as well as the garden's herbs.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-invmove-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
require('../server.js');
setTimeout(async () => {
  const h = global.__testHooks, wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('P'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Packer', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id); p.accountKey = 'packer'; s._isGuest = false;
  const say = (m) => s.emit('message', JSON.stringify(m));
  const inv = h.getInventory(p);
  for (let i = 0; i < inv.slots.length; i++) inv.slots[i] = null;
  inv.slots[0] = { itemId: 'iron_ore', qty: 3 }; inv.slots[1] = { itemId: 'bone_shard', qty: 2 }; inv.slots[5] = { itemId: 'iron_ore', qty: 4 };
  const ids = () => inv.slots.map((x) => (x ? x.itemId + ':' + x.qty : '-')).slice(0, 8).join(' ');

  say({ type: 'inventory_move', from: 1, to: 3 });
  check('a stack goes to an empty slot', ids() === 'iron_ore:3 - - bone_shard:2 - iron_ore:4 - -', ids());
  check('and the client is told where it went', s.lastOfType('inventory_state').moved === 3);
  say({ type: 'inventory_move', from: 3, to: 0 });
  check('two different things change places', ids() === 'bone_shard:2 - - iron_ore:3 - iron_ore:4 - -', ids());
  say({ type: 'inventory_move', from: 3, to: 5 });
  check('two of a kind become one stack', ids() === 'bone_shard:2 - - - - iron_ore:7 - -', ids());
  const before = ids();
  for (const m of [{ from: 2, to: 4 }, { from: 0, to: 0 }, { from: 0, to: 999 }, { from: -1, to: 2 }, { from: 'x', to: 1 }]) say({ type: 'inventory_move', ...m });
  check('an empty slot, the same slot and a slot that is not there move nothing', ids() === before, ids());

  const gear = Object.keys(h.ITEM_CATALOG || {}).find((k) => h.ITEM_CATALOG[k].slot) || null;
  if (gear) inv.slots[7] = { itemId: gear, qty: 1 };
  inv.slots[6] = { itemId: 'animal_pelt', qty: 1 };
  say({ type: 'inventory_tidy' });
  const order = inv.slots.filter(Boolean).map((x) => x.itemId);
  check('Tidy closes the gaps: gear first, then the rest by name', inv.slots.findIndex((x) => !x) === order.length && (!gear || order[0] === gear) && order.slice(gear ? 1 : 0).join() === 'animal_pelt,bone_shard,iron_ore', order);

  // the herb bag takes what is gathered off trees and bushes
  const { FLORA_IDS } = require('../data/flora');
  inv.herbBag = 4; inv.herbs = inv.herbs || {};
  check('a Ring Cap and an Ivy Leaf are plants to the bag', h.addItemToAccount(inv, 'ring_cap', 2) && h.addItemToAccount(inv, 'ivy_leaf', 1) && inv.herbs.ring_cap === 2 && inv.herbs.ivy_leaf === 1 && !inv.slots.some((x) => x && (x.itemId === 'ring_cap' || x.itemId === 'ivy_leaf')));
  check('and still count when something asks how many you have', h.countItemQty(inv, 'ring_cap') === 2);
  const kinds = await import('../client/item-kinds.js');
  check('the client\'s list of them is the server\'s', JSON.stringify(kinds.FLORA) === JSON.stringify(FLORA_IDS));
  const cat = { sword: { name: 'Sword', slot: 'weapon' }, iron_ore: { name: 'Iron Ore', slot: null } };
  check('each thing is told apart by kind', kinds.itemKind('sword', cat, {}) === 'gear' && kinds.itemKind('healing_potion', cat, {}) === 'brew' && kinds.itemKind('ring_cap', cat, {}) === 'plant' && kinds.itemKind('yarrow', cat, { yarrow: {} }) === 'plant' && kinds.itemKind('iron_ore', cat, {}) === 'material');
  check('and named, even when the catalogue has not heard of it', kinds.itemName('iron_ore', cat) === 'Iron Ore' && kinds.itemName('moon_dew', cat) === 'Moon Dew');

  const panel = fs.readFileSync(path.join(__dirname, '..', 'client/inventory-panel.js'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');
  check('the panel: a name and a kind mark on every slot, drag with a mouse, Move and Tidy for a thumb',
    /nm\.className = 'slotName'; nm\.textContent = itemName\(slot\.itemId, ITEM_CATALOG\)/.test(panel) && /mark\.className = 'slotKind'/.test(panel) && /cell\.draggable = true;/.test(panel)
    && /type: 'inventory_move', from, to/.test(panel) && /type: 'inventory_tidy'/.test(panel) && /mv\.className = 'btn invMoveBtn'/.test(panel) && /#invSlotsGrid \.slotName \{/.test(css));
  const srv = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  check('a bag bought before this takes the pack\'s foraged plants in once', /if \(inv0 && inv0\.herbBag && !inv0\.floraSwept\) \{ herbBag\.sweep\(inv0\); inv0\.floraSwept = true;/.test(srv));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
