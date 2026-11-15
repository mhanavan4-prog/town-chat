// A blow of my own on a foe shows its number on the foe and floats it away from me (asked for after two fights in
// which no hit was landing: the numbers existed, but started at the foe's feet and only rose).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const drift = new Function(src.slice(src.indexOf('function myDmgDrift('), src.indexOf('function spawnMyDmgNum(')) + '\nreturn myDmgDrift;')();

test('the number floats to the side away from me, and always upward', () => {
  const right = drift(200, 400, 300, 400), left = drift(300, 400, 200, 400), above = drift(200, 400, 200, 300), below = drift(200, 300, 200, 400);
  assert.ok(right.dx > 30 && left.dx < -30);
  for (const d of [right, left, above, below]) assert.ok(d.dy < -20, JSON.stringify(d));
  assert.deepStrictEqual(drift(200, 400, 202, 401), { dx: 0, dy: -66 }, 'on top of me: straight up');
});

test('my blows on a foe use it; other people\'s blows and blows on players keep the plain rising number', () => {
  const h = src.slice(src.indexOf("if (msg.type === 'hit_fx') {"), src.indexOf("if (msg.type === 'streak') {"));
  assert.match(h, /if \(msg\.casterId === myId && msg\.targetType !== 'player'\) spawnMyDmgNum\(msg\.targetType, msg\.targetId, msg\.dmg, !!msg\.dead\);/);
  assert.match(h, /else if \(s && s\.visible\) spawnDmgNum\(s\.x, s\.y, msg\.dmg, msg\.dead \? 'kill' : ''\);/);
});

test('it starts on the body, and still shows when the foe is off the screen', () => {
  const fn = src.slice(src.indexOf('function spawnMyDmgNum('), src.indexOf('function screenPosForTarget('));
  assert.match(fn, /worldToScreen\(mp\.x, groundY \+ 62, mp\.z\)/);
  assert.match(fn, /if \(!s \|\| !s\.visible .*\) s = \{ x: W \/ 2, y: H \* 0\.36 \};/);
  assert.match(fn, /setProperty\('--dx', d\.dx \+ 'px'\)/);
  assert.match(fn, /animationend/);
});

test('the style: a little larger, warm, drifting along the given offset, gold for a kill', () => {
  assert.match(html, /\.dmgNum\.mine \{[^}]*animation:dmgAway 1\.05s/);
  assert.match(html, /@keyframes dmgAway \{[\s\S]*var\(--dx,0px\)[\s\S]*var\(--dy,-40px\)/);
  assert.match(html, /\.dmgNum\.mine\.kill \{ color:#ffd24a;/);
});

test('every kind of foe has a place on the screen to put it', () => {
  const fn = src.slice(src.indexOf('function mobRenderPos('), src.indexOf('function mobRenderPos(') + 700);
  for (const k of ['animal:', 'mob:', 'animal2:', 'mob2:', 'mob3:', 'dungeon:', 'ember_mob:', 'crypt_mob:', "'world_boss'"]) assert.ok(fn.includes(k), k);
});
