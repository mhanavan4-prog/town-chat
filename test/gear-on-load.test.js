// Your own worn gear is drawn in its models as they arrive, not only after the pack is opened.
// (Other players are redrawn by the state stream; you are not, so the redraw has to hang off the asset loader.)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const main = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');

test('worn gear is redrawn as each model lands and when loading settles', () => {
  assert.match(main, /function redrawWornGear\(\) \{ for \(const id in players\) if \(visuals\[id\]\) applyEquipVisual\(id, players\[id\]\); \}/);
  assert.match(main, /KK\.onAssetLoad\(redrawWornGear\)/);
  assert.match(main, /KK\.promise\.then\(redrawWornGear\)/);
  assert.match(main, /KK\.onGear\(redrawWornGear\)/);
});

test('a stand-in drawn before its model came is swapped for the model on the next redraw', () => {
  const at = main.indexOf('function _reattachMesh(');
  const body = main.slice(at, at + 700);
  assert.match(body, /const stale = .*!v\[meshKey\]\.userData\.gear.*KK\.has\('gear_' \+ itemId\)/);
  assert.match(body, /const changed = .*\|\| stale/);
});

test('fireflies are round and capped in size', () => {
  assert.match(main, /gl_PointSize = clamp\(gl_PointSize, 1\.5, 9\.0\)/);
  assert.match(main, /firefly-round/);
});
