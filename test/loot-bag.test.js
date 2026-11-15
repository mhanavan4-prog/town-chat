// The loot bag: F by a body opens a list of what is on it; you take what you choose and the rest stays.
// (Asked for: "press F to loot, and have a loot bag open up showing me the items inside so I have a choice".)
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-lootbag-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; },
    countOf(type) { return this.sent.filter((m) => m.type === type).length; } };
}
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const main = read('client/main.js'), bagJs = read('client/loot-bag.js'), html = read('public/index.html');

// the client side
const B = new Function(bagJs.replace(/export function /g, 'function ') + '\nreturn { lootBagCount, createLootBag };')();
check('the count under the title reads like a person wrote it', B.lootBagCount([]) === 'Empty' && B.lootBagCount([1]) === '1 thing' && B.lootBagCount([1, 2, 3]) === '3 things');
check('F by a body asks to see the bag; F again with it open takes all; and loot comes before the crypt\'s "F climbs out"', /if \(lootBag\.isOpen\(\)\) \{ lootBag\.takeAll\(\); return; \}/.test(main) && /type: 'loot_peek', targetType: loot\.lootType, targetId: loot\.targetId/.test(main) && main.indexOf('if (lootBag.isOpen()) { lootBag.takeAll(); return; }') < main.indexOf("if (me.room === 'crypt') { exitCrypt(); return; }"));
check('a click or tap on the loot icon opens the bag too (it no longer takes everything)', /type: 'loot_peek', targetType: hit\.lootType, targetId: hit\.targetId/.test(main) && !/type: 'loot_corpse'/.test(main));
check('the prompt says so, and the bag shuts itself when you walk off', /\$\{interactVerb\(\)\} loot`/.test(main) && /\$\{interactVerb\(\)\} take all`/.test(main) && /nearestLoot\(150\); if \(!nl \|\| nl\.targetId !== tg\.targetId\) lootBag\.close\(\);/.test(main));
check('you reach for a body from a little inside what the server allows', /const LOOT_REACH = 80;/.test(main) && /const LOOT_RANGE = 90;/.test(read('server.js')));
check('the bag never stops the game: it is not a modal, and a full panel hides it', !/Modals\.set\('loot/.test(main) && /body\.panelOpen #lootBag \{ display:none; \}/.test(html) && /#lootBag \{\s*position:fixed;/.test(html));
{ // the bag with a stand-in page
  const sent = []; const mk = (tag) => { const kids = []; const el = { tag, className: '', dataset: {}, style: {}, children: kids, textContent: '', _l: {}, classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    setAttribute() {}, appendChild(c) { kids.push(c); return c; }, append(...c) { kids.push(...c); }, addEventListener(t, f) { el._l[t] = f; },
    set innerHTML(v) { el._q = { '.lbClose': mk('b'), '.lbAll': mk('b'), '.lbRows': mk('d'), '.lbTitle': mk('s'), '.lbCount': mk('s') }; }, querySelector(q) { return el._q[q]; } };
    Object.defineProperty(el, 'className', { set(v) { el.classList._s = new Set(String(v).split(' ').filter(Boolean)); }, get() { return [...el.classList._s].join(' '); } }); return el; };
  const doc = { createElement: mk, body: { appendChild() {} } }, win = { addEventListener() {} };
  const bag = B.createLootBag({ send: (m) => sent.push(m), doc, win });
  bag.show({ targetType: 'mob2', targetId: 'm1', title: 'On the body', items: [{ i: 0, icon: '🪙', name: '12 gold', qty: 1 }, { i: 1, icon: '🦴', name: 'Bone Shard', qty: 2 }] });
  check('shown, it is open on that body', bag.isOpen() && bag.target().targetId === 'm1');
  bag.take(1); bag.takeAll();
  check('a row asks for that one entry by its place; the button asks for all', JSON.stringify(sent) === JSON.stringify([{ type: 'loot_take', targetType: 'mob2', targetId: 'm1', picks: [1] }, { type: 'loot_take', targetType: 'mob2', targetId: 'm1', all: true }]));
  bag.show({ targetType: 'mob2', targetId: 'OTHER', items: [] });
  check('an empty bag for some other body does not shut this one', bag.isOpen());
  bag.show({ targetType: 'mob2', targetId: 'm1', items: [] });
  check('an empty bag for this body shuts it', !bag.isOpen() && bag.target() === null);
}

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks, wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Looter'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Looter', charId: 4 }));
  const p = h.players.get(s.lastOfType('init').id); p.accountKey = 'looter'; s._isGuest = false;
  const say = (m) => s.emit('message', JSON.stringify(m));
  const itemIds = Object.keys(h.ITEM_CATALOG).filter((id) => h.ITEM_CATALOG[id] && h.ITEM_CATALOG[id].name).slice(0, 2);
  const mob = h.mobs2[0];
  const lay = () => { Object.assign(p, { room: 'wilds', x: mob.x + 10, y: mob.y, isDead: false, instance: '' }); mob.dead = true; mob.pendingLoot = [{ kind: 'gold', amount: 7 }, { kind: 'item', itemId: itemIds[0], qty: 1 }, { kind: 'item', itemId: itemIds[1], qty: 2 }]; mob.lootKillerId = p.id; };
  const have = (id) => h.countItemQty(h.getInventory(p), id);
  const gold = () => h.ensureBankAccount('looter').balance;

  lay(); const g0 = gold(), a0 = have(itemIds[0]), b0 = have(itemIds[1]);
  say({ type: 'loot_peek', targetType: 'mob2', targetId: mob.id });
  let bag = s.lastOfType('loot_bag');
  check('peeking lists what is on the body, in order, each with a name and an icon', bag && bag.items.length === 3 && bag.items[0].name === '7 gold' && bag.items[1].name === h.ITEM_CATALOG[itemIds[0]].name && bag.items[2].qty === 2 && bag.items.every((r, i) => r.i === i && r.icon));
  check('and takes nothing', mob.pendingLoot.length === 3 && gold() === g0 && have(itemIds[0]) === a0 && s.countOf('loot_drop') === 0);

  say({ type: 'loot_take', targetType: 'mob2', targetId: mob.id, picks: [1] });
  bag = s.lastOfType('loot_bag');
  check('taking one row gives you that one thing and leaves the rest on the body, still yours', have(itemIds[0]) === a0 + 1 && gold() === g0 && have(itemIds[1]) === b0 && mob.pendingLoot.length === 2 && mob.lootKillerId === p.id);
  check('the bag comes back with what is left', bag.items.length === 2 && bag.items[0].name === '7 gold' && bag.items[1].name === h.ITEM_CATALOG[itemIds[1]].name);

  say({ type: 'loot_take', targetType: 'mob2', targetId: mob.id, picks: [99, -1, 'x'] });
  check('a pick that is not in the bag takes nothing', mob.pendingLoot.length === 2 && gold() === g0);

  say({ type: 'loot_take', targetType: 'mob2', targetId: mob.id, all: true });
  bag = s.lastOfType('loot_bag');
  check('take all empties the body and the bag', mob.pendingLoot === null && mob.lootKillerId === null && gold() === g0 + 7 && have(itemIds[1]) === b0 + 2 && bag.items.length === 0);

  lay(); p.x = mob.x + 400;
  say({ type: 'loot_peek', targetType: 'mob2', targetId: mob.id });
  check('from too far the bag does not open, and says why', s.lastOfType('loot_error').message === 'Get closer to loot that.' && s.lastOfType('loot_bag').items.length === 0 && mob.pendingLoot.length === 3);

  lay(); mob.lootKillerId = 'someone-else';
  say({ type: 'loot_take', targetType: 'mob2', targetId: mob.id, all: true });
  check('somebody else\'s kill is not yours to open', mob.pendingLoot.length === 3 && /nothing here for you/.test(s.lastOfType('loot_error').message));

  lay(); const before = s.countOf('loot_bag');
  say({ type: 'loot_corpse', targetType: 'mob2', targetId: mob.id });
  check('the old one-press loot still takes everything, and opens no bag', mob.pendingLoot === null && s.countOf('loot_bag') === before && s.lastOfType('loot_drop').items.length === 3);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
