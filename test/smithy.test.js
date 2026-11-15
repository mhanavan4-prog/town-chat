// The Smithy: the Artificer's tower in the Wildlands Village, opened. Gear honed for a groat left on the stone
// (the invisible smith of Wayland's Smithy, Wise 1738), forge water that mends, and the lore told with its source.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { VILLAGE, VILLAGE_HOUSES, VH, WAYLAND, FORGE_WATER } = require('../data/villageHouses');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function world() {
  const sent = [], bank = { balance: 20 }, st = { worn: 12, honed: 0, t: 1000000 };
  const lib = require('../lib/villageHouses')({ send: (ws, m) => sent.push(m), playerMaxHealth: () => 100, bankOf: () => bank, acctOf: (p) => (p.named ? {} : null),
    gearWorn: () => st.worn, honeGear: () => { st.honed++; st.worn = 0; }, now: () => st.t });
  const F = VILLAGE_HOUSES.forge;
  const p = { ws: {}, room: 'wilds', x: F.door.x, y: F.door.y - 10, health: 30, named: true };
  const said = () => (sent.filter((m) => m.type === 'toast').pop() || {}).message || '';
  const at = (id) => { const s = F.spots.find((x) => x.id === id); p.x = s.x; p.y = s.y; };
  return { lib, p, bank, st, sent, said, at, F };
}

test('it stands where the Artificer\'s tower does, and its door is on the north side', () => {
  const F = VILLAGE_HOUSES.forge;
  assert.strictEqual(F.room, 'vh_forge');
  assert.strictEqual(F.door.x, VILLAGE.x + 720); assert.ok(F.door.y < VILLAGE.y - 150, 'north of the tower\'s middle');
  assert.ok(F.out.y < F.door.y, 'and you come out to the north, not into the wall');
  assert.match(read('client/wilds-scene.js'), /const ABX = VX \+ 720, ABZ = VZ - 150;/);
  const w = world();
  assert.ok(w.lib.enter(w.p, 'forge')); assert.strictEqual(w.p.room, 'vh_forge');
  w.lib.exit(w.p); assert.deepStrictEqual([w.p.room, w.p.x, w.p.y], ['wilds', F.out.x, F.out.y]);
  assert.deepStrictEqual(w.lib.doorOf('vh_forge'), { x: F.out.x, y: F.out.y });
  const L = VILLAGE_HOUSES.lodging; assert.deepStrictEqual(w.lib.doorOf('vh_lodging'), { x: L.door.x, y: L.door.y + 30 }, 'the others are as they were');
});

test('the groat stone: gear honed for four gold, by nobody you see', () => {
  const w = world(); w.lib.enter(w.p, 'forge'); w.at('groat');
  assert.strictEqual(w.lib.use(w.p, 'groat'), 'paid');
  assert.strictEqual(w.bank.balance, 20 - VH.groatGold); assert.strictEqual(w.st.honed, 1);
  assert.match(w.said(), /the money is gone and every edge is keen/);
  assert.notStrictEqual(w.lib.use(w.p, 'groat'), 'paid', 'nothing worn: no charge');
  assert.strictEqual(w.bank.balance, 20 - VH.groatGold); assert.match(w.said(), /You keep your groat/);
  w.st.worn = 5; w.bank.balance = 1;
  assert.notStrictEqual(w.lib.use(w.p, 'groat'), 'paid'); assert.strictEqual(w.st.honed, 1); assert.match(w.said(), /You have not got it/);
  w.p.named = false; w.bank.balance = 50; w.lib.use(w.p, 'groat'); assert.strictEqual(w.st.honed, 1, 'a guest has no gear to keep'); assert.match(w.said(), /Log into an account/);
  assert.strictEqual(VH.groatGold, 4, 'a groat was fourpence');
});

test('the forge water mends by half, and then wants leaving a while', () => {
  const w = world(); w.lib.enter(w.p, 'forge'); w.at('tub');
  w.lib.use(w.p, 'tub'); assert.strictEqual(w.p.health, 80);
  w.p.health = 40; w.lib.use(w.p, 'tub'); assert.strictEqual(w.p.health, 40, 'not again so soon'); assert.match(w.said(), /Come back to it in 5 minutes/);
  w.st.t += VH.tubRestMs + 1; w.p.health = 90; w.lib.use(w.p, 'tub'); assert.strictEqual(w.p.health, 100, 'never past whole');
  w.st.t += VH.tubRestMs + 1; w.lib.use(w.p, 'tub'); assert.match(w.said(), /nothing on you for it to mend/);
  w.p.x = 500; w.p.y = 440; w.p.health = 10; w.st.t += VH.tubRestMs + 1; w.lib.use(w.p, 'tub'); assert.strictEqual(w.p.health, 10, 'from across the room it does nothing'); assert.match(w.said(), /Go closer/);
});

test('the lore is told with its tier, its source, and where the game goes beyond it', () => {
  assert.strictEqual(WAYLAND.tier, 'record'); assert.strictEqual(FORGE_WATER.tier, 'folk');
  assert.match(WAYLAND.source, /Wise.*1738/); assert.match(FORGE_WATER.source, /Schools' Collection.*Loughshinny/);
  assert.match(WAYLAND.note, /is the game's/); assert.match(FORGE_WATER.note, /is the game's/);
  assert.ok(WAYLAND.lore.some((l) => /money gone and the horse new shod/.test(l)));
  const w = world(); w.lib.enter(w.p, 'forge'); w.at('smith'); w.lib.use(w.p, 'smith');
  const b = w.sent.filter((m) => m.type === 'vh_board').pop();
  assert.ok(b && b.lines.includes(`Source: ${WAYLAND.source}`) && b.lines.includes(`Source: ${FORGE_WATER.source}`) && b.lines.includes(WAYLAND.note) && b.lines.includes(FORGE_WATER.note));
});

test('the server hones through one function, and the room is drawn', () => {
  const s = read('server.js');
  assert.match(s, /gearWorn: \(p\) => repairCostFor\(p\), honeGear: \(p\) => honeAllGear\(p\),/);
  assert.match(s, /function honeAllGear\(player\) \{/);
  const v = read('client/village-house.js');
  assert.match(v, /\} else if \(house\.id === 'forge'\) \{/); assert.match(v, /The groat stone — Press F/); assert.match(v, /The slack-tub — Press F/);
});
