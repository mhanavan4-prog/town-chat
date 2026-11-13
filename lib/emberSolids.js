'use strict';
// What stands solid in the Ember Wastes, for the server's creatures: the
// minster, Ashminster's houses, cross, well and barricades, and the witches'
// ring. The client builds the same walls for the player in
// client/ember-scene.js (ASH_SOLID, MINSTER_SOLID, the ring stones);
// test/ember-solids.test.js keeps the two in step.

const { EMBER_TOWN, ASH_PIECES } = require('../data/emberTown');
const { RING } = require('../data/witchRing');

const ASH_SOLID = { em_house_a: 0.4, em_house_b: 0.42, em_house_c: 0.36, em_ash_cross: 0.36, prop_well: 0.42, em_frith_cross: 0.18, em_barricade: 0 };
const MINSTER_SOLID = [
  [-3.0, -1.62, 3.0, -1.38],
  [-3.0, 1.38, 0.1, 1.62], [2.1, 1.38, 3.0, 1.62],
  [2.88, -1.5, 4.85, 1.5],
  [1.79, -2.85, 3.41, -1.5],
  [1.79, 1.5, 2.01, 2.75], [3.19, 1.5, 3.41, 2.75], [1.79, 2.59, 3.41, 2.81],
  [-5.5, -1.35, -3.0, 1.35],
  [-5.5, 2.0, -4.3, 3.0], [-4.5, 2.5, -3.6, 3.4], [-3.8, 2.9, -3.0, 3.8], [-2.8, 3.5, -1.3, 4.5],
  [-3.95, -2.35, -3.25, -1.65],
];

function minsterWalls() {
  const { x: cx, y: cy, unit: u, turn } = EMBER_TOWN, c = Math.cos(turn), s = Math.sin(turn);
  return MINSTER_SOLID.map(([x0, y0, x1, y1]) => {
    const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([mx, my]) => { const X = mx * u, Z = -my * u; return [cx + X * c + Z * s, cy - X * s + Z * c]; });
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  });
}

function buildWalls() {
  const walls = minsterWalls();
  for (const [key, x, y, turn, size] of ASH_PIECES) {
    const half = size * (ASH_SOLID[key] || 0);
    if (half) walls.push({ x: x - half, y: y - half, w: half * 2, h: half * 2 });
    else if (key === 'em_barricade') {
      const along = Math.abs(Math.cos(turn)) > 0.5;
      walls.push(along ? { x: x - size * 0.45, y: y - 40, w: size * 0.9, h: 80 } : { x: x - 40, y: y - size * 0.45, w: 80, h: size * 0.9 });
    }
  }
  walls.push({ x: RING.x - 40, y: RING.y - 40, w: 80, h: 80 });   // the elder in the middle
  for (let i = 0; i < RING.stones; i++) {
    const a = (i / RING.stones) * Math.PI * 2, sx = RING.x + Math.sin(a) * RING.stoneR, sy = RING.y - Math.cos(a) * RING.stoneR;
    walls.push({ x: sx - 40, y: sy - 40, w: 80, h: 80 });
  }
  return walls;
}

const WALLS = buildWalls();
// Only things near the town or the ring need the check at all.
const NEAR = [
  ...EMBER_TOWN.ground.map((g) => ({ x: g.x, y: g.y, r: g.r + 200 })),
  { x: RING.x, y: RING.y, r: RING.stoneR + 200 },
];

function wallAt(x, y, r = 22) {
  if (!NEAR.some((n) => Math.hypot(x - n.x, y - n.y) < n.r)) return null;
  return WALLS.find((w) => x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) || null;
}
const blocked = (x, y, r) => !!wallAt(x, y, r);

function axisMove(m, dx, dy, r) {
  let hit = false;
  if (dx && !blocked(m.x + dx, m.y, r)) m.x += dx; else if (dx) hit = true;
  if (dy && !blocked(m.x, m.y + dy, r)) m.y += dy; else if (dy) hit = true;
  return hit;
}

// Move a creature by (dx, dy) one axis at a time, so it slides along a wall
// rather than sticking to it (r null: nothing stops it). Met square on, it
// steps aside round the nearer end of the wall, and keeps to that side a
// while so it clears the corner. Returns true if a wall stopped any of it.
function slide(m, dx, dy, r) {
  if (r === null) { m.x += dx; m.y += dy; return false; }   // a bird goes over the roofs
  const ox = m.x, oy = m.y, step = Math.hypot(dx, dy);
  const hit = axisMove(m, dx, dy, r);
  if (!hit || step === 0 || Math.hypot(m.x - ox, m.y - oy) >= step * 0.5) return hit;
  const px = -dy / step, py = dx / step, now = Date.now();
  if (!m.skirt || !(now < m.skirtUntil)) {
    const w = wallAt(ox + dx, oy + dy, r);
    const toward = w ? (w.x + w.w / 2 - ox) * px + (w.y + w.h / 2 - oy) * py : 0;
    m.skirt = toward > 0 ? -1 : 1;
  }
  m.skirtUntil = now + 1500;
  const bx = m.x, by = m.y;
  axisMove(m, px * m.skirt * step, py * m.skirt * step, r);
  if (m.x === bx && m.y === by) m.skirt = -m.skirt;   // that way is shut too: try the other next time
  return hit;
}

module.exports = { WALLS, ASH_SOLID, MINSTER_SOLID, blocked, slide };
