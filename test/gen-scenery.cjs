// Generates + VALIDATES the town-square scenery expansion, then prints the
// server.js snippet (natureDecor additions + wildlife collider additions).
// Deterministic: run any number of times, same output. The validator is the
// point — every placement is proven clear of buildings, paths, doors, the
// spawn plaza, torches, portals, the temple platform, NPCs, mob/animal
// spawns, and every OTHER placement before it's allowed into the list.
// Run: node test/gen-scenery.cjs

// ── the town as server.js defines it ────────────────────────────────────────
const W = { width: 3200, height: 2200, spawn: { x: 1600, y: 1100 } };
const BUILDINGS = [
  { id: 'cafe', x: 300, y: 375, w: 500, h: 340, door: 'east' },
  { id: 'library', x: 2330, y: 375, w: 400, h: 260, door: 'west' },
  { id: 'arcade', x: 295, y: 1530, w: 400, h: 270, door: 'east' },
  { id: 'lounge', x: 2335, y: 1530, w: 400, h: 270, door: 'west' },
  { id: 'hall', x: 1360, y: 110, w: 480, h: 290, door: 'south' },
  { id: 'bank', x: 1380, y: 1810, w: 440, h: 280, door: 'north' }
];
const doorPos = (b) => {
  if (b.door === 'south') return { x: b.x + b.w / 2, y: b.y + b.h };
  if (b.door === 'north') return { x: b.x + b.w / 2, y: b.y };
  if (b.door === 'east') return { x: b.x + b.w, y: b.y + b.h / 2 };
  return { x: b.x, y: b.y + b.h / 2 };
};
const HUB = { x: 1600, y: 1100, r: 130 };
const PATHS = BUILDINGS.map(b => ({ a: doorPos(b), b: HUB }));
PATHS.push({ a: { x: 1060, y: 1740 }, b: HUB }); // temple path
const TEMPLE = { x0: 1060 - 180 - 20, y0: 1900 - 130 - 20, x1: 1060 + 180 + 20, y1: 1900 + 130 + 20 };
const PORTAL = { x: 1600, y: 700, r: 80 };
const TORCHES = [{ x: 1600, y: 880 }, { x: 1820, y: 1100 }, { x: 1600, y: 1320 }, { x: 1380, y: 1100 }];
const NPCS = [{ x: 1350, y: 950 }, { x: 1850, y: 950 }, { x: 1350, y: 1250 }, { x: 1850, y: 1250 }];
const MOB_SPAWNS = [
  { x: 250, y: 300 }, { x: 250, y: 750 }, { x: 2780, y: 420 }, { x: 2780, y: 580 },
  { x: 245, y: 1560 }, { x: 245, y: 1730 }, { x: 2785, y: 1560 }, { x: 2785, y: 1730 },
  { x: 1450, y: 60 }, { x: 1750, y: 60 }
];
const ANIMAL_SPAWNS = [
  { x: 1600, y: 700 }, { x: 1600, y: 1500 }, { x: 1000, y: 1100 }, { x: 2200, y: 1100 },
  { x: 1300, y: 1750 }, { x: 1950, y: 520 }, { x: 500, y: 1300 }, { x: 2700, y: 1300 },
  { x: 1100, y: 600 }, { x: 2100, y: 1850 }
];
const EXISTING = [ // current natureDecor, id → x,y + footprint radius
  ['tree', 80, 935, 26], ['tree', 145, 1175, 22], ['tree', 65, 1360, 24], ['shrub', 175, 1015, 12],
  ['shrub', 120, 1280, 10], ['tree', 935, 80, 24], ['tree', 1160, 55, 20], ['shrub', 1040, 120, 12],
  ['tree', 3065, 935, 24], ['tree', 3135, 1175, 22], ['tree', 3080, 1360, 25], ['shrub', 2985, 1025, 11],
  ['shrub', 3040, 1265, 12], ['tree', 935, 2135, 24], ['tree', 1200, 2160, 23], ['tree', 2000, 2145, 24],
  ['tree', 2265, 2120, 22], ['shrub', 1065, 2095, 12], ['shrub', 2135, 2080, 10], ['tree', 1975, 80, 22],
  ['tree', 2160, 105, 24], ['shrub', 2065, 55, 11], ['tree', 105, 335, 23], ['tree', 3105, 335, 23],
  ['shrub', 80, 1865, 12], ['shrub', 3120, 1865, 12], ['rock', 500, 1100, 14], ['rock', 1100, 1700, 13],
  ['rock', 2100, 1700, 15], ['rock', 2700, 1100, 13], ['rock', 1600, 1700, 14], ['rock', 1050, 650, 12],
  ['flower', 950, 1200, 14], ['flower', 1700, 750, 14], ['flower', 2450, 1300, 14], ['flower', 1300, 900, 13],
  ['flower', 2000, 1500, 14], ['flower', 600, 1400, 13]
];

