// The herb bag: Mother Yarrow sells them in tiers; plants go into it instead of taking pack slots; the best holds every
// plant in the game. (Asked for: "plants take up way too much room in the inventory".)
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-herbbag-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const main = read('client/main.js');

// the bag by itself
const make = require('../lib/herbBag');
const bag = make({ HERB_IDS: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] });
check('four bags, each bigger than the last and dearer, and the last holds every plant', bag.TIERS.length === 5 && bag.TIERS.slice(1).every((t, i, all) => t.tier === i + 1 && (i === 0 || (t.kinds > all[i - 1].kinds && t.gold > all[i - 1].gold))) && bag.TIERS[4].kinds === Infinity);
{ const inv = { slots: new Array(4).fill(null) };
  check('with no bag nothing goes in it', bag.tryAdd(inv, 'a', 3) === false && bag.capOf(inv) === 0 && bag.count(inv, 'a') === 0);
  inv.herbBag = 1;
  check('a plant goes in; a thing that is not a plant does not', bag.tryAdd(inv, 'a', 3) === true && bag.tryAdd(inv, 'sword', 1) === false && bag.count(inv, 'a') === 3);
  for (const k of ['b', 'c', 'd', 'e', 'f', 'g', 'h']) bag.tryAdd(inv, k, 1);
  check('each sort takes one place however many you hold; a full bag turns a new sort away but still takes more of an old one', bag.kindsIn(inv) === 8 && bag.tryAdd(inv, 'i', 1) === false && bag.tryAdd(inv, 'a', 40) === true && bag.count(inv, 'a') === 43);
  check('taking out some leaves the rest; taking the last frees the place', bag.removeUpTo(inv, 'a', 40) === 40 && bag.count(inv, 'a') === 3 && bag.removeUpTo(inv, 'a', 9) === 3 && bag.kindsIn(inv) === 7 && bag.tryAdd(inv, 'i', 1) === true);
  check('a whole sort comes out into the pack, onto its own stack if there is one', (() => { inv.slots[0] = { itemId: 'b', qty: 2 }; return bag.takeOut(inv, 'b') === 'ok' && inv.slots[0].qty === 3 && bag.count(inv, 'b') === 0 && bag.takeOut(inv, 'b') === 'none'; })());
  check('with no room in the pack it stays in the bag', (() => { inv.slots = [{ itemId: 'x', qty: 1 }]; return bag.takeOut(inv, 'c') === 'full' && bag.count(inv, 'c') === 1; })());
  inv.herbBag = 4; inv.slots = [{ itemId: 'j', qty: 5 }, { itemId: 'sword', qty: 1 }, { itemId: 'b', qty: 2 }];
  check('the hamper has a place for every plant there is, and stowing sweeps the pack\'s plants into it', bag.capOf(inv) === 10 && bag.sweep(inv) === 2 && inv.slots[0] === null && inv.slots[1].itemId === 'sword' && inv.slots[2] === null && bag.count(inv, 'j') === 5);
  const pl = bag.payload(inv, { j: { name: 'Jay', icon: 'J' } });
  check('the payload names what you have, what is in it and what she sells', pl.tier === 4 && pl.all === true && pl.kinds === 10 && pl.used === bag.kindsIn(inv) && pl.herbs.find((r) => r.itemId === 'j').name === 'Jay' && pl.shop.length === 4 && pl.shop.every((b) => b.owned));
}

