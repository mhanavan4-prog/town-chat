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
  assert.match(server, /if \(p\.mounted && !besomMount\.outOfReach\(p\)\) besomMount\.dismount\(p, 'hit'\);/);
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
  assert.match(main, /function myClearance\(\) \{ return besomRide\.on \? besomRide\.alt : myFeet\(\); \}/);
  assert.match(main, /let room = \(\(besomRide\.on && besomOver\(me\.x, me\.y\)\) \|\| besomRoost\) \? 'outside' : roomAt\(me\.x, me\.y\);/);
  assert.match(main, /const blockedX = !besomOver\(nx, me\.y\) && isLockedRoom/);
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

test('she can come down on top of a thing: its real top is found by looking down, and she may sit there', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');
  assert.match(main, /function besomTopAt\(x, y\) \{/);
  assert.match(main, /_roofRay\.intersectObjects\(solids, false\)\[0\]/);
  assert.match(main, /o\.isMesh && !o\.isSkinnedMesh && o\.material && o\.material\.depthWrite !== false && !o\.material\.transparent/, 'characters, glows and the sky are not roofs');
  assert.match(main, /return top > 0 \? top \+ BESOM_SEAT : besomRide\.clear;/, 'nothing seen there: the old rule; taller than her ceiling: a wall');
  assert.match(main, /return besomFootprint\(me\.x, me\.y\) \? Math\.min\(besomRide\.top, besomNeedAt\(me\.x, me\.y\)\) : besomRide\.hover;/);
  assert.match(main, /const besomLookFrom = \(\) => 3200;/, 'looked for from above the tallest spire');
  assert.match(main, /if \(besomOver\(x, y\)\) return false;\n  return besomRide\.alt > besomRide\.hover \+ 10 \? besomFootprint\(x, y\) : collides\(x, y, 0\);/, 'off the ground a building\'s inside bars her as a wall does; at the hover she may ride in at a door');
  assert.match(main, /const stuck = !besomRide\.on && barredAt\(me\.x, me\.y, ft\);/, 'no walking out of colliders while riding');
  assert.match(main, /if \(top > 0\) \{ besomRoost = \{ x: me\.x, y: me\.y, top, from: Math\.max\(top, v\._fallY\) \}; if \(ws && ws\.readyState === WebSocket\.OPEN\) ws\.send\(JSON\.stringify\(\{ type: 'besom_roost', top: Math\.round\(top\) \}\)\); \}/, 'off it over a roof from any height: onto the roof, and others are told');
  assert.match(main, /else \{ const o = besomOpenNear\(me\.x, me\.y\); me\.x = o\.x; me\.y = o\.y; \}/, 'over a building with no roof to be seen: the open ground nearest');
  assert.match(main, /const o = besomOpenNear\(me\.x, me\.y\); me\.x = o\.x; me\.y = o\.y;\n        v\._fallY = besomRoost\.top; besomRoost = null;/, 'walking off a roof: down beside it');
  assert.match(main, /if \(!me \|\| broomRide \|\| besomAloft\(\)\) return;/, 'no reaching the ground from up there');
});

test('sitting on a roof she got off onto, others are told how high, until she moves or mounts', () => {
  const { m } = make();
  const w = witch({ x: 100, y: 100 });
  assert.ok(m.roost(w, 453.4)); assert.strictEqual(m.roostSeen(w), 453);
  m.roost(w, 99999); assert.strictEqual(w.roostY, m.MOUNT.top);
  m.unroost(w); assert.strictEqual(m.roostSeen(w), false);
  m.roost(w, 300); m.mount(w, true); assert.strictEqual(m.roostSeen(w), false, 'mounting ends it');
  m.mount(w, false);
  assert.ok(!m.roost(witch({ level: 5 }), 300), 'not for those who cannot ride');
  assert.ok(!m.roost(witch({ room: 'cafe' }), 300), 'not indoors');
  assert.ok(!m.roost(w, 0)); assert.ok(!m.roost(w, 'high'));
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /roost: besomMount\.roostSeen\(p\) \|\| undefined,/);
  assert.match(server, /if \(player\.roostY && player\.roostAt && \(Math\.abs\(x - player\.roostAt\.x\) > 1 \|\| Math\.abs\(y - player\.roostAt\.y\) > 1\)\) besomMount\.unroost\(player\);/);
});

test('the besom and a jump are heard: getting off, the wind up high, and feet coming down', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'audio', 'sfx.manifest.json'), 'utf8'));
  for (const id of ['jump_land', 'besom_off', 'besom_wind']) { const e = manifest.sfx.find((x) => x.id === id); assert.ok(e && /No music|no music/.test(e.prompt), id); }
  assert.strictEqual(manifest.sfx.find((x) => x.id === 'besom_wind').loop, true);
  assert.match(main, /playSfx\('jump_land', 0\.5\)/);
  assert.match(main, /playSfx\('besom_off', 0\.7\)/);
  assert.match(main, /startSfxLoop\('besom_wind', vol, 1\.5\)/);
  assert.match(main, /SFX_STAND_IN = \{ jump_land: 'footstep', besom_off: 'footstep',/);
});

test('riding high enough, nothing on the ground can reach her: no creature, no blow, no knocking off', () => {
  const { m } = make();
  const w = witch();
  assert.strictEqual(m.outOfReach(w), false, 'on foot');
  m.mount(w, true);
  assert.strictEqual(m.outOfReach(w), false, 'at the hover a dog can have her');
  m.altitude(w, m.MOUNT.safe - 1); assert.strictEqual(m.outOfReach(w), false);
  m.altitude(w, m.MOUNT.safe); assert.strictEqual(m.outOfReach(w), true);
  w.room = 'cafe'; assert.strictEqual(m.outOfReach(w), false, 'not riding there at all');
  w.room = 'outside'; m.dismount(w, 'fight'); assert.strictEqual(m.outOfReach(w), false, 'off the broom she can be reached again');
  assert.ok(m.MOUNT.safe > m.MOUNT.hover * 2 && m.MOUNT.safe < m.MOUNT.clear, 'above a creature\'s reach, below the roofs');
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /return \(p\.evasionUntil && p\.evasionUntil > Date\.now\(\)\) \|\| besomMount\.outOfReach\(p\);/, 'every creature and every blow asks isEvading');
  assert.match(server, /if \(besomMount\.outOfReach\(target\)\) return 0;/, 'and whatever was swung does no harm');
  assert.match(server, /if \(p\.mounted && !besomMount\.outOfReach\(p\)\) besomMount\.dismount\(p, 'hit'\);/, 'nor knocks her off');
  // every creature's aggro asks isEvading (the pools that can meet a rider out of doors)
  const asks = (server.match(/!isEvading\((nearestP|target)\)/g) || []).length;
  assert.ok(asks >= 6, 'creature pools asking isEvading: ' + asks);
});