// footprint radius per new type (for spacing checks)
const RADIUS = {
  tree: (s) => 9 * s, shrub: () => 12, rock: (s) => 14 * (s || 1), flower: () => 14,
  bench: () => 22, lamppost: () => 8, well: () => 26, stall: () => 44,
  crate: () => 12, barrel: () => 10, haybale: () => 18, fence: () => 18, // segments are MEANT to abut into a fence line
  stump: () => 10, log: () => 28, noticeboard: () => 18
};
// types allowed to hug a path (26–46 from centerline) instead of avoiding it
const PATHSIDE = new Set(['lamppost', 'bench', 'noticeboard']);
// types allowed inside the plaza ring (140–320 from spawn)
const PLAZA_OK = new Set(['bench', 'lamppost', 'well', 'stall', 'flower', 'noticeboard']);

function segDist(px, py, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t));
}
function inRect(x, y, r, x0, y0, x1, y1) { return x + r > x0 && x - r < x1 && y + r > y0 && y - r < y1; }

const placed = [];
const errors = [];
function radiusOf(p) { return (RADIUS[p.type] || (() => 12))(p.scale || 1); }
function tryPlace(p, label) {
  const r = radiusOf(p);
  const fail = (why) => errors.push(`✗ ${label} ${p.type}@(${p.x},${p.y}) — ${why}`);
  if (p.x - r < 40 || p.x + r > W.width - 40 || p.y - r < 40 || p.y + r > W.height - 40) return fail('outside bounds');
  for (const b of BUILDINGS) if (inRect(p.x, p.y, r + 14, b.x, b.y, b.x + b.w, b.y + b.h)) return fail('in building ' + b.id);
  if (inRect(p.x, p.y, r, TEMPLE.x0, TEMPLE.y0, TEMPLE.x1, TEMPLE.y1)) return fail('on temple platform');
  const dHub = Math.hypot(p.x - HUB.x, p.y - HUB.y);
  if (PLAZA_OK.has(p.type) ? dHub < 140 : dHub < HUB.r + 40 + r) return fail('too close to spawn hub (' + dHub.toFixed(0) + ')');
  if (Math.hypot(p.x - PORTAL.x, p.y - PORTAL.y) < PORTAL.r + r) return fail('on the wilds portal');
  for (const t of TORCHES) if (Math.hypot(p.x - t.x, p.y - t.y) < 46 + r) return fail('on a ritual torch');
  for (const n of NPCS) if (Math.hypot(p.x - n.x, p.y - n.y) < 46 + r) return fail('on an NPC');
  for (const m of MOB_SPAWNS) if (Math.hypot(p.x - m.x, p.y - m.y) < 55 + r) return fail('on a mob spawn');
  for (const a of ANIMAL_SPAWNS) if (Math.hypot(p.x - a.x, p.y - a.y) < 34 + r) return fail('on an animal spawn');
  let minPath = Infinity;
  for (const path of PATHS) minPath = Math.min(minPath, segDist(p.x, p.y, path.a, path.b));
  if (PATHSIDE.has(p.type) && p.pathside) {
    if (minPath < 26 || minPath > 60) return fail(`pathside item ${minPath.toFixed(0)} from lane (want 26–60)`);
  } else if (minPath < 44 + r) return fail(`blocks a walking lane (${minPath.toFixed(0)})`);
  for (const e of EXISTING) if (Math.hypot(p.x - e[1], p.y - e[2]) < e[3] + r + 8) return fail('overlaps existing ' + e[0]);
  for (const q of placed) {
    if (p.type === 'fence' && q.type === 'fence') continue; // fence segments chain together on purpose
    if (Math.hypot(p.x - q.x, p.y - q.y) < radiusOf(q) + r + 8) return fail('overlaps new ' + q.type);
  }
  placed.push(p);
}

