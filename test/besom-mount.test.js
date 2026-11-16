// The besom you ride, from Level 20 (lib/besomMount.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const createBesomMount = require('../lib/besomMount');

const make = () => {
  const sent = [], seen = [];
  const m = createBesomMount({ send: (ws, msg) => sent.push({ ws, ...msg }), levelOf: (p) => p.level, openRooms: new Set(['outside', 'wilds', 'ember_wastes']), broadcastRoom: (room, msg) => seen.push({ room, ...msg }) });
  return { m, sent, seen };
};
const witch = (extra) => ({ id: 'w', ws: 'w', level: 20, room: 'outside', ...extra });

test('it is earned at Level 20, and not before', () => {
  const { m, sent } = make();
  const low = witch({ level: 19 });
  assert.strictEqual(m.mount(low, true), false);
  assert.ok(!low.mounted);
  assert.match(sent[0].message, /Level 20/);
  const w = witch();
  assert.strictEqual(m.mount(w, true), true);
  assert.strictEqual(w.mounted, true);
  assert.ok(sent.some((s) => s.type === 'besom_mount' && s.on === true && s.speed === m.MOUNT.speed && s.hover === m.MOUNT.hover));
});

test('only out of doors, and not sitting down or dead', () => {
  const { m } = make();
  for (const room of ['outside', 'wilds', 'ember_wastes']) { const w = witch({ room }); assert.ok(m.mount(w, true), room); }
  for (const room of ['dungeon_t1', 'cafe', 'vh_forge']) { const w = witch({ room }); assert.ok(!m.mount(w, true), room); assert.ok(!w.mounted); }
  assert.ok(!m.mount(witch({ seated: { x: 0 } }), true));
  assert.ok(!m.mount(witch({ isDead: true }), true));
});

test('a hit knocks you off and says so; fighting or going in puts you down quietly', () => {
  const { m, sent, seen } = make();
  const w = witch(); m.mount(w, true);
  sent.length = 0;
  assert.ok(m.dismount(w, 'hit'));
  assert.ok(!w.mounted);
  assert.ok(sent.some((s) => /knocked off/.test(s.message || '')));
  assert.ok(seen.some((s) => s.type === 'besom_mount_seen' && s.on === false));
  for (const why of ['fight', 'room']) { m.mount(w, true); sent.length = 0; m.dismount(w, why); assert.ok(!w.mounted); assert.ok(!sent.some((s) => s.message)); }
  assert.strictEqual(m.dismount(w, 'hit'), false, 'already off');
});

test('others see her riding only where she can ride', () => {
  const { m } = make();
  const w = witch(); m.mount(w, true);
  assert.ok(m.riding(w));
  w.room = 'cafe'; assert.ok(!m.riding(w));
  w.room = 'wilds'; w.isDead = true; assert.ok(!m.riding(w));
});

test('reaching Level 20 says so, once, with where the broom comes from', () => {
  const { m, sent } = make();
  assert.ok(!m.onLevel(witch(), 18, 19));
  assert.ok(m.onLevel(witch(), 19, 20));
  assert.ok(!m.onLevel(witch(), 20, 21));
  assert.match(sent[0].message, /Le Champion des Dames/);
  assert.match(sent[0].message, /is the game's/);
  assert.strictEqual(m.MOUNT_LORE.tier, 'record');
});

test('the server and client are wired', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');
  const gates = fs.readFileSync(path.join(__dirname, '..', 'client', 'menu-gates.js'), 'utf8');
  assert.match(server, /if \(msg\.type === 'besom_mount'\) \{ besomMount\.mount\(player, !!msg\.on\); return; \}/);
  assert.match(server, /if \(p\.mounted\) besomMount\.dismount\(p, 'hit'\);/);
  assert.match(server, /mounted: besomMount\.riding\(p\) \|\| undefined,/);
  assert.match(server, /besomMount\.onLevel\(player, prog\.level - 1, prog\.level\)/);
  assert.match(main, /if \(besomRide\.on\) speed \*= besomRide\.speed;/);
  assert.match(main, /\(e\.key === 'g' \|\| e\.key === 'G'\) && !e\.repeat\) \{ toggleBesomRide\(\);/);
  assert.match(gates, /20: \['menuBesom'\]/);
});

test('the broom is seated under the rider\'s hips on every broom, ridden or flown', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');
  assert.match(main, /function seatBroom\(v, broom\) \{/);
  assert.match(main, /o\.name === 'hips'/);
  assert.match(main, /broom\.position\.set\(_hipsAt\.x, _hipsAt\.y - BROOM_UNDER_HIPS, _hipsAt\.z - BROOM_BEHIND\);/);
  assert.match(main, /if \(v\.mountBesom\) \{ seatBroom\(v, v\.mountBesom\);/);
  assert.match(main, /if \(v\.otherBesom\) seatBroom\(v, v\.otherBesom\);/);
  assert.match(main, /if \(r\.broom\) \{ seatBroom\(v, r\.broom\);/);
});
