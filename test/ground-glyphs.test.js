// The Wilds' ground glyphs burn (client/ground-glyphs.js), and the minster stands on its ground (client/minster-light.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('a glyph shows fully by night and only faintly by day', async () => {
  const { glyphShow, GLYPH_DAY } = await import('../client/ground-glyphs.js');
  assert.strictEqual(glyphShow(0), 1);
  assert.strictEqual(glyphShow(1), GLYPH_DAY);
  assert.ok(GLYPH_DAY > 0.2 && GLYPH_DAY < 0.6, 'seen by day, but not as a neon sign');
  assert.ok(glyphShow(0.5) > GLYPH_DAY && glyphShow(0.5) < 1);
  assert.strictEqual(glyphShow(undefined), GLYPH_DAY, 'no clock: treated as day');
});

test('motes thin out with the graphics tier, and the lowest has none', async () => {
  const { GLYPH_MOTES, raiseGlyphMotes } = await import('../client/ground-glyphs.js');
  assert.strictEqual(GLYPH_MOTES.low, 0);
  assert.ok(GLYPH_MOTES.medium < GLYPH_MOTES.high && GLYPH_MOTES.high <= 6);
  assert.strictEqual(raiseGlyphMotes({}, {}, [{ x: 0, y: 0, z: 0, r: 10, col: 0xffffff }], 'low'), null);
});

test('the burning line is one shared program, fed a seed, a clock and a strength', async () => {
  const { glyphFire } = await import('../client/ground-glyphs.js');
  const mat = {}; const u = glyphFire(mat, 3.5);
  assert.strictEqual(u.value.x, 3.5);
  assert.strictEqual(mat.customProgramCacheKey(), 'glyph-fire');
  const sh = { uniforms: {}, fragmentShader: 'void main() {\n#include <map_fragment>\n}' };
  mat.onBeforeCompile(sh);
  assert.strictEqual(sh.uniforms.uGlyph, u);
  assert.match(sh.fragmentShader, /uniform vec3 uGlyph;/);
  assert.match(sh.fragmentShader, /diffuseColor\.a = opacity \* \(gLine \+ gSpill\) \* uGlyph\.z;/);
});

test('the Wilds scene wires the fire and the motes, and the cut lies under the fire', () => {
  const w = read('client/wilds-scene.js'), t = read('client/textures.js'), m = read('client/main.js');
  assert.match(w, /const fire = glyphFire\(glowMat, /);
  assert.match(w, /raiseGlyphMotes\(THREE, scene, glyphMoteList, /);
  assert.match(m, /userData\.glyphMotes\(\)/);
  assert.match(w, /conformingDecal\(gx, gz, size \* 1\.3, rot, 0\.6\)/, 'the scorch plane is 1.3x the glow plane');
  assert.match(t, /const Rs = R \/ 1\.3;/, 'so its glyph is drawn that much smaller');
});

test('the yard edge is walked all the way round, facing outward', async () => {
  const { yardEdge, MINSTER_YARD: Y } = await import('../client/minster-light.js');
  const e = yardEdge();
  assert.ok(e.length > 80);
  for (const [x, y, nx, ny] of e) {
    assert.ok(Math.abs(Math.hypot(nx, ny) - 1) < 1e-9);
    assert.ok(Math.abs(x - Y.cx) <= Y.hx + 1e-9 && Math.abs(y - Y.cy) <= Y.hy + 1e-9);
    assert.ok((x - Y.cx) * nx + (y - Y.cy) * ny > 0, 'the normal points away from the yard');
  }
});

test('the minster is seated by its own ground line, at one unit to the model unit', () => {
  const s = read('client/ember-scene.js');
  assert.match(s, /inst\.scale\.setScalar\(EMBER_TOWN\.unit\); inst\.position\.y = 0;/);
  const l = read('client/minster-light.js');
  assert.match(l, /bankYard\(THREE, scene, at, unit\);/);
  assert.match(l, /field\.position\.set\(mid\.x, 2\.6, mid\.z\)/, 'the field light lies on the ground');
});