// deterministic jitter
let seed = 0xbeef;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const jitter = (v, amt) => Math.round(v + (rand() - 0.5) * 2 * amt);

// ── the design ───────────────────────────────────────────────────────────────
// Lampposts light the lanes, two per main path, fractions hand-picked per
// path so no post lands on the portal (which sits ON the hall lane), the
// torch ring, or a quest-giver NPC; one for the temple path.
const LAMP_FRACS = [
  [0.30, 0.62], // cafe
  [0.30, 0.62], // library
  [0.30, 0.62], // arcade
  [0.30, 0.62], // lounge
  [0.22, 0.80], // hall — dodges the wilds portal at y=700
  [0.30, 0.78], // bank — dodges torch_s and stays off the plaza edge
  [0.50]        // temple
];
PATHS.forEach((path, i) => {
  LAMP_FRACS[i].forEach((f, k) => {
    const vx = path.b.x - path.a.x, vy = path.b.y - path.a.y;
    const len = Math.hypot(vx, vy);
    const nx = -vy / len, ny = vx / len; // unit normal
    const side = (i + k) % 2 === 0 ? 1 : -1;
    tryPlace({ type: 'lamppost', x: Math.round(path.a.x + vx * f + nx * 34 * side), y: Math.round(path.a.y + vy * f + ny * 34 * side), pathside: true }, 'lane');
  });
});

// Plaza: a well NNW, market stalls at the NE/SE outskirts, three benches
// tucked into pockets the torches/NPCs/lanes leave free, plus one on the
// far east side.
tryPlace({ type: 'well', x: 1502, y: 928 }, 'plaza well');
tryPlace({ type: 'stall', x: 1745, y: 850, rot: 1, variant: 0 }, 'plaza stall NE');
tryPlace({ type: 'stall', x: 1745, y: 1350, rot: 1, variant: 1 }, 'plaza stall SE');
[[1470, 872, 0.6], [1500, 1345, -0.6], [1900, 1105, 1.571]].forEach(([x, y, rot], i) =>
  tryPlace({ type: 'bench', x, y, rot, plaza: true }, 'plaza bench ' + i));

// Noticeboard + a bench along the Town Hall lane (clear of the portal).
tryPlace({ type: 'noticeboard', x: 1544, y: 505, rot: 0, pathside: true }, 'hall lane board');
tryPlace({ type: 'bench', x: 1652, y: 560, rot: 0, pathside: true }, 'hall lane bench');

// West midfield — small orchard-and-work-yard feel.
[[380, 900, 2.6], [560, 1050, 3.0], [420, 1330, 2.8], [820, 1380, 2.5]].forEach(([x, y, s], i) =>
  tryPlace({ type: 'tree', x: jitter(x, 24), y: jitter(y, 24), scale: s }, 'west tree ' + i));
[[640, 900], [890, 1330]].forEach(([x, y], i) => tryPlace({ type: 'stump', x: jitter(x, 16), y: jitter(y, 16) }, 'west stump ' + i));
tryPlace({ type: 'log', x: 700, y: 1310, rot: 0.5 }, 'west log');
[[300, 1010], [740, 985], [905, 1245]].forEach(([x, y], i) => tryPlace({ type: 'shrub', x: jitter(x, 18), y: jitter(y, 18), scale: 1 }, 'west shrub ' + i));
tryPlace({ type: 'rock', x: 855, y: 875, scale: 0.9 }, 'west rock');
[[520, 1210], [990, 940]].forEach(([x, y], i) => tryPlace({ type: 'flower', x: jitter(x, 14), y: jitter(y, 14), scale: 1 }, 'west flowers ' + i));
[[620, 1265], [630, 1330]].forEach(([x, y], i) => tryPlace({ type: 'haybale', x, y, rot: i * 0.9 }, 'west hay ' + i));

