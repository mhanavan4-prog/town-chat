// Coven Rites — content integrity across the whole Wheel of the Year. Pure
// data validation: every sabbat has a rite, every creature a rite names is one
// the server actually credits (the MOB2/MOB3/CRITTER2 pools hooked by
// riteCredit), every harvested herb is one that grows in the Wilds, every
// reward title resolves, and the phase shape is sound. This catches a typo'd
// creature or herb id — which would otherwise be a silently uncompletable Rite.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { RITES } = require('../data/rites.js');
const { SABBATS } = require('../data/seasons.js');
const { TITLES } = require('../data/titles.js');
const { MOB2_TYPES, MOB3_TYPES, CRITTER2_TYPES } = require('../data/creatures.js');

// The creatures riteCredit can actually count: the Wilds mob + critter pools
// (the Delve reuses these ids, so the dungeon hook is a subset).
const VALID_CREATURES = new Set([...Object.keys(MOB2_TYPES), ...Object.keys(MOB3_TYPES), ...Object.keys(CRITTER2_TYPES)]);
// Herbs that grow in the Wilds and credit via harvest_specific (the set the
// side-quests also forage). Harvesting only credits a Rite in room 'wilds'.
const WILDS_HERBS = new Set(['healing_herb', 'meditation_lotus', 'rainbow_petal', 'ravens_feather_plant', 'swift_root', 'toadstool']);

// 1) Every sabbat on the wheel has an authored rite.
for (const s of SABBATS) {
  check(`sabbat "${s.key}" has a rite`, !!RITES[s.key], Object.keys(RITES));
}
check('all 8 sabbats are covered', Object.keys(RITES).length === SABBATS.length, Object.keys(RITES).length);

// 2) Each rite is well-formed, and every id/title/creature/herb is real.
const seenIds = new Set();
for (const [key, r] of Object.entries(RITES)) {
  check(`${key}: seasonKey matches its sabbat`, r.seasonKey === key, r.seasonKey);
  check(`${key}: has a unique rite id`, r.id && !seenIds.has(r.id), r.id);
  seenIds.add(r.id);
  check(`${key}: has a name and glyph`, !!r.name && !!r.glyph);
  check(`${key}: grants a season buff`, r.seasonBuff === true);
  check(`${key}: reward title "${r.reward && r.reward.titleId}" exists`, !!(r.reward && TITLES[r.reward.titleId]), r.reward && r.reward.titleId);

  check(`${key}: has exactly 3 phases`, Array.isArray(r.phases) && r.phases.length === 3, r.phases && r.phases.length);
  const candlePhases = (r.phases || []).filter(p => p.candles);
  check(`${key}: has exactly one candle phase`, candlePhases.length === 1, candlePhases.length);
  check(`${key}: phase 1 opens immediately (gate 0)`, r.phases[0].gateHours === 0, r.phases[0].gateHours);

  (r.phases || []).forEach((ph, i) => {
    if (ph.candles) {
      check(`${key}.${ph.id}: candle phase is gated`, i === 0 || ph.gateHours > 0);
      return;
    }
    check(`${key}.${ph.id}: has objectives`, Array.isArray(ph.objectives) && ph.objectives.length >= 1);
    for (const o of (ph.objectives || [])) {
      check(`${key}.${ph.id}.${o.key}: valid kind`, o.kind === 'kill_creature' || o.kind === 'harvest_specific', o.kind);
      if (o.kind === 'kill_creature') {
        check(`${key}.${ph.id}.${o.key}: "${o.match}" is a huntable creature`, VALID_CREATURES.has(o.match), o.match);
      } else {
        check(`${key}.${ph.id}.${o.key}: "${o.match}" is a Wilds herb`, WILDS_HERBS.has(o.match), o.match);
      }
      check(`${key}.${ph.id}.${o.key}: has a positive target base`, (o.base | 0) >= 1 && (o.perMember | 0) >= 0);
      check(`${key}.${ph.id}.${o.key}: caps one member below the whole`, o.maxShare > 0 && o.maxShare < 1, o.maxShare);
    }
  });
}

// 3) Every title in the catalog is complete (name/glyph/desc/from).
for (const [id, t] of Object.entries(TITLES)) {
  check(`title "${id}" is complete`, !!(t.name && t.glyph && t.desc && t.from), t);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
