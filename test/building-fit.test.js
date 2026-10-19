'use strict';
// Building collider fit (client/main.js: fitBuildingFootprint + the south-door
// wall cut). A KayKit building model is scaled uniformly to the geometric mean
// of its data footprint, so on a non-square footprint it is narrower ACROSS the
// door and (for the castle models) DEEPER front-to-back than the rect, then
// flushed to the door wall — its rear overhangs the footprint. The collider must
// track the MODEL box, not the data rect, on both axes: width centered on the
// footprint, depth spanning the model's real front-to-back extent (so the rear
// overhang is walled and you can't walk in the back). Mirrors the client logic.
const test = require('node:test');
const assert = require('node:assert');

// — mirror of client fitBuildingFootprint —
function fitBuildingFootprint(b, box, side) {
  if (!box) return { x: b.x, y: b.y, w: b.w, h: b.h };
  const s = side || (b && b.door) || 'south';
  const cx = b.x + b.w / 2, cz = b.y + b.h / 2;
  const doorAxisZ = (s === 'south' || s === 'north');
  const modelW = box.maxx - box.minx;
  const modelD = box.maxz - box.minz;
  let x0, z0, w, h;
  if (doorAxisZ) {
    z0 = box.minz; h = modelD;
    w = modelW; x0 = cx - w / 2;
  } else {
    x0 = box.minx; w = modelW;
    h = modelD; z0 = cz - h / 2;
  }
  if (w < 40 || h < 40) return { x: b.x, y: b.y, w: b.w, h: b.h };
  return { x: x0, y: z0, w, h };
}
// — mirror of buildWallsForOne, south-door case (t=14, dw=100) —
function southWalls(b, t = 14, dw = 100) {
  const ds = b.x + (b.w - dw) / 2, de = ds + dw;
  return [
    { x: b.x, y: b.y, w: b.w, h: t },                        // north edge
    { x: b.x, y: b.y, w: t, h: b.h },                        // west edge
    { x: b.x + b.w - t, y: b.y, w: t, h: b.h },              // east edge
    { x: b.x, y: b.y + b.h - t, w: ds - b.x, h: t },         // south, west of door
    { x: de, y: b.y + b.h - t, w: (b.x + b.w) - de, h: t },  // south, east of door
  ];
}
const R = 14;
const over = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
const blocked = (walls, px, py) => walls.some((w) => over(px - R, py - R, R * 2, R * 2, w.x, w.y, w.w, w.h));

// Town Hall data footprint + its measured castle model box: 379 wide (narrower
// than the 480 rect) and 433 DEEP (deeper than the 290 rect), flushed to the
// south door wall (~y412) so the rear overhangs ~130px NORTH of the rect (minz
// = -21, north of the rect's y=110).
const HALL = { x: 1360, y: 110, w: 480, h: 290, door: 'south' };
const CASTLE_BOX = { minx: 1410.3, minz: -21, maxx: 1789.7, maxz: 412 };

test('fit shrinks the hall collider to the visible castle width, centered', () => {
  const f = fitBuildingFootprint(HALL, CASTLE_BOX);
  assert.ok(f.w > 370 && f.w < 385, 'width ~379 (was 480): ' + f.w);
  assert.ok(Math.abs((f.x + f.w / 2) - 1600) < 1, 'centered on the footprint: ' + (f.x + f.w / 2));
});

