// Kitchen witchcraft (data/teas.js) — the tea recipes, the planetary-day
// duration bonus, and the tea-buff predicate the server uses.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { TEAS, TEA_DAY_BONUS } = require('../data/teas.js');
const { PLANT_CATALOG } = require('../data/world.js');

const STATS = new Set(['power', 'guard', 'vitality', 'haste', 'swift', 'leech', 'xp', 'forage']);

// ── Recipes ───────────────────────────────────────────────────────────────────
check('teas are defined', TEAS.length >= 3, TEAS.length);
check('a day steeps longer than base', TEA_DAY_BONUS > 1, TEA_DAY_BONUS);
for (const t of TEAS) {
  check(`${t.id} has name/emoji/blurb`, !!(t.name && t.emoji && t.blurb), t);
  check(`${t.id} brews from real herbs`, (t.herbs || []).every((h) => PLANT_CATALOG[h.id] && h.qty > 0), t.herbs);
  check(`${t.id} buffs a known stat`, STATS.has(t.stat) && t.amount > 0, { stat: t.stat, amount: t.amount });
  check(`${t.id} has a planetary day 0-6`, t.day >= 0 && t.day <= 6, t.day);
  check(`${t.id} lasts a real while`, t.hours > 0, t.hours);
}

// ── The day bonus (mirror of the brew handler) ───────────────────────────────
function durationMs(tea, utcDay) {
  const onDay = (utcDay === tea.day);
  return Math.round(tea.hours * 3600000 * (onDay ? TEA_DAY_BONUS : 1));
}
const tea = TEAS[0];
const base = durationMs(tea, (tea.day + 1) % 7);
const boosted = durationMs(tea, tea.day);
check('brewing on its planetary day lasts longer', boosted > base, { base, boosted });
check('the boost is exactly TEA_DAY_BONUS', Math.abs(boosted / base - TEA_DAY_BONUS) < 1e-6, boosted / base);

// ── The tea-buff predicate (mirror of teaBuffContrib) ────────────────────────
function teaBuff(buff, statKey, now) {
  if (!buff || !buff.until || buff.until <= now) return 0;
  return (buff.stat === statKey) ? (buff.amount || 0) : 0;
}
const now = 1000000;
const live = { stat: 'forage', amount: 0.1, until: now + 60000 };
check('a live tea buffs its stat', teaBuff(live, 'forage', now) === 0.1);
check('a live tea buffs nothing else', teaBuff(live, 'xp', now) === 0);
check('an expired tea buffs nothing', teaBuff({ stat: 'forage', amount: 0.1, until: now - 1 }, 'forage', now) === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
