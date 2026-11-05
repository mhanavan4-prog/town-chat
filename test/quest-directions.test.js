// Directions pass — every quest objective has to tell the player where to go.
//
// Playtest: a Green Path chapter said "Brew a hedge remedy at the cauldron"
// and nothing in the game said where the cauldron was. These objectives are
// spread across data/quests.js (side quests + the six class campaigns) and
// data/greenPath.js, so this walks ALL of them rather than the ones we noticed
// and asserts each one resolves to real directions.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-directions-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

// Every { objective } in a quest-data module, wherever it is nested.
function collectObjectives(mod, src) {
  const out = [], seen = new Set();
  (function walk(node, trail) {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (node.objective && node.objective.type) out.push({ src, title: node.title || trail, o: node.objective });
    if (Array.isArray(node)) node.forEach((n, i) => walk(n, trail + '[' + i + ']'));
    else for (const k of Object.keys(node)) walk(node[k], trail ? trail + '.' + k : k);
  })(mod, '');
  return out;
}

setTimeout(async () => {
  const h = global.__testHooks;
  const objectives = [
    ...collectObjectives(require('../data/quests.js'), 'quests'),
    ...collectObjectives(require('../data/greenPath.js'), 'greenPath'),
  ];
  check('quest objectives were found to check', objectives.length > 40, objectives.length);

  // ── 1. Every objective has directions ──────────────────────────────────────
  const noWhere = objectives
    .filter((q) => !String(h.objectiveWhere(q.o) || '').trim())
    .map((q) => q.src + ' · ' + q.o.type + ' · ' + (q.o.label || q.title));
  check('every objective says where to go', noWhere.length === 0, noWhere);

  // Directions have to actually say something — a bare restatement of the
  // objective ("brew a remedy") is what left the cauldron unfindable.
  const tooThin = objectives
    .filter((q) => String(h.objectiveWhere(q.o) || '').trim().length < 12)
    .map((q) => q.o.type + ': ' + h.objectiveWhere(q.o));
  check('directions are more than a word or two', tooThin.length === 0, tooThin);

  // ── 2. Named NPCs have a real whereabouts, not the "ask around" fallback ───
  const vagueNpc = objectives
    .filter((q) => q.o.type === 'talk_npc' && h.objectiveWhere(q.o) === 'ask around town')
    .map((q) => q.o.npcId);
  check('every quest NPC has a specific whereabouts', vagueNpc.length === 0, vagueNpc);

  // ── 3. Map pins point somewhere the waypoint can actually route ────────────
  // client/waypoint.js can route to the Wilds, the witch's cave, the town
  // square and town buildings. Any other room makes it confidently point at
  // the wrong thing (from the Wilds it assumes an unknown room is back in
  // town), and a wrong arrow is worse than none.
  const { waypointTarget } = await import('../client/waypoint.js');
  const townRooms = new Set(h.WORLD.buildings.map((b) => b.id));
  const badPin = [];
  for (const q of objectives) {
    const g = h.objectiveGoal(q.o);
    if (!g || !g.room) continue;
    if (!['wilds', 'witch_cave', 'outside'].includes(g.room) && !townRooms.has(g.room)) badPin.push(q.o.type + ' -> ' + g.room);
  }
  check('every map pin points at a room the waypoint can route to', badPin.length === 0, badPin);

  // And prove it: from the town square each pinned goal resolves to a target.
  const ctx = {
    buildings: h.WORLD.buildings,
    getDoorWorldPos: (b) => ({ x: b.x + b.w / 2, y: b.y + b.h }),
    portalInTown: { x: 1600, y: 300 },
    townNpcs: h.WORLD.buildings.map(() => null).filter(Boolean),
  };
  const deadPins = [];
  for (const q of objectives) {
    const g = h.objectiveGoal(q.o);
    if (!g || !g.room || g.room === 'outside') continue;
    if (!waypointTarget(g, 'outside', ctx)) deadPins.push(q.o.type + ' -> ' + g.room);
  }
  check('each pinned goal resolves to a target from town', deadPins.length === 0, deadPins);

  // ── 4. The Green Path panel carries its directions ─────────────────────────
  // (greenPathStateBody is what the Garden panel renders.)
  const gpChapters = require('../data/greenPath.js').GREEN_PATH;
  const gpNoWhere = gpChapters
    .filter((c) => !String(h.objectiveWhere(c.objective) || '').trim())
    .map((c) => c.title);
  check('every Green Path chapter has directions', gpNoWhere.length === 0, gpNoWhere);
  // The one that sent a player looking for the cauldron must name the cave.
  const brew = gpChapters.find((c) => c.objective.type === 'garden_brew');
  check('the brewing chapter names the cave, not just "the cauldron"',
    !!brew && /cave/i.test(h.objectiveWhere(brew.objective)), brew && h.objectiveWhere(brew.objective));
  // Finding a cutting must say cuttings come off Wilds creatures.
  const seed = gpChapters.find((c) => c.objective.type === 'seed_found');
  check('the cutting chapter says cuttings drop from Wilds creatures',
    !!seed && /Wilds/.test(h.objectiveWhere(seed.objective)) && /(drop|fell|loot)/i.test(h.objectiveWhere(seed.objective)),
    seed && h.objectiveWhere(seed.objective));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 500);