test('fit covers the model’s real depth, including the rear overhang (no walk-in)', () => {
  const f = fitBuildingFootprint(HALL, CASTLE_BOX);
  // Depth spans the MODEL, not the data rect — this is the walk-into-the-back fix.
  assert.equal(f.y, -21, 'north edge reaches the model rear (not clamped to the rect’s 110)');
  assert.ok(Math.abs((f.y + f.h) - 412) < 1, 'south edge reaches the model front (~412)');
  const fit = southWalls(f);
  // A player approaching from the north is now stopped at the model’s rear wall
  // (~y-21). Under the old data-rect clamp the rear wall sat at y=110, leaving a
  // ~130px band of visible castle open — you walked in the back.
  assert.equal(blocked(fit, 1500, -14), true, 'the rear wall now sits at the model’s back edge');
  // Prove the regression: the old clamped-to-rect fit left that same spot open.
  const clampedOld = southWalls({ x: f.x, y: 110, w: f.w, h: 290 });
  assert.equal(blocked(clampedOld, 1500, -14), false, 'the old clamp left the rear overhang walkable');
});

test('the open band beside the castle is walkable, the front is solid, the door is open', () => {
  const data = southWalls(HALL);
  const fit = southWalls(fitBuildingFootprint(HALL, CASTLE_BOX));
  // the ~50px strip west of the castle (x<1410) was walled by the full-rect
  // collider ("invisible wall"); now it's open grass. y=405 sits in the model's
  // south-wall band (~398–412).
  for (const px of [1365, 1380, 1395]) {
    assert.equal(blocked(data, px, 405), true, 'was walled before the fit at x=' + px);
    assert.equal(blocked(fit, px, 405), false, 'walkable after the fit at x=' + px);
  }
  assert.equal(blocked(fit, 1500, 405), true, 'castle front (west of the door) still solid');
  assert.equal(blocked(fit, 1600, 405), false, 'door gap (centered on the model) still open');
});

test('a laterally-shifted model box still yields a centered collider (no side walk-in)', () => {
  // kkAutoAlign can shove a model ~80px sideways to centre its steps; the collider
  // must not follow that offset, or one side opens into a buried wall.
  const SHIFTED = { minx: 1330.3, minz: -21, maxx: 1709.7, maxz: 412 }; // 379 wide, centre 1520 (−80)
  const f = fitBuildingFootprint(HALL, SHIFTED, 'south');
  assert.ok(Math.abs((f.x + f.w / 2) - 1600) < 1, 'collider stays centred on the footprint: ' + (f.x + f.w / 2));
  assert.ok(f.w > 370 && f.w < 385, 'width still tracks the model (~379): ' + f.w);
});

test('room-entry keys off the fitted footprint, not the data-rect margins', () => {
  // The bug behind "I ended up in the building": entry fires when roomAt() says
  // you're inside a building, and roomAt used the full data rect. With the
  // collider shrunk to the model, the data rect's side strips are unwalled grass
  // — stepping onto them teleported you inside. roomAt must use the fitted rect.
  const b = { ...HALL, _fit: fitBuildingFootprint(HALL, CASTLE_BOX) };
  const roomAt = (x, y) => {
    const f = b._fit || b;
    return (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) ? 'hall' : 'outside';
  };
  assert.equal(roomAt(1385, 200), 'outside', 'west grass strip is NOT an entry zone (no auto-enter)');
  assert.equal(roomAt(1820, 200), 'outside', 'east grass strip is NOT an entry zone');
  assert.equal(roomAt(1600, 390), 'hall', 'the doorway still enters');
  // and the raw data rect (no _fit) would have wrongly entered from the strip
  const rawRoomAt = (x, y) => (x >= HALL.x && x <= HALL.x + HALL.w && y >= HALL.y && y <= HALL.y + HALL.h) ? 'hall' : 'outside';
  assert.equal(rawRoomAt(1385, 200), 'hall', 'the old data-rect entry fired from the strip (the bug)');
});

test('a missing or degenerate model box leaves the data footprint unchanged', () => {
  assert.deepEqual(fitBuildingFootprint(HALL, null), { x: 1360, y: 110, w: 480, h: 290 });
  const tiny = fitBuildingFootprint(HALL, { minx: 1600, minz: 250, maxx: 1610, maxz: 260 });
  assert.deepEqual(tiny, { x: 1360, y: 110, w: 480, h: 290 }, 'degenerate fit is rejected');
});
