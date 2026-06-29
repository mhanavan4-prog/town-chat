// Standalone re-check of the pure geometry functions used in public/client.js
// (buildWalls / rectOverlap / collides / roomAt). Copied verbatim so we can
// run them in plain Node without mocking the DOM/canvas/WebSocket globals
// that the rest of client.js touches.

const world = {
  width: 1600, height: 1100, doorWidth: 64, wallThickness: 14,
  buildings: [{ id: 'cafe', name: 'Cafe', x: 180, y: 190, w: 230, h: 160 }]
};

function buildWalls(w) {
  const t = w.wallThickness, dw = w.doorWidth;
  const list = [];
  for (const b of w.buildings) {
    const doorStart = b.x + (b.w - dw) / 2;
    const doorEnd = doorStart + dw;
    list.push({ x: b.x, y: b.y, w: b.w, h: t });
    list.push({ x: b.x, y: b.y, w: t, h: b.h });
    list.push({ x: b.x + b.w - t, y: b.y, w: t, h: b.h });
    list.push({ x: b.x, y: b.y + b.h - t, w: doorStart - b.x, h: t });
    list.push({ x: doorEnd, y: b.y + b.h - t, w: (b.x + b.w) - doorEnd, h: t });
  }
  return list;
}
function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
const PLAYER_R = 14;
function collides(walls, x, y) {
  for (const wall of walls) {
    if (rectOverlap(x - PLAYER_R, y - PLAYER_R, PLAYER_R*2, PLAYER_R*2, wall.x, wall.y, wall.w, wall.h)) return true;
  }
  return false;
}
function roomAt(w, x, y) {
  for (const b of w.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return 'outside';
}

let pass=0, fail=0;
function check(name, cond){ if(cond){pass++;console.log('PASS -',name);} else {fail++;console.log('FAIL -',name);} }

const walls = buildWalls(world);
const b = world.buildings[0];
const doorCenterX = b.x + b.w/2;
const doorY = b.y + b.h - 5; // just inside the bottom wall band

check('door gap is walkable (no collision at door center)', !collides(walls, doorCenterX, doorY));
check('bottom-left wall segment blocks movement (away from door)', collides(walls, b.x + 5, doorY));
check('bottom-right wall segment blocks movement (away from door)', collides(walls, b.x + b.w - 5, doorY));
check('top wall blocks movement', collides(walls, b.x + b.w/2, b.y + 2));
check('left wall blocks movement', collides(walls, b.x + 2, b.y + b.h/2));
check('right wall blocks movement', collides(walls, b.x + b.w - 2, b.y + b.h/2));
check('open ground far from any building has no collision', !collides(walls, 900, 900));
check('inside the building (not on a wall) has no collision', !collides(walls, b.x + b.w/2, b.y + b.h/2));

check('center of building reports its room id', roomAt(world, b.x + b.w/2, b.y + b.h/2) === 'cafe');
check('just outside the building reports outside', roomAt(world, b.x - 5, b.y + b.h/2) === 'outside');
check('walking through the door transitions room (just past doorway, inside)', roomAt(world, doorCenterX, b.y + b.h - 2) === 'cafe');
check('walking through the door transitions room (just past doorway, outside)', roomAt(world, doorCenterX, b.y + b.h + 2) === 'outside');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
