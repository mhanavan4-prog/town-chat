// ---------------------------------------------------------------------------
// The Shepherd's Race: a Troy Town cut in the turf of the Wilds, walked for
// real. The figure is the classical seven-circuit labyrinth, drawn from its
// seed exactly as on the Board (data/troy.js): eight walls, each over the top
// of the last, turning right, so the way in opens just left of the foot of
// the cross. Here it is laid out in world units, its top to the north and its
// gate to the south, facing the portal.
//
// "Running it in and out": the server follows a walker by where they stand on
// the path. The figure is rasterised, and every open cell inside the outer
// wall is given its distance along the one path from the centre (a flood,
// as data/troy.js's check was made). A run starts when you step in at the
// gate, reaches the centre, and ends when you come out at the gate again.
// Stepping over a wall shows as a jump along the path far bigger than the
// step you took: that is a false step, and you go back to the gate.
// ---------------------------------------------------------------------------
const { TROY_ENDS } = require('./troy');

const TROY_TOWN = { x: 7000, y: 7900, unit: 44 }; // the cross's centre in the Wilds, and one seed unit in world units
const RING = (k) => 2.6 + k;                      // the k-th wall's ring, about a centre half a unit right of the cross
const C = [0.5, 0];
const OUTER = RING(7);

// The walls in seed units (y up): the seed's strokes, then the eight arches.
function seedWalls() {
  const lines = [
    [[0, -2], [0, 2]], [[-2, 0], [2, 0]],
    [[1, 2], [1, 1], [2, 1]], [[-1, 2], [-1, 1], [-2, 1]],
    [[1, -2], [1, -1], [2, -1]], [[-1, -2], [-1, -1], [-2, -1]],
  ];
  const ang = (p) => Math.atan2(p[1] - C[1], p[0] - C[0]);
  for (let k = 0; k < 8; k++) {
    const from = TROY_ENDS[(9 + k) % 16], to = TROY_ENDS[8 - k], R = RING(k);
    const a0 = ang(from); let a1 = ang(to); while (a1 <= a0) a1 += Math.PI * 2;
    const pts = [from];
    const steps = Math.max(8, Math.ceil((a1 - a0) / (Math.PI / 36)));
    for (let s = 0; s <= steps; s++) { const a = a0 + (a1 - a0) * (s / steps); pts.push([C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)]); }
    pts.push(to);
    lines.push(pts);
  }
  return lines;
}
const SEED_DOTS = [[2, 2], [-2, 2], [2, -2], [-2, -2]];
// The gate: the mouth between the two outer radial walls (ends 0 and 1).
const GATE_ANGLE = (Math.atan2(-2 - C[1], 0 - C[0]) + Math.atan2(-2 - C[1], -1 - C[0])) / 2;
const SEED_GATE = [C[0] + OUTER * Math.cos(GATE_ANGLE), C[1] + OUTER * Math.sin(GATE_ANGLE)];
const SEED_CENTRE = [0.5, 1.6];

const toWorld = ([sx, sy]) => [TROY_TOWN.x + sx * TROY_TOWN.unit, TROY_TOWN.y - sy * TROY_TOWN.unit];
const toSeed = (wx, wy) => [(wx - TROY_TOWN.x) / TROY_TOWN.unit, (TROY_TOWN.y - wy) / TROY_TOWN.unit];

// What the client draws, in world units.
function troyTownGeometry() {
  return {
    x: TROY_TOWN.x, y: TROY_TOWN.y, unit: TROY_TOWN.unit,
    walls: seedWalls().map((l) => l.map(toWorld)),
    dots: SEED_DOTS.map(toWorld),
    gate: toWorld(SEED_GATE), centre: toWorld(SEED_CENTRE),
    radius: (OUTER + 0.5) * TROY_TOWN.unit,
    hub: toWorld(C),
  };
}