// the client
check('Mother Yarrow\'s panel has a herb bag page: buy, take out, stow', /data-view="bag">🧺 Herb bag/.test(main) && /type: 'herb_bag_buy', tier:/.test(main) && /type: 'herb_take', itemId:/.test(main) && /type: 'herb_stow'/.test(main));
check('sowing counts what is in the bag as well as the pack', /const hb = lastInventoryState && lastInventoryState\.herbBag; if \(hb\) for \(const h of hb\.herbs \|\| \[\]\) if \(h\.itemId === id\) n \+= h\.qty;/.test(main));
check('the pack panel says where your plants are', /Herb bag \$\{hb\.used\}\/\$\{hb\.kinds\} sorts/.test(read('client/inventory-panel.js')));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks, wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Herbwife'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Herbwife', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id); p.accountKey = 'herbwife'; s._isGuest = false;
  const say = (m) => s.emit('message', JSON.stringify(m));
  const inv = h.getInventory(p), bank = h.ensureBankAccount('herbwife');
  const { PLANT_CATALOG } = require('../data/world');
  const { POTION_RECIPES } = require('../data/gameConstants');
  const brews = new Set(POTION_RECIPES.map((r) => r.result));
  const plants = Object.keys(PLANT_CATALOG).filter((k) => !brews.has(k) && !['salt', 'hearth_loaf', 'wolf_pact_brew'].includes(k));
  check('every raw plant in the game is a herb, and brews, salt and bread are not', plants.every((k) => h.herbBag.isHerb(k)) && !h.herbBag.isHerb('salt') && !h.herbBag.isHerb('hearth_loaf') && ![...brews].some((k) => h.herbBag.isHerb(k)) && h.herbBag.size >= plants.length);

  inv.slots.fill(null); inv.herbs = {}; inv.herbBag = 0;
  h.addItemToAccount(inv, plants[0], 2); h.addItemToAccount(inv, plants[1], 1);
  check('with no bag, plants take pack slots as before', inv.slots.filter(Boolean).length === 2 && h.countItemQty(inv, plants[0]) === 2);

  bank.balance = 100; say({ type: 'herb_bag_buy', tier: 1 });
  check('she will not sell on credit', inv.herbBag === 0 && /200 gold; you have 100/.test(s.lastOfType('garden_error').message) && bank.balance === 100);
  bank.balance = 10000; say({ type: 'herb_bag_buy', tier: 1 });
  check('buying the pouch takes the gold and moves the pack\'s plants into it', inv.herbBag === 1 && bank.balance === 9800 && inv.slots.filter(Boolean).length === 0 && h.herbBag.kindsIn(inv) === 2);
  check('and the count is unchanged: what you had, you still have', h.countItemQty(inv, plants[0]) === 2 && h.countItemQty(inv, plants[1]) === 1);
  const st = s.lastOfType('inventory_state');
  check('the client is told about the bag', st.herbBag && st.herbBag.tier === 1 && st.herbBag.kinds === 8 && st.herbBag.used === 2 && st.herbBag.shop.filter((b) => !b.owned).length === 3);

  for (let i = 2; i < 8; i++) h.addItemToAccount(inv, plants[i], 1);
  check('new plants go straight into the bag, not the pack', inv.slots.filter(Boolean).length === 0 && h.herbBag.kindsIn(inv) === 8);
  h.addItemToAccount(inv, plants[8], 1);
  check('past its eight sorts the ninth goes into the pack', inv.slots.filter(Boolean).length === 1 && inv.slots.find(Boolean).itemId === plants[8]);
  h.addItemToAccount(inv, plants[0], 5); inv.slots[5] = { itemId: plants[0], qty: 1 };
  check('removing takes from the pack first and then the bag, and refuses if the two together are short', h.removeItemFromAccount(inv, plants[0], 99) === false && h.countItemQty(inv, plants[0]) === 8 && h.removeItemFromAccount(inv, plants[0], 3) === true && inv.slots[5] === null && h.herbBag.count(inv, plants[0]) === 5);

  say({ type: 'herb_bag_buy', tier: 1 });
  check('the same bag again is refused, and costs nothing', /as good a bag already/.test(s.lastOfType('garden_error').message) && bank.balance === 9800);
  say({ type: 'herb_bag_buy', tier: 4 });
  for (const k of plants) h.addItemToAccount(inv, k, 1);
  check('the hamper carries every plant in the game with none in the pack', inv.herbBag === 4 && bank.balance === 4800 && h.herbBag.kindsIn(inv) >= plants.length && !inv.slots.some((sl) => sl && h.herbBag.isHerb(sl.itemId)));

  say({ type: 'herb_take', itemId: plants[3] });
  check('taking a plant out puts the whole of it in the pack', h.herbBag.count(inv, plants[3]) === 0 && inv.slots.some((sl) => sl && sl.itemId === plants[3]));
  say({ type: 'herb_stow' });
  check('and stowing puts it back', h.herbBag.count(inv, plants[3]) > 0 && !inv.slots.some((sl) => sl && sl.itemId === plants[3]));

  // a thing that is not a plant never goes near it
  const sword = Object.keys(h.ITEM_CATALOG).find((k) => !h.herbBag.isHerb(k));
  h.addItemToAccount(inv, sword, 1);
  check('a sword goes in the pack', inv.slots.some((sl) => sl && sl.itemId === sword) && h.herbBag.count(inv, sword) === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
