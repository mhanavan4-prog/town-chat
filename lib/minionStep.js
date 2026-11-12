// How a summoned minion moves where there is rock. Underground the walls of the
// dungeon or Delve floor (data/dungeonLayouts.js) are as solid to it as to its
// mistress: it takes each axis of its step only where there is no wall, so it
// slides along a wall face toward a doorway instead of walking through.
const { DUNGEON_LAYOUTS } = require('../data/dungeonLayouts');

const MINION_R = 16;            // how near the rock its middle may come
const STUCK_MS = 1200;          // held this long, it gives up what it was after
const REJOIN_DIST = 150;        // …and if its mistress is further off than this, it comes up beside her

// The walls of the room a minion is in, or null above ground.
function wallsFor(room) {
  if (typeof room !== 'string' || !room.startsWith('dungeon_')) return null;
  const m = /^dungeon_t([1-4])$/.exec(room);
  const L = DUNGEON_LAYOUTS[m ? +m[1] : 5];
  return L ? L.walls : null;
}
function blocked(walls, x, y) {
  for (const w of walls) if (x > w.x - MINION_R && x < w.x + w.w + MINION_R && y > w.y - MINION_R && y < w.y + w.h + MINION_R) return true;
  return false;
}
// Move m by (vx, vy) for dt. Returns true if it got anywhere. A minion that is
// somehow already in the rock is let walk out of it.
function step(m, vx, vy, dt, walls) {
  const nx = m.x + vx * dt, ny = m.y + vy * dt;
  if (!walls) { m.x = nx; m.y = ny; return true; }
  const inRock = blocked(walls, m.x, m.y);
  let moved = false;
  if (inRock || !blocked(walls, nx, m.y)) { if (nx !== m.x) moved = true; m.x = nx; }
  if (inRock || !blocked(walls, m.x, ny)) { if (ny !== m.y) moved = true; m.y = ny; }
  return moved;
}
module.exports = { wallsFor, blocked, step, MINION_R, STUCK_MS, REJOIN_DIST };