// ── The raster: cells a quarter of a seed unit across ──────────────────────
const CELL = 0.25, X0 = -11, Y0 = -11, NX = 92, NY = 88;
const cellOf = (sx, sy) => [Math.floor((sx - X0) / CELL), Math.floor((sy - Y0) / CELL)];
const idx = (i, j) => j * NX + i;
const inGrid = (i, j) => i >= 0 && j >= 0 && i < NX && j < NY;
let RASTER = null;
function raster() {
  if (RASTER) return RASTER;
  const wall = new Uint8Array(NX * NY);
  const mark = (i, j) => { if (inGrid(i, j)) wall[idx(i, j)] = 1; };
  // A 4-connected line, so the flood can't leak through a diagonal.
  const line = (a, b) => {
    const [i0, j0] = cellOf(...a), [i1, j1] = cellOf(...b);
    let i = i0, j = j0; const di = Math.sign(i1 - i0), dj = Math.sign(j1 - j0);
    const n = Math.max(Math.abs(i1 - i0), Math.abs(j1 - j0)) * 2 + 2;
    mark(i, j);
    for (let s = 0; s < n && (i !== i1 || j !== j1); s++) {
      // step along whichever axis keeps closest to the true line
      const t = ([ii, jj]) => { const [x, y] = [X0 + (ii + 0.5) * CELL, Y0 + (jj + 0.5) * CELL]; const [ax, ay] = a, [bx, by] = b; const dx = bx - ax, dy = by - ay; const L = Math.hypot(dx, dy) || 1; return Math.abs((x - ax) * dy - (y - ay) * dx) / L; };
      const ci = i !== i1 ? [i + di, j] : null, cj = j !== j1 ? [i, j + dj] : null;
      const nxt = ci && cj ? (t(ci) <= t(cj) ? ci : cj) : (ci || cj);
      [i, j] = nxt; mark(i, j);
    }
  };
  for (const l of seedWalls()) for (let s = 1; s < l.length; s++) line(l[s - 1], l[s]);
  for (const d of SEED_DOTS) { const [i, j] = cellOf(...d); mark(i, j); }
  // Flood from the centre along the open cells inside the outer ring.
  const inside = (i, j) => Math.hypot(X0 + (i + 0.5) * CELL - C[0], Y0 + (j + 0.5) * CELL - C[1]) < OUTER;
  const dist = new Int32Array(NX * NY).fill(-1);
  const [ci, cj] = cellOf(...SEED_CENTRE);
  const q = [[ci, cj]]; dist[idx(ci, cj)] = 0;
  for (let h = 0; h < q.length; h++) {
    const [i, j] = q[h];
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + a, nj = j + b;
      if (!inGrid(ni, nj) || wall[idx(ni, nj)] || dist[idx(ni, nj)] >= 0 || !inside(ni, nj)) continue;
      dist[idx(ni, nj)] = dist[idx(i, j)] + 1; q.push([ni, nj]);
    }
  }
  // The gate's distance: the furthest open cell just inside the mouth.
  let gateD = 0;
  for (let r = OUTER - 0.6; r < OUTER; r += 0.05) {
    const [gi, gj] = cellOf(C[0] + r * Math.cos(GATE_ANGLE), C[1] + r * Math.sin(GATE_ANGLE));
    if (inGrid(gi, gj) && dist[idx(gi, gj)] > gateD) gateD = dist[idx(gi, gj)];
  }
  let reached = 0, open = 0;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) if (inside(i, j) && !wall[idx(i, j)]) { open++; if (dist[idx(i, j)] >= 0) reached++; }
  RASTER = { wall, dist, gateD, open, reached, inside };
  return RASTER;
}