// Fenced flower garden in the west meadow (clear of the temple lane).
[[705, 1120, 0], [775, 1120, 0], [705, 1220, 0], [775, 1220, 0], [675, 1150, 1.571], [675, 1190, 1.571], [805, 1150, 1.571], [805, 1190, 1.571]]
  .forEach(([x, y, rot], i) => tryPlace({ type: 'fence', x, y, rot }, 'garden fence ' + i));
[[720, 1170], [762, 1170]].forEach(([x, y], i) => tryPlace({ type: 'flower', x, y, scale: 1.1 }, 'garden flowers ' + i));

// East midfield — quieter meadow with a work corner near the lounge.
[[2270, 880, 2.7], [2650, 940, 3.0], [2880, 1240, 2.6], [2450, 1400, 2.4]].forEach(([x, y, s], i) =>
  tryPlace({ type: 'tree', x: jitter(x, 24), y: jitter(y, 24), scale: s }, 'east tree ' + i));
[[2180, 1000], [2760, 1060], [2560, 1180]].forEach(([x, y], i) => tryPlace({ type: 'shrub', x: jitter(x, 18), y: jitter(y, 18), scale: 1 }, 'east shrub ' + i));
[[2340, 1180], [2940, 1000]].forEach(([x, y], i) => tryPlace({ type: 'rock', x, y, scale: 0.9 + i * 0.2 }, 'east rock ' + i));
[[2245, 1310], [2840, 880]].forEach(([x, y], i) => tryPlace({ type: 'flower', x: jitter(x, 14), y: jitter(y, 14), scale: 1 }, 'east flowers ' + i));
[[2150, 1275], [2178, 1300]].forEach(([x, y], i) => tryPlace({ type: 'crate', x, y, rot: i * 0.5 }, 'east crates ' + i));
tryPlace({ type: 'barrel', x: 2205, y: 1270 }, 'east barrel');

// North strips (between cafe↔hall and hall↔library).
[[980, 240, 2.5], [1180, 300, 2.3]].forEach(([x, y, s], i) => tryPlace({ type: 'tree', x: jitter(x, 20), y: jitter(y, 20), scale: s }, 'n-strip w tree ' + i));
tryPlace({ type: 'shrub', x: 1080, y: 175, scale: 1 }, 'n-strip w shrub');
[[1990, 240, 2.4], [2200, 300, 2.6]].forEach(([x, y, s], i) => tryPlace({ type: 'tree', x: jitter(x, 20), y: jitter(y, 20), scale: s }, 'n-strip e tree ' + i));
tryPlace({ type: 'shrub', x: 2105, y: 180, scale: 0.9 }, 'n-strip e shrub');
[[930, 330], [2280, 200]].forEach(([x, y], i) => tryPlace({ type: 'flower', x, y, scale: 0.9 }, 'n-strip flowers ' + i));

// South strips (arcade↔temple↔bank and bank↔lounge).
[[790, 1935, 2.6], [820, 2100, 2.4]].forEach(([x, y, s], i) => tryPlace({ type: 'tree', x: jitter(x, 18), y: jitter(y, 18), scale: s }, 's-strip w tree ' + i));
tryPlace({ type: 'shrub', x: 745, y: 1840, scale: 1 }, 's-strip w shrub');
tryPlace({ type: 'haybale', x: 1275, y: 2105, rot: 0.4 }, 's-strip hay');
[[1990, 1935, 2.7], [2240, 1990, 2.4]].forEach(([x, y, s], i) => tryPlace({ type: 'tree', x: jitter(x, 18), y: jitter(y, 18), scale: s }, 's-strip e tree ' + i));
[[2090, 1935], [2118, 1962]].forEach(([x, y], i) => tryPlace({ type: 'crate', x, y, rot: 0.3 + i }, 's-strip crates ' + i));
tryPlace({ type: 'barrel', x: 2060, y: 1975 }, 's-strip barrel');
tryPlace({ type: 'shrub', x: 1900, y: 2080, scale: 1 }, 's-strip shrub');
tryPlace({ type: 'flower', x: 2250, y: 1880, scale: 1 }, 's-strip flowers');

