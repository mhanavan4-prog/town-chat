// How a creature of the Wilds moves where something solid stands
// (data/wildsSolids.js): it takes each axis of its step only where the way is
// clear, so it slides along a wall, and when it is held square against one it
// turns along it, keeping to the side it chose for a moment, until it is past.
const { WILDS_SOLIDS } = require('../data/wildsSolids');

const R = 14;               // how near a wall its middle may come
const TURN_MS = 1400;       // how long it keeps to the side it turned
const STALE_MS = 6000;      // this long round one thing without getting clear, and it tries the other way
const BACK_MS = 900;        // how long it backs out of a notch it is shut into
const AHEAD = 34;           // how far along its line it looks for a wall

// Things that stand close enough together to make a pocket a creature could
// walk into and not out of (three stones in a huddle) are taken as one: the
// box round the whole huddle is solid to it as well.
const NEAR = R * 2 + 12;
const SOLIDS = [...WILDS_SOLIDS];
{
  const group = WILDS_SOLIDS.map((_, i) => i);
  const find = (i) => (group[i] === i ? i : (group[i] = find(group[i])));
  const touch = (a, b) => a[0] - NEAR < b[0] + b[2] && a[0] + a[2] + NEAR > b[0] && a[1] - NEAR < b[1] + b[3] && a[1] + a[3] + NEAR > b[1];
  for (let i = 0; i < WILDS_SOLIDS.length; i++) for (let j = i + 1; j < WILDS_SOLIDS.length; j++) if (touch(WILDS_SOLIDS[i], WILDS_SOLIDS[j])) group[find(i)] = find(j);
  const boxes = {};
  WILDS_SOLIDS.forEach(([x, y, w, h], i) => { const g = find(i), b = boxes[g] || (boxes[g] = { x0: x, y0: y, x1: x + w, y1: y + h, n: 0 }); b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x + w); b.y1 = Math.max(b.y1, y + h); b.n++; });
  for (const b of Object.values(boxes)) if (b.n > 1) SOLIDS.push([b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0]);
}

// The solids, bucketed, so a step looks only at what is near it.
const CELL = 500;
const grid = new Map();
for (const s of SOLIDS) {
  const [x, y, w, h] = s;
  for (let cx = Math.floor((x - R) / CELL); cx <= Math.floor((x + w + R) / CELL); cx++) for (let cy = Math.floor((y - R) / CELL); cy <= Math.floor((y + h + R) / CELL); cy++) {
    const k = cx + ',' + cy;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(s);
  }
}
function blocked(x, y) {
  const near = grid.get(Math.floor(x / CELL) + ',' + Math.floor(y / CELL));
  if (!near) return false;
  for (const [sx, sy, w, h] of near) if (x > sx - R && x < sx + w + R && y > sy - R && y < sy + h + R) return true;
  return false;
}

// Which hand to turn to: feel along the wall both ways for the nearer place
// where the way forward opens. (Left as it faces if there is nothing in it.)
function shorterSide(x, y, ux, uy) {
  for (let d = 30; d <= 600; d += 30) for (const side of [1, -1]) {
    const px = x - uy * side * d, py = y + ux * side * d;
    if (!blocked(px, py) && !blocked(px + ux * AHEAD, py + uy * AHEAD)) return side;
  }
  return 1;
}

// Move m by (vx, vy) for dt. A creature already inside something (it rose
// there, or was put there) is let walk out.
function step(m, vx, vy, dt, now = Date.now()) {
  if (vx === 0 && vy === 0) return;
  const x0 = m.x, y0 = m.y, sp = Math.hypot(vx, vy), nx = x0 + vx * dt, ny = y0 + vy * dt;
  if (blocked(x0, y0)) { m.x = nx; m.y = ny; return; }
  if (m.backUntil > now) {   // backing out of a notch: far enough that it can get round what made it
    if (!blocked(x0 - vx * dt, y0 - vy * dt)) { m.x = x0 - vx * dt; m.y = y0 - vy * dt; } else m.backUntil = 0;
    return;
  }
  // Is the straight way open: this step, and a little further on the same line?
  const open = !blocked(nx, ny) && !blocked(x0 + vx / sp * AHEAD, y0 + vy / sp * AHEAD);
  if (open) { m.x = nx; m.y = ny; m.turnSince = 0; return; }
  // Something is in the way: go along it, a quarter-turn off the line, keeping
  // to one side until the straight way opens (or that side is shut too).
  if (!(m.turnUntil > now) || !m.turnSide) m.turnSide = shorterSide(x0, y0, vx / sp, vy / sp);   // a fresh choice only when it has been clear a while
  m.turnUntil = now + TURN_MS;
  // going round and getting nowhere (a pocket between stones): try the other way about
  if (!m.turnSince) m.turnSince = now; else if (now - m.turnSince > STALE_MS) { m.turnSide = -m.turnSide; m.turnSince = now; }
  for (const side of [m.turnSide, -m.turnSide]) {
    const px = -vy * side, py = vx * side;
    let moved = false;
    if (!blocked(x0 + px * dt, y0)) { m.x = x0 + px * dt; moved = moved || px !== 0; }
    if (!blocked(m.x, y0 + py * dt)) { m.y = y0 + py * dt; moved = moved || py !== 0; }
    if (Math.hypot(m.x - x0, m.y - y0) >= sp * dt * 0.5) { m.turnSide = side; return; }
    m.x = x0; m.y = y0;
  }
  // shut in on both hands (a notch between stones): back out the way it came
  m.backUntil = now + BACK_MS;
  if (!blocked(x0 - vx * dt, y0 - vy * dt)) { m.x = x0 - vx * dt; m.y = y0 - vy * dt; }
}

module.exports = { step, blocked, R, TURN_MS, SOLIDS };
