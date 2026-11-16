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
  assert.match(server, /mounted: besomMount\.seenAt\(p\) \|\| undefined,/);
  assert.match(server, /if \(msg\.type === 'besom_alt'\) \{ besomMount\.altitude\(player, msg\.alt\); return; \}/);
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

test('she can take it up, as high as the top and no lower than the hover, and others are told how high', () => {
  const { m } = make();
  const w = witch();
  assert.strictEqual(m.altitude(w, 500), false, 'not while on foot');
  m.mount(w, true);
  assert.strictEqual(m.seenAt(w), m.MOUNT.hover);
  assert.ok(m.altitude(w, 640)); assert.strictEqual(m.seenAt(w), 640);
  m.altitude(w, 99999); assert.strictEqual(w.besomAlt, m.MOUNT.top);
  m.altitude(w, -50); assert.strictEqual(w.besomAlt, m.MOUNT.hover);
  assert.strictEqual(m.altitude(w, 'up'), false);
  m.dismount(w, 'hit'); assert.strictEqual(w.besomAlt, 0); assert.strictEqual(m.seenAt(w), false);
  assert.ok(m.MOUNT.top > 980 + 200, 'the top is clear above the cloud layer (620 to 980)');
  assert.ok(m.MOUNT.clear > 200 && m.MOUNT.clear < m.MOUNT.top);
});

test('over the roofs nothing on the ground stops her, and her body is not put at infinity', async () => {
  const { default: createCollision } = await import('../client/collision.js');
  const c = createCollision({ getWorld: () => ({ buildings: [] }), getWalls: () => [{ x: 0, y: 0, w: 100, h: 100 }, { x: 200, y: 0, w: 50, h: 50, top: 40 }], getDungeonLore: () => null, getDelveState: () => null });
  assert.strictEqual(c.collides(50, 50, 0), true);
  assert.strictEqual(c.collides(50, 50, 200), true, 'a wall with no top stops her at any ordinary height');
  assert.strictEqual(c.collides(50, 50, Infinity), false);
  const main = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');
  assert.match(main, /function myFeet\(\) \{ return myPerch\.feet\(jumpActive, jumpT, myFeatherMult\(\)\); \}/);
  assert.match(main, /function myClearance\(\) \{ if \(besomRide\.on\) return besomOverAll\(\) \? Infinity : besomRide\.alt; return myFeet\(\); \}/);
  assert.match(main, /let room = besomOverAll\(\) \? 'outside' : roomAt\(me\.x, me\.y\);/);
  assert.match(main, /const blockedX = !besomOverAll\(\) && isLockedRoom/);
});

test('Space climbs and Shift sinks, a phone has its own pair, and the sky goes up with her but the clouds stay', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const dn = fs.readFileSync(path.join(__dirname, '..', 'client', 'day-night.js'), 'utf8');
  assert.match(main, /if \(e\.key === ' ' && besomRide\.on\) \{ besomRide\.up = true;/);
  assert.match(main, /if \(e\.key === 'Shift' && besomRide\.on\) besomRide\.down = true;/);
  assert.match(html, /id="besomPads" class="hidden"><button id="besomUp"/);
  assert.match(main, /st\.skyGroup\.position\.y = Math\.max\(0, activeCamera\.position\.y - 250\);/);
  assert.match(main, /c\.y - st\.skyGroup\.position\.y/);
  assert.match(dn, /const ay = anchor \? Math\.max\(0, anchor\.y - 250\) : 0;/);
});

test('the clouds have their own place over the land, and do not follow her about', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');
  assert.match(main, /wx: sp\.position\.x, wz: sp\.position\.z \}/);
  assert.match(main, /c\.sp\.position\.set\(cloudWrap\(c\.wx - st\.skyGroup\.position\.x\), c\.y - st\.skyGroup\.position\.y, cloudWrap\(c\.wz - st\.skyGroup\.position\.z\)\);/);
  const m = main.match(/const cloudWrap = (\(d\) => [^;]+);/);
  const wrap = new Function('CLOUD_SPAN', 'return ' + m[1])(4800);
  assert.strictEqual(wrap(0), 0); assert.strictEqual(wrap(2500), -2300); assert.strictEqual(wrap(-2500), 2300); assert.strictEqual(wrap(4800 * 3 + 10), 10);
});
