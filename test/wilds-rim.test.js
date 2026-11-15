// The rim of the Wilds (client/wilds-rim.js): the ground climbs into fell all round the map so the border is not the
// edge of the world; the far grass stops at the edge; and the cairns stand on the ground, not at height zero.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const rim = read('client/wilds-rim.js'), scene = read('client/wilds-scene.js'), ground = read('client/wilds-ground.js');
const R = new Function(rim.replace(/export const /g, 'const ').replace(/export function /g, 'function ') + '\nreturn { WR_ROWS, rimPerimeter, rimGeometry };')();

test('the perimeter goes all the way round, turning each corner in steps', () => {
  const per = R.rimPerimeter(10000, 8000);
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const [x, z, nx, nz] of per) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); assert.ok(Math.abs(Math.hypot(nx, nz) - 1) < 1e-9); }
  assert.deepStrictEqual([minX, maxX, minZ, maxZ], [-100, 10100, -100, 8100], 'it runs along the edge of the ground, which is 100 past the world');
  for (const [x, z, nx, nz] of per) assert.ok((x + nx * 500 < -100) || (x + nx * 500 > 10100) || (z + nz * 500 < -100) || (z + nz * 500 > 8100), 'every way out points away from the world');
  for (const c of [[10100, -100], [10100, 8100], [-100, 8100], [-100, -100]]) assert.ok(per.filter(([x, z]) => x === c[0] && z === c[1]).length >= 6, 'corner turned in steps');
});

test('it starts under the ground\'s own edge and only climbs, to well above a player\'s eye', () => {
  assert.ok(R.WR_ROWS[0][0] < 0 && R.WR_ROWS[0][1] < 0, 'the first row is tucked in under the ground, so no gap shows');
  for (let i = 1; i < R.WR_ROWS.length; i++) assert.ok(R.WR_ROWS[i][0] > R.WR_ROWS[i - 1][0] && R.WR_ROWS[i][1] > R.WR_ROWS[i - 1][1]);
  assert.ok(R.WR_ROWS[R.WR_ROWS.length - 1][1] > 600 && R.WR_ROWS[R.WR_ROWS.length - 1][0] > 2000);
});

test('the geometry is a closed band on the ground it is given', () => {
  const asked = [];
  const g = R.rimGeometry(10000, 8000, (x, z) => { asked.push([x, z]); return 40; });
  assert.ok(asked.every(([x, z]) => x >= 0 && x <= 10000 && z >= 0 && z <= 8000), 'the ground is only asked inside the world');
  assert.strictEqual(g.positions.length, g.around * g.rows * 3);
  assert.strictEqual(g.indices.length, g.around * (g.rows - 1) * 6, 'closed: the last column joins the first');
  assert.ok(Math.max(...g.indices) < g.positions.length / 3);
  assert.strictEqual(g.positions[1], 40 + R.WR_ROWS[0][1], 'the foot sits on the ground\'s height');
  let top = -1e9; for (let i = 1; i < g.positions.length; i += 3) top = Math.max(top, g.positions[i]);
  assert.ok(top > 500);
  assert.deepStrictEqual(R.rimGeometry(10000, 8000, () => 40).positions, g.positions, 'the same every time');
});

test('the scene builds it on every tier, and a failure leaves the Wilds standing', () => {
  assert.match(scene, /try \{ buildWildsRim\(THREE, scene, w2, wildsHeightAt\); \} catch \(e\) \{ console\.error\('wilds rim: none', e\); \}/);
  assert.match(rim, /noShadowCaster = true/);
});

test('nothing grows past the edge of the ground', () => {
  assert.match(ground, /if \(world && \(x < -60 \|\| z < -60 \|\| x > world\.width \+ 60 \|\| z > world\.height \+ 60\)\) \{ st\.cells\.set\(key, null\); return null; \}/);
  assert.match(scene, /createWildsGrass\(THREE, scene, \{[^}]*world: w2 \}\)/);
});

test('cairns, caches and balefires stand on the ground where they are', () => {
  assert.match(scene, /g\.position\.set\(c\.x, wildsHeightAt\(c\.x, c\.y\) - 2, c\.y\)/);
  assert.match(scene, /const fy = wildsHeightAt\(f\.x, f\.y\);\s*if \(cairn\) \{ cairn\.position\.set\(f\.x, fy - 2, f\.y\);/);
  assert.match(scene, /g\.position\.set\(f\.x, fy \+ 8, f\.y\);/);
});
