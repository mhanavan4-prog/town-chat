// The shape of each dungeon and of the Delve: one source for the server (where
// creatures stand, where things to find lie) and the client (the walls it
// draws and keeps you out of), which is sent these on joining.
//
// Each is 2400 across, cut into a 3×3 grid of chambers 800 wide. A layout is
// the list of doorways between neighbouring chambers; everything else (walls,
// creature posts, lanterns, chests, caches, veins, traps, braziers, seals)
// is worked out from that, the same way every time.
const DUNGEON_SIZE = 2400;
const CELL = 800, WALL = 28, DOOR = 240;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const id = (c, r) => c + ',' + r;
const centre = (c, r) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });

// name, the chamber you arrive in, the boss's chamber, the doorways, and how
// wide the doorways are (the Delve is an open field of pillars).
const PLANS = {
  // 1: the Rootcellar — a long winding from the cellar steps to Old Gnawbone.
  1: { entry: [1, 2], boss: [1, 0], doors: [['1,2', '0,2'], ['0,2', '0,1'], ['0,1', '1,1'], ['1,1', '2,1'], ['2,1', '2,0'], ['2,0', '1,0'], ['1,2', '2,2'], ['0,1', '0,0']] },
  // 2: the Weeping Crypts — in from the east, the Widow under the drowned chapel in the west.
  2: { entry: [2, 1], boss: [0, 1], doors: [['2,1', '2,0'], ['2,0', '1,0'], ['1,0', '1,1'], ['1,1', '1,2'], ['1,2', '0,2'], ['0,2', '0,1'], ['2,1', '2,2'], ['1,0', '0,0']] },
  // 3: the Howling Forge — a ring of galleries round the heart-coal, entered from the north gallery.
  3: { entry: [1, 2], boss: [1, 1], doors: [['1,2', '0,2'], ['0,2', '0,1'], ['0,1', '0,0'], ['0,0', '1,0'], ['1,0', '2,0'], ['2,0', '2,1'], ['2,1', '2,2'], ['2,2', '1,2'], ['1,0', '1,1']] },
  // 4: the Starless Deep — a spiral inward to the Sovereign's court.
  4: { entry: [1, 2], boss: [1, 1], doors: [['1,2', '2,2'], ['2,2', '2,1'], ['2,1', '2,0'], ['2,0', '1,0'], ['1,0', '0,0'], ['0,0', '0,1'], ['0,1', '1,1'], ['0,1', '0,2']] },
  // 5: the Delve — every way open, the floor broken by standing rock.
  5: { entry: [1, 2], boss: [1, 0], doorWidth: 420, doors: [['0,0', '1,0'], ['1,0', '2,0'], ['0,1', '1,1'], ['1,1', '2,1'], ['0,2', '1,2'], ['1,2', '2,2'], ['0,0', '0,1'], ['0,1', '0,2'], ['1,0', '1,1'], ['1,1', '1,2'], ['2,0', '2,1'], ['2,1', '2,2']] },
};

