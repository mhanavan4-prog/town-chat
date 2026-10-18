'use strict';
// Building collider fit (client/main.js: fitBuildingFootprint + the south-door
// wall cut). A KayKit building model is scaled uniformly to the geometric mean
// of its data footprint, so for a non-square footprint the collider (full data
// rect) stuck out past the visible model as "invisible walls". The fit shrinks
// the collider to the model box. This locks the geometry that was hand-measured
// from building_castle_red.gltf for the Town Hall. Mirrors the client logic.
const test = require('node:test');
const assert = require('node:assert');

// — mirror of client fitBuildingFootprint —
function fitBuildingFootprint(b, box) {
  if (!box) return { x: b.x, y: b.y, w: b.w, h: b.h };
  const x0 = Math.max(b.x, box.minx), z0 = Math.max(b.y, box.minz);
  const x1 = Math.min(b.x + b.w, box.maxx), z1 = Math.min(b.y + b.h, box.maxz);
  const w = x1 - x0, h = z1 - z0;
  if (w < 40 || h < 40) return { x: b.x, y: b.y, w: b.w, h: b.h };
  return { x: x0, y: z0, w, h };
}
// — mirror of buildWallsForOne, south-door case (t=14, dw=100) —
function southWalls(b, t = 14, dw = 100) {
  const ds = b.x + (b.w - dw) / 2, de = ds + dw;
  return [
    { x: b.x, y: b.y, w: b.w, h: t },
    { x: b.x, y: b.y, w: t, h: b.h },
    { x: b.x + b.w - t, y: b.y, w: t, h: b.h },
    { x: b.x, y: b.y + b.h - t, w: ds - b.x, h: t },
    { x: de, y: b.y + b.h - t, w: (b.x + b.w) - de, h: t },
  ];
}
const R = 14;
const over = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
const blocked = (walls, px, py) => walls.some((w) => over(px - R, py - R, R * 2, R * 2, w.x, w.y, w.w, w.h));

// Town Hall data footprint + its measured castle model box (centered on the
// footprint, flushed to the south door wall ~y412; model = 379 wide x 433 deep).
const HALL = { x: 1360, y: 110, w: 480, h: 290, door: 'south' };
const CASTLE_BOX = { minx: 1410.3, minz: -21, maxx: 1789.7, maxz: 412 };

test('fit shrinks the hall collider to the visible castle width', () => {
  const f = fitBuildingFootprint(HALL, CASTLE_BOX);
  assert.ok(Math.abs(f.x - 1410.3) < 1, 'west edge moves in to the model: ' + f.x);
  assert.ok(f.w > 370 && f.w < 385, 'width ~379 (was 480): ' + f.w);
  assert.equal(f.y, 110, 'north clamped to the data rect');
  assert.equal(f.h, 290, 'depth unchanged (model is deeper, flushed south)');
});

test('the open band west of the castle becomes walkable, castle stays solid', () => {
  const data = southWalls(HALL);
  const fit = southWalls(fitBuildingFootprint(HALL, CASTLE_BOX));
  // the ~50px strip west of the castle (x<1410) looked like open grass but was
  // walled by the full-rect collider — that's the "invisible wall". (y=395 sits
  // squarely in the south-wall band, so a block there means you can't walk through.)
  for (const px of [1370, 1385, 1395]) {
    assert.equal(blocked(data, px, 395), true, 'was walled before the fit at x=' + px);
    assert.equal(blocked(fit, px, 395), false, 'walkable after the fit at x=' + px);
  }
  // the castle front itself still blocks you (x1500 is inside the model, west of the door)
  assert.equal(blocked(fit, 1500, 395), true, 'castle south wall still solid');
  // the door gap (centered on the model) is still passable
  assert.equal(blocked(fit, 1600, 395), false, 'door still open');
});

test('a missing or degenerate model box leaves the data footprint unchanged', () => {
  assert.deepEqual(fitBuildingFootprint(HALL, null), { x: 1360, y: 110, w: 480, h: 290 });
  const tiny = fitBuildingFootprint(HALL, { minx: 1600, minz: 250, maxx: 1610, maxz: 260 });
  assert.deepEqual(tiny, { x: 1360, y: 110, w: 480, h: 290 }, 'degenerate fit is rejected');
});