// Where a world point stands: outside the figure, on a wall, or on the path
// at some distance in from the gate (0 at the gate, gateD at the centre).
function troyTownWhere(wx, wy) {
  const R = raster();
  const [sx, sy] = toSeed(wx, wy);
  if (Math.hypot(sx - C[0], sy - C[1]) >= OUTER) return { outside: true };
  const [i, j] = cellOf(sx, sy);
  if (!inGrid(i, j)) return { outside: true };
  if (R.wall[idx(i, j)]) return { wall: true };
  const d = R.dist[idx(i, j)];
  if (d < 0) return { wall: true };
  return { along: R.gateD - d, cell: [i, j] };
}

const NEAR_GATE = 14;   // cells along the path that still count as "at the gate"
const NEAR_CENTRE = 10; // …and as "at the centre"
// One step of a walker. st is the walker's run, or null; returns { st, event }
// where event is null or one of 'start', 'centre', 'done', 'false', 'left'.
function troyTownStep(st, wx, wy) {
  const R = raster();
  const here = troyTownWhere(wx, wy);
  if (here.wall) return { st, event: null }; // standing on a turf bank: wait for the next step
  if (!st || st.phase === 'none') {
    const prevOut = !st || st.wasOutside;
    if (here.outside) return { st: { phase: 'none', wasOutside: true }, event: null };
    if (prevOut && here.along <= NEAR_GATE) return { st: { phase: 'in', along: here.along, at: [wx, wy], wasOutside: false }, event: 'start' };
    return { st: { phase: 'none', wasOutside: false }, event: null };
  }
  if (here.outside) {
    if (st.phase === 'back' && st.along <= NEAR_GATE) return { st: { phase: 'none', wasOutside: true }, event: 'done' };
    return { st: { phase: 'none', wasOutside: true }, event: 'left' };
  }
  const moved = Math.hypot(wx - st.at[0], wy - st.at[1]) / (TROY_TOWN.unit * CELL);
  if (Math.abs(here.along - st.along) > moved * 1.6 + 4) return { st: { phase: 'none', wasOutside: false }, event: 'false' };
  const next = { ...st, along: here.along, at: [wx, wy] };
  if (st.phase === 'in' && here.along >= R.gateD - NEAR_CENTRE) return { st: { ...next, phase: 'back' }, event: 'centre' };
  return { st: next, event: null };
}

const TROY_TOWN_XP = 30;
const TROY_TOWN_LORE = "Turf mazes went by 'Mizmaze,' 'Julian's Bower,' 'Troy Town,' or 'Shepherd's Race' (Matthews, 1922). 'Treading' or 'threading' the maze, he wrote, 'was a favourite game for several generations': at Boughton Green 'the \"treading\" of it was formerly a great feature of the three days' fair in June', at Alkborough a man remembered 'running it in and out' and the villagers' May-eve games about it, and at Saffron Walden there were 'rules and wagers (in gallons of beer)' for walking it. At Breamore the path inclines inward 'as if to afford a firmer footing to runners', and in Simpkinson's novel of 1860 a Boughton man could go through 'without a single false step', and 'would wager to go through it blindfold'. Titania mourns them: 'the quaint mazes in the wanton green, / For lack of tread, are undistinguishable.' This one is the seven-circuit figure of the Welsh shepherds' Caerdroia; Alkborough's and Wing's are a larger medieval pattern.";
const TROY_TOWN_SOURCE = 'W. H. Matthews, Mazes and Labyrinths (1922), chs. X–XII · Shakespeare, A Midsummer Night\'s Dream, II.i · Historic England, "Scheduled Monuments: A Guide for Owners and Occupiers" (2014)';

// The one modern line, folded under the maze's lore (client/now-note.js).
const TROY_TOWN_NOTE = "The old turf mazes are protected monuments: walk or run them, but never recut the turf or move a stone.";
module.exports = { TROY_TOWN, troyTownGeometry, troyTownWhere, troyTownStep, raster, TROY_TOWN_XP, TROY_TOWN_LORE, TROY_TOWN_NOTE, TROY_TOWN_SOURCE, NEAR_GATE, NEAR_CENTRE };