function build(n) {
  const plan = PLANS[n];
  const rand = mulberry(0x51ED270B ^ (n * 7919));
  const open = new Set(plan.doors.map(([a, b]) => [a, b].sort().join('|')));
  const isOpen = (a, b) => open.has([a, b].sort().join('|'));
  const gap = plan.doorWidth || DOOR;
  const walls = [], doors = [];
  // the walls between chambers, each with a doorway in its middle where there is one
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 3; r++) {
      if (c < 2) { // the wall on this chamber's east side
        const x = (c + 1) * CELL - WALL / 2, y0 = r * CELL;
        if (isOpen(id(c, r), id(c + 1, r))) {
          const g0 = y0 + (CELL - gap) / 2;
          walls.push({ x, y: y0, w: WALL, h: g0 - y0 }, { x, y: g0 + gap, w: WALL, h: y0 + CELL - (g0 + gap) });
          doors.push({ x: (c + 1) * CELL, y: y0 + CELL / 2, along: 'y', width: gap });
        } else walls.push({ x, y: y0, w: WALL, h: CELL });
      }
      if (r < 2) { // the wall on its south side
        const y = (r + 1) * CELL - WALL / 2, x0 = c * CELL;
        if (isOpen(id(c, r), id(c, r + 1))) {
          const g0 = x0 + (CELL - gap) / 2;
          walls.push({ x: x0, y, w: g0 - x0, h: WALL }, { x: g0 + gap, y, w: x0 + CELL - (g0 + gap), h: WALL });
          doors.push({ x: x0 + CELL / 2, y: (r + 1) * CELL, along: 'x', width: gap });
        } else walls.push({ x: x0, y, w: CELL, h: WALL });
      }
    }
  }
  const entryC = centre(...plan.entry), bossC = centre(...plan.boss);
  const entryId = id(...plan.entry), bossId = id(...plan.boss);
  // how many doorways each chamber has: one doorway is a dead end, where caches lie
  const degree = {};
  for (const [a, b] of plan.doors) { degree[a] = (degree[a] || 0) + 1; degree[b] = (degree[b] || 0) + 1; }
  const chambers = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) chambers.push({ id: id(c, r), c, r, ...centre(c, r), doors: degree[id(c, r)] || 0 });
  const others = chambers.filter((ch) => ch.id !== entryId);
  const rest = others.filter((ch) => ch.id !== bossId);

  // where creatures stand: four posts to a chamber, none in the one you arrive in
  const lanes = [];
  const POSTS = [[-190, -150], [190, -150], [-190, 170], [190, 170]];
  for (let i = 0; i < 4; i++) for (const ch of others) {
    if (ch.id === bossId) { const a = (i / 4) * Math.PI * 2 + 0.6; lanes.push({ x: Math.round(ch.x + Math.cos(a) * 300), y: Math.round(ch.y + Math.sin(a) * 300) }); continue; }
    lanes.push({ x: ch.x + POSTS[i][0], y: ch.y + POSTS[i][1] });
  }

  // lanterns: one over every chamber (these carry the light), and a dim one in each doorway
  const lanterns = chambers.map((ch) => [ch.x, ch.y]);
  const doorLamps = doors.map((d) => [d.x, d.y]);

  // ── Things to find ──
  const corner = (ch, sx, sy, d) => ({ x: ch.x + sx * (d || 300), y: ch.y + sy * (d || 300) });
  const sgn = () => (rand() < 0.5 ? -1 : 1);
  const deadEnds = rest.filter((ch) => ch.doors <= 1);
  const through = rest.filter((ch) => ch.doors > 1);
  const cacheRooms = (deadEnds.length >= 2 ? deadEnds : [...deadEnds, ...through]).slice(0, 2);
  const caches = cacheRooms.map((ch, i) => ({ id: 'cache' + (i + 1), ...corner(ch, sgn(), sgn(), 320), chamber: ch.id }));
  const chestRooms = [through[Math.floor(through.length / 3)] || rest[0], chambers.find((ch) => ch.id === bossId)];
  const chests = chestRooms.map((ch, i) => ({ id: 'chest' + (i + 1), ...(ch.id === bossId ? { x: ch.x, y: ch.y - 330 } : corner(ch, sgn(), sgn(), 300)), chamber: ch.id, boss: ch.id === bossId }));
  const NODE_KINDS = ['ore', 'mushroom', 'crystal'];
  const nodes = [];
  rest.forEach((ch, i) => {
    nodes.push({ id: 'node' + (nodes.length + 1), kind: NODE_KINDS[(i + n) % 3], x: ch.x + sgn() * 340, y: ch.y + Math.round((rand() - 0.5) * 300), chamber: ch.id });
    if (i % 2 === 0) nodes.push({ id: 'node' + (nodes.length + 1), kind: NODE_KINDS[(i + n + 1) % 3], x: ch.x + Math.round((rand() - 0.5) * 300), y: ch.y + sgn() * 340, chamber: ch.id });
  });
  // traps: a plate or a vent in most doorways, and a few out on the floor
  const traps = [];
  doors.forEach((d, i) => {
    if (n === 5 ? i % 3 !== 0 : i % 4 === 3) return;
    const off = (rand() - 0.5) * (d.width - 110);
    traps.push({ id: 'trap' + (traps.length + 1), kind: i % 2 ? 'vent' : 'spikes', x: Math.round(d.x + (d.along === 'x' ? off : 0)), y: Math.round(d.y + (d.along === 'y' ? off : 0)), r: 46 });
  });
  rest.forEach((ch, i) => { if (i % 2) traps.push({ id: 'trap' + (traps.length + 1), kind: i % 4 === 1 ? 'rockfall' : 'spikes', x: ch.x + Math.round((rand() - 0.5) * 160), y: ch.y + Math.round((rand() - 0.5) * 160), r: 50 }); });
  // side goals: braziers to light, and seals to break
  const braziers = rest.filter((_, i) => i % 2 === 0).slice(0, 4).map((ch, i) => ({ id: 'brazier' + (i + 1), x: ch.x + sgn() * 110, y: ch.y + sgn() * 110, chamber: ch.id }));
  const seals = rest.filter((_, i) => i % 2 === 1).slice(0, 3).map((ch, i) => ({ id: 'seal' + (i + 1), ...corner(ch, sgn(), sgn(), 250), chamber: ch.id }));

  // standing rock inside the chambers (short walls), clear of the doorways, the
  // middle, and everything that stands or lies in the chamber
  const pillars = [];
  const taken = [...lanes, ...chests, ...caches, ...nodes, ...traps, ...braziers, ...seals];
  const clearOf = (w) => taken.every((p) => p.x < w.x - 70 || p.x > w.x + w.w + 70 || p.y < w.y - 70 || p.y > w.y + w.h + 70);
  for (const ch of rest) {
    const k = n === 5 ? 3 : 2;
    for (let i = 0; i < k; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const horiz = rand() < 0.5, len = 120 + Math.floor(rand() * 4) * 30;
        const ox = (rand() < 0.5 ? -1 : 1) * (150 + rand() * 120), oy = (rand() < 0.5 ? -1 : 1) * (150 + rand() * 120);
        const w = { x: Math.round(ch.x + ox - (horiz ? len / 2 : WALL / 2)), y: Math.round(ch.y + oy - (horiz ? WALL / 2 : len / 2)), w: horiz ? len : WALL, h: horiz ? WALL : len };
        if (!clearOf(w)) continue;
        pillars.push(w); walls.push(w); taken.push({ x: w.x + w.w / 2, y: w.y + w.h / 2 });
        break;
      }
    }
  }

  return {
    size: DUNGEON_SIZE, walls, pillars, doors, chambers,
    entry: { x: entryC.x, y: entryC.y + 190 }, boss: bossC,
    portal: { x: entryC.x - 270, y: entryC.y + 290 }, plaque: { x: entryC.x + 270, y: entryC.y + 250 },
    lanterns, doorLamps, lanes, chests, caches, nodes, traps, braziers, seals,
  };
}

const DUNGEON_LAYOUTS = { 1: build(1), 2: build(2), 3: build(3), 4: build(4), 5: build(5) };

module.exports = { DUNGEON_SIZE, DUNGEON_LAYOUTS, DUNGEON_CELL: CELL };