// Corners.
[[210, 200, 2.8], [420, 145, 2.5]].forEach(([x, y, s], i) => tryPlace({ type: 'tree', x, y, scale: s }, 'NW corner tree ' + i));
tryPlace({ type: 'rock', x: 330, y: 300, scale: 1.1 }, 'NW rock');
[[2870, 175, 2.7], [3010, 300, 2.4]].forEach(([x, y, s], i) => tryPlace({ type: 'tree', x, y, scale: s }, 'NE corner tree ' + i));
tryPlace({ type: 'shrub', x: 2930, y: 240, scale: 1 }, 'NE shrub');
[[240, 1965, 2.7], [420, 2080, 2.5]].forEach(([x, y, s], i) => tryPlace({ type: 'tree', x, y, scale: s }, 'SW corner tree ' + i));
tryPlace({ type: 'log', x: 330, y: 1900, rot: 2.2 }, 'SW log');
[[2900, 1960, 2.8], [3060, 2075, 2.5]].forEach(([x, y, s], i) => tryPlace({ type: 'tree', x, y, scale: s }, 'SE corner tree ' + i));
tryPlace({ type: 'rock', x: 2985, y: 1900, scale: 1.0 }, 'SE rock');

// Barrels & crates snugged against building side walls (visual anchoring).
tryPlace({ type: 'barrel', x: 830, y: 420 }, 'cafe side barrel');
tryPlace({ type: 'crate', x: 858, y: 445, rot: 0.4 }, 'cafe side crate');
tryPlace({ type: 'barrel', x: 2300, y: 660 }, 'library side barrel');
tryPlace({ type: 'haybale', x: 760, y: 1470, rot: 1.2 }, 'arcade side hay');
tryPlace({ type: 'crate', x: 2305, y: 1500, rot: 0.2 }, 'lounge side crate');

// A bench along the bank lane too.
tryPlace({ type: 'bench', x: 1652, y: 1560, rot: 0, pathside: true }, 'bank lane bench');

// ── report ───────────────────────────────────────────────────────────────────
if (errors.length) {
  console.log('PLACEMENT ERRORS (' + errors.length + '):');
  for (const e of errors) console.log('  ' + e);
  process.exit(1);
}
const counts = {};
for (const p of placed) counts[p.type] = (counts[p.type] || 0) + 1;
console.log('ALL ' + placed.length + ' placements valid:', JSON.stringify(counts));

// server.js snippet — natureDecor entries (ids continue decor_38+)
let id = 38;
const lines = placed.map(p => {
  const parts = [`id: 'decor_${id++}'`, `type: '${p.type}'`, `x: ${p.x}`, `y: ${p.y}`];
  if (p.scale) parts.push(`scale: ${p.scale}`);
  if (p.rot !== undefined) parts.push(`rot: ${p.rot}`);
  if (p.variant !== undefined) parts.push(`variant: ${p.variant}`);
  return `  { ${parts.join(', ')} }`;
});
console.log('\n// —— natureDecor additions ——');
console.log(lines.join(',\n'));

// wildlife collider additions: trees (r 3*scale like existing 8-9ish) plus
// the chunky props rabbits shouldn't ghost through.
const solid = placed.filter(p => ['tree', 'well', 'stall', 'haybale', 'log'].includes(p.type));
console.log('\n// —— TREE_COLLIDERS additions ——');
console.log(solid.map(p => `  { x: ${p.x}, y: ${p.y}, r: ${p.type === 'tree' ? Math.round(3 * p.scale) : p.type === 'stall' ? 40 : p.type === 'well' ? 24 : 16} }`).join(',\n'));
