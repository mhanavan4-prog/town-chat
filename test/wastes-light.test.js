// The Ember Wastes by night: glows with no speckle in them, the minster drawn as stone and lit to be steered by,
// and the March gate hung with a veil on both sides.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('the glow is built from numbers: white at the heart, nothing at the rim, and never greener than it is red', async () => {
  global.THREE = global.THREE || {};
  const { glowPixels } = await import('../client/textures.js');
  const N = 64, px = glowPixels(N), at = (x, y) => Array.from(px.slice((y * N + x) * 4, (y * N + x) * 4 + 4));
  assert.deepStrictEqual(at(32, 32), [255, 255, 255, 255]);
  assert.strictEqual(at(0, 0)[3], 0); assert.strictEqual(at(63, 32)[3], 0);
  let last = 255;
  for (let x = 32; x < 64; x++) { const a = at(x, 32)[3]; assert.ok(a <= last, 'alpha only falls away outward'); last = a; }
  for (let i = 0; i < px.length; i += 4) { assert.strictEqual(px[i], 255, 'red is full everywhere'); assert.ok(px[i + 1] <= 255 && px[i + 1] >= 200 && px[i + 2] <= px[i + 1], 'warm, never green'); }
  assert.deepStrictEqual(Array.from(glowPixels(N)), Array.from(px), 'the same every time');
  const t = read('client/textures.js');
  assert.match(t, /_glowTexCache = new THREE\.DataTexture\(glowPixels\(N\), N, N, THREE\.RGBAFormat\);/);
});

test('the minster: stone in courses, no hatching, and lights to steer by', async () => {
  const m = await import('../client/minster-light.js');
  assert.deepStrictEqual(m.MINSTER_LIGHTS, { low: 1, medium: 3, high: 5 });
  const F = m.MINSTER_FLAMES;
  assert.ok(F.belfry[2] > 5, 'the lantern is up in the belfry');
  assert.strictEqual(F.nave.length, 8); assert.ok(F.nave.every(([x, y]) => Math.abs(x) < 3 && Math.abs(y) < 1.4), 'the candles are inside the nave');
  assert.ok(F.altar.every(([x]) => x > 2.38 && x < 2.88), 'and two stand on the altar');
  const src = read('client/minster-light.js');
  assert.match(src, /o\.receiveShadow = false;/, 'the hatched moire on its walls');
  assert.match(src, /customProgramCacheKey = \(\) => 'minster-stone'/);
  assert.match(src, /fog: !far/, 'the belfry glow shows through the haze');
  const sc = read('client/ember-scene.js');
  assert.match(sc, /scene\.userData\.minsterTick = dressMinster\(THREE, scene, g, at,/);
  assert.match(sc, /\[2\.38, -0\.6, 2\.88, 0\.6\],\s+\/\/ the altar/);
  assert.match(read('client/main.js'), /emberScene\.userData\.minsterTick\(performance\.now\(\) \/ 1000\)/);
  const py = read('tools/models/build_home.py');
  for (const k of ['MIN_CANDLE', 'a lantern kept alight in the belfry', 'candle-stands down the nave', 'a dark plinth at the foot']) assert.ok(py.includes(k), k);
  // the model's places and the client's agree
  assert.match(py, /m\.add\(glowing\(box\(0\.34, 0\.34, 0\.42, MIN_FLAME, \(tx, 0, 5\.2\)\)\)\)/);
  assert.match(py, /for x in \(-2\.3, -1\.2, -0\.1, 1\.0, 2\.1\):/);
  assert.ok(fs.statSync(path.join(__dirname, '..', 'public/kk/home/minster.glb')).size > 200000, 'the rebuilt model is on disk');
});

test('the March gate has a veil on both sides, and whichever is on screen is ticked', async () => {
  const g = await import('../client/gate-veil.js');
  assert.ok(g.GATE_SPARKS >= 20 && g.GATE_SPARKS <= 60);
  assert.match(read('client/wilds-scene.js'), /scene\.userData\.gateTick = hangGateVeil\(THREE, scene, \{ x: G\.x, y: H\(G\.x, G\.y\), z: G\.y \}, \{ tone: 'ember'/);
  assert.match(read('client/ember-scene.js'), /scene\.userData\.gateTick = hangGateVeil\(THREE, scene, \{ x: MARCH_GATE\.x, y: 0, z: MARCH_GATE\.y \}, \{ tone: 'green'/);
  assert.match(read('client/main.js'), /activeScene\.userData\.gateTick\(performance\.now\(\) \/ 1000\)/);
});
