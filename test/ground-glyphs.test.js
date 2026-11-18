// The Wilds' ground glyphs burn (client/ground-glyphs.js), and the minster stands on its ground (client/minster-light.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('the light in a sign shows fully by night and hardly at all by day', async () => {
  const { glyphShow, GLYPH_DAY } = await import('../client/ground-glyphs.js');
  assert.strictEqual(glyphShow(0), 1);
  assert.strictEqual(glyphShow(1), GLYPH_DAY);
  assert.ok(GLYPH_DAY > 0 && GLYPH_DAY < 0.12, 'by day it is the chalk you see, not a light');
  assert.ok(glyphShow(0.5) > GLYPH_DAY && glyphShow(0.5) < 1);
  assert.strictEqual(glyphShow(undefined), GLYPH_DAY, 'no clock: treated as day');
});

test('motes thin out with the graphics tier, and the lowest has none', async () => {
  const { GLYPH_MOTES, raiseGlyphMotes } = await import('../client/ground-glyphs.js');
  assert.strictEqual(GLYPH_MOTES.low, 0);
  assert.ok(GLYPH_MOTES.medium < GLYPH_MOTES.high && GLYPH_MOTES.high <= 6);
  assert.strictEqual(raiseGlyphMotes({}, {}, [{ x: 0, y: 0, z: 0, r: 10, col: 0xffffff }], 'low'), null);
});

test('the Wilds scene cuts the signs into the turf, and feeds their light and motes', () => {
  const w = read('client/wilds-scene.js'), m = read('client/main.js'), t = read('client/textures.js');
  assert.match(w, /const turfDraw = buildTurfSigns\(THREE, scene, turfAtlas, turfGlyphs, groundAt, /);
  assert.match(w, /raiseGlyphMotes\(THREE, scene, glyphMoteList, /);
  assert.match(w, /turfDraw\.update\(t, show\);/);
  assert.match(m, /userData\.glyphMotes\(\)/);
  assert.doesNotMatch(t, /makeGroundSigilTextures/, 'the old canvas-drawn signs are gone');
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
