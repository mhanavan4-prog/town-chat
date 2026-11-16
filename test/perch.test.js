// Standing on things (client/perch.js): a collider with a top is something to jump onto, not a wall.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('what can be stood on: anything a jump reaches', async () => {
  const { perchTop, PERCH_REACH } = await import('../client/perch.js');
  assert.strictEqual(perchTop(19), 19); assert.strictEqual(perchTop(PERCH_REACH), PERCH_REACH);
  assert.strictEqual(perchTop(PERCH_REACH + 1), 0, 'too tall: a wall');
  assert.strictEqual(perchTop(2), 0, 'too low to bother'); assert.strictEqual(perchTop(NaN), 0);
  assert.ok(PERCH_REACH < 34, 'a jump rises 34');
});

test('a jump onto a crate, a walk along it, and a fall off the edge', async () => {
  const { createPerch } = await import('../client/perch.js');
  const { default: createCollision } = await import('../client/collision.js');
  const crate = { x: 100, y: 0, w: 20, h: 20, top: 19 }, wall = { x: 200, y: 0, w: 20, h: 20 };
  const c = createCollision({ getWorld: () => ({ buildings: [] }), getWalls: () => [crate, wall], getDungeonLore: () => null, getDelveState: () => null });
  const P = createPerch({ jumpHeight: 34, jumpDuration: 0.45 });
  assert.ok(c.collides(90, 10, 0), 'on foot the crate is in the way');
  assert.ok(!c.collides(90, 10, 19), 'at its height it is not');
  assert.ok(c.collides(190, 10, 500), 'a thing with no top is a wall at any height');
  assert.strictEqual(c.perchAt(110, 10), 19); assert.strictEqual(c.perchAt(50, 10), 0); assert.strictEqual(c.perchAt(210, 10), 0);

  // walk at the crate, jump, keep walking: 200 units a second, 60 frames a second
  let x = 84, jumping = true, t = 0; P.takeoff();
  let blockedOnGround = c.collides(x + 4, 10, P.feet(false, 0));
  assert.ok(blockedOnGround);
  for (let i = 0; i < 60 && jumping; i++) {
    t += 1 / 60;
    if (!c.collides(x + 230 / 60, 10, P.feet(true, t))) x += 230 / 60; // at a run, without stopping
    if (t >= 0.45) { jumping = false; t = 0; }
    if (P.step(1 / 60, jumping, t, c.perchAt(x, 10))) { jumping = false; t = 0; }
  }
  for (let i = 0; i < 10; i++) P.step(1 / 60, false, 0, c.perchAt(x, 10));
  assert.strictEqual(P.feet(false, 0), 19, 'landed on it, at a run: ' + x);
  assert.ok(c.perchAt(x, 10) === 19, 'and still over it: ' + x);
  assert.ok(!c.collides(x, 10, P.feet(false, 0)), 'standing there is not being stuck');
  assert.strictEqual(c.resolveStuck(x, 10, null, P.feet(false, 0)), null, 'and nothing pushes me off');
  // a jump on top comes back down on top
  P.takeoff(); assert.ok(P.feet(true, 0.225) > 50); for (let i = 0; i < 30; i++) P.step(1 / 60, false, 0, c.perchAt(x, 10)); assert.strictEqual(P.feet(false, 0), 19);
  // walk off
  x = 160; let frames = 0;
  while (P.feet(false, 0) > 0 && frames < 100) { P.step(1 / 60, false, 0, c.perchAt(x, 10)); frames++; }
  assert.ok(frames > 1 && frames < 20, 'a short fall, not a snap: ' + frames);
  // a jump that does not reach comes down where it began
  const tall = { x: 300, y: 0, w: 20, h: 20, top: 60 };
  const c2 = createCollision({ getWorld: () => ({ buildings: [] }), getWalls: () => [tall], getDungeonLore: () => null, getDelveState: () => null });
  P.reset(); P.takeoff();
  assert.ok(c2.collides(290, 10, P.feet(true, 0.225)), 'the top of a jump is still under it');
});

test('the camera follows what is stood on, not the hop', async () => {
  const { createPerch } = await import('../client/perch.js');
  const P = createPerch({ jumpHeight: 34, jumpDuration: 0.45 });
  P.step(1 / 60, false, 0, 19); assert.strictEqual(P.standing(false), 19);
  P.takeoff(); assert.strictEqual(P.standing(true), 19, 'mid-jump it is still the crate'); assert.ok(P.feet(true, 0.2) > 40);
});

test('it is wired: movement asks where my feet are, everyone is drawn by the same rule, and things have tops', () => {
  const m = read('client/main.js');
  assert.match(m, /const stuck = !besomRide\.on && barredAt\(me\.x, me\.y, ft\);/);
  assert.match(m, /else if \(!barredAt\(nx, me\.y, ft\)\) \{ me\.x = nx; \}/);
  assert.match(m, /if \(!besomRide\.on\) return collides\(x, y, ft\);/, 'on foot, barredAt is the walls as ever');
  assert.match(m, /if \(myPerch\.step\(dt, jumpActive, jumpT, under, myFeatherMult\(\)\)\) \{ jumpActive = false; jumpT = 0; playSfx\('jump_land', 0\.5\); \}/);
  assert.match(m, /const top = c\.top != null \? c\.top : standTop\(group\);/, 'crates, barrels, benches');
  assert.match(m, /wildsCollide\(x, z, 6, standTop\(gs\)\)/, 'gravestones in the Wilds');
  assert.match(read('client/player-visuals.js'), /const jumpYOffset = id === getMyId\(\) \? getMyFeet\(\) : getPerchAt\(p\.x, p\.y\);/);
  assert.match(m, /const wall = \{ x: rx, y: rz, w: rw, h: rh \}, top = perchTop\(fb\.max\.y\);/, 'cottage furniture');
  assert.match(m, /_camPerch \+= \(myPerch\.standing\(jumpActive\) - _camPerch\) \* 0\.12;/, 'the camera rises with what she stands on');
  assert.match(m, /walls\.push\(\{ x: PRACTICE_SPOT\.x - 7, y: PRACTICE_SPOT\.y - 7, w: 14, h: 14 \}\);/, 'the scarecrow is solid');
  assert.match(read('client/town-scene.js'), /addSolid\(kkPlace\(scene, key, sx, sy, size, rot\), sx, sy, 7\);/, 'the town graveyard');
});
