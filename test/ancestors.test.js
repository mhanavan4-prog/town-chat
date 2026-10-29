// Ancestor Altar (data/ancestors.js) — the solitary Samhain rite. Each virtue
// grants one small passive on an existing derived stat (ancestorBuffContrib),
// gated to the Samhain season and to once per day. Mirrors paths/teas tests.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { ANCESTOR_BLESSING_HOURS, ANCESTOR_OFFERINGS, ANCESTOR_VIRTUES } = require('../data/ancestors.js');
const { PLANT_CATALOG } = require('../data/world.js');

const STATS = new Set(['power', 'guard', 'vitality', 'haste', 'swift', 'leech', 'xp', 'forage']);

check('the blessing lasts a meaningful watch', typeof ANCESTOR_BLESSING_HOURS === 'number' && ANCESTOR_BLESSING_HOURS >= 1, ANCESTOR_BLESSING_HOURS);
check('six virtues are offered', ANCESTOR_VIRTUES.length === 6, ANCESTOR_VIRTUES.map((v) => v.id));

const ids = new Set();
for (const v of ANCESTOR_VIRTUES) {
  check(`${v.id} has name/emoji/line`, !!(v.name && v.emoji && v.line), v);
  check(`${v.id} targets a known stat`, STATS.has(v.stat), v.stat);
  check(`${v.id} amount is positive`, typeof v.amount === 'number' && v.amount > 0, v.amount);
  check(`${v.id} id is unique`, !ids.has(v.id), v.id);
  ids.add(v.id);
}

// Virtues steer toward different systems, so they spread across several stats.
const statsUsed = new Set(ANCESTOR_VIRTUES.map((v) => v.stat));
check('virtues spread across several stats', statsUsed.size >= 5, [...statsUsed]);

// Every offering is a real, obtainable world item — the rite must never ask for
// something that isn't in the catalog (the salt-scatter lesson from #583).
check('at least one offering is defined', ANCESTOR_OFFERINGS.length >= 1, ANCESTOR_OFFERINGS);
for (const id of ANCESTOR_OFFERINGS) {
  check(`offering ${id} exists in PLANT_CATALOG`, !!PLANT_CATALOG[id], id);
}

// The perk predicate (mirror of server ancestorBuffContrib): only the honored
// virtue's stat is lifted, only while the blessing is unexpired.
function ancestorBuff(buff, statKey, now) {
  if (!buff || !buff.until || buff.until <= now) return 0;
  return (buff.stat === statKey) ? (buff.amount || 0) : 0;
}
const v = ANCESTOR_VIRTUES[0];
const live = { stat: v.stat, amount: v.amount, until: 10_000 };
check('a live blessing lifts its own stat', ancestorBuff(live, v.stat, 5_000) === v.amount);
check('a live blessing lifts nothing else', ancestorBuff(live, v.stat === 'xp' ? 'power' : 'xp', 5_000) === 0);
check('an expired blessing lifts nothing', ancestorBuff(live, v.stat, 20_000) === 0);
check('no blessing = no perk', ancestorBuff(null, v.stat, 5_000) === 0);

// The daily gate (mirror of server): one rite per UTC day.
const dayIndex = (ms) => Math.floor(ms / 86400000);
check('same UTC day is gated', dayIndex(0) === dayIndex(3600000));
check('next UTC day reopens', dayIndex(0) !== dayIndex(90000000));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
