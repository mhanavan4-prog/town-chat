// Witch paths (data/paths.js) — the identity capstone. Each path grants one
// small passive perk on an existing derived stat (pathBuffContrib), so the
// choice steers without new combat math.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { WITCH_PATHS } = require('../data/paths.js');

const ids = Object.keys(WITCH_PATHS);
const STATS = new Set(['power', 'guard', 'vitality', 'haste', 'swift', 'leech', 'xp', 'forage']);

check('the six traditions are defined', ids.length === 6, ids);
check('green/lunar/hedge/kitchen/sea/hearth all present', ['green', 'lunar', 'hedge', 'kitchen', 'sea', 'hearth'].every((k) => WITCH_PATHS[k]), ids);
for (const id of ids) {
  const w = WITCH_PATHS[id];
  check(`${id} has name/emoji/blurb`, !!(w.name && w.emoji && w.blurb), w);
  check(`${id} perk targets a known stat`, STATS.has(w.stat), w.stat);
  check(`${id} perk amount is positive`, typeof w.amount === 'number' && w.amount > 0, w.amount);
}

// Paths steer toward different systems, so most perks hit different stats.
const statsUsed = new Set(ids.map((id) => WITCH_PATHS[id].stat));
check('paths spread across several stats', statsUsed.size >= 5, [...statsUsed]);

// The perk predicate (mirror of server pathBuffContrib).
function pathBuff(pathId, statKey) {
  const w = pathId && WITCH_PATHS[pathId];
  return (w && w.stat === statKey) ? (w.amount || 0) : 0;
}
check('the green witch lifts forage and nothing else', pathBuff('green', 'forage') === WITCH_PATHS.green.amount && pathBuff('green', 'xp') === 0);
check('the hearth witch lifts guard', pathBuff('hearth', 'guard') === WITCH_PATHS.hearth.amount);
check('no path = no perk', pathBuff(null, 'forage') === 0);
check('an unknown path = no perk', pathBuff('cosmic', 'forage') === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
