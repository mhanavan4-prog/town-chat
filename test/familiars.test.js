// Familiars (data/familiars.js) — the bonded companion's passive perk maps onto
// an existing derived stat, so familiarBuffContrib can add it with no new combat
// math. Assert the data and the perk predicate the server uses.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { FAMILIARS, FAMILIAR_SKINS } = require('../data/familiars.js');

const ids = Object.keys(FAMILIARS);
check('four familiars defined', ids.length === 4, ids);
check('all have cat/raven/toad/hare', ['cat', 'raven', 'toad', 'hare'].every((k) => FAMILIARS[k]), ids);

// Every perk targets a real derived stat the stat system knows.
const STATS = new Set(['power', 'guard', 'vitality', 'haste', 'swift', 'leech', 'xp', 'forage']);
for (const id of ids) {
  const f = FAMILIARS[id];
  check(`${id} has name/emoji/blurb`, !!(f.name && f.emoji && f.blurb), f);
  check(`${id} perk targets a known stat`, STATS.has(f.stat), f.stat);
  check(`${id} perk amount is positive`, typeof f.amount === 'number' && f.amount > 0, f.amount);
}

// The perk predicate (mirror of server familiarBuffContrib): the chosen
// familiar's amount is added to its stat, and nothing to any other stat.
function familiarBuff(familiarId, statKey) {
  const f = familiarId && FAMILIARS[familiarId];
  return (f && f.stat === statKey) ? (f.amount || 0) : 0;
}
check('the cat lifts forage and nothing else', familiarBuff('cat', 'forage') === FAMILIARS.cat.amount && familiarBuff('cat', 'xp') === 0);
check('the hare lifts swift', familiarBuff('hare', 'swift') === FAMILIARS.hare.amount);
check('the toad lifts vitality', familiarBuff('toad', 'vitality') === FAMILIARS.toad.amount);
check('no familiar = no buff', familiarBuff(null, 'forage') === 0);
check('unknown familiar = no buff', familiarBuff('dragon', 'forage') === 0);

// Perks are spread across stats (not all the same one), so the choice matters.
const statsUsed = new Set(ids.map((id) => FAMILIARS[id].stat));
check('familiars steer toward different stats', statsUsed.size >= 3, [...statsUsed]);

// ── Familiar coats (cosmetic skins) ──
check('there is a coat palette', Array.isArray(FAMILIAR_SKINS) && FAMILIAR_SKINS.length >= 3);
check('a free natural (default) coat exists', FAMILIAR_SKINS.some((s) => s.id === 'default' && s.hex == null && !s.ms));
check('every premium coat has a hex and a positive price', FAMILIAR_SKINS.filter((s) => s.id !== 'default').every((s) => typeof s.hex === 'number' && s.ms > 0), FAMILIAR_SKINS);
check('coat ids are unique', new Set(FAMILIAR_SKINS.map((s) => s.id)).size === FAMILIAR_SKINS.length);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
