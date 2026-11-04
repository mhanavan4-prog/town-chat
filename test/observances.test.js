// Observance registry (data/ancestors.js → Wheel of the Year). The solitary
// seasonal rite is now season-keyed: OBSERVANCES[seasonKey] + observanceForSeason().
// Samhain must stay identical to the back-compat exports (no regression to the
// live Ancestor Altar), and the selector must open only a season that actually
// has an observance populated.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { OBSERVANCES, observanceForSeason, ANCESTOR_OFFERINGS, ANCESTOR_VIRTUES, ANCESTOR_BLESSING_HOURS } = require('../data/ancestors.js');
const { PLANT_CATALOG } = require('../data/world.js');

// All eight sabbats of the Wheel should now have a solitary observance.
const SABBATS = ['samhain', 'yule', 'imbolc', 'ostara', 'beltane', 'litha', 'lughnasadh', 'mabon'];
for (const s of SABBATS) check(`observance populated: ${s}`, !!OBSERVANCES[s], s);

check('OBSERVANCES is a map', !!OBSERVANCES && typeof OBSERVANCES === 'object');
check('samhain observance exists', !!OBSERVANCES.samhain);

const sam = OBSERVANCES.samhain;
// Samhain is the SAME data the back-compat exports carry — the live altar keeps
// serving exactly what it did before the registry.
check('samhain offerings === back-compat export', sam.offerings === ANCESTOR_OFFERINGS);
check('samhain virtues === back-compat export', sam.virtues === ANCESTOR_VIRTUES);
check('samhain hours === back-compat export', sam.blessingHours === ANCESTOR_BLESSING_HOURS, sam.blessingHours);
check('samhain seasonKey is samhain', sam.seasonKey === 'samhain');
check('samhain has altar name + glyph', !!(sam.altarName && sam.glyph));
check('samhain carries panel flavor', !!(sam.text && sam.text.hint && sam.text.closed && sam.text.setButton));

// The selector opens only a season that has an observance.
check('selector returns samhain for samhain', observanceForSeason('samhain') === sam);
check('selector returns the matching observance per sabbat', SABBATS.every((s) => observanceForSeason(s) === OBSERVANCES[s]));
check('selector is null off-season / for junk', observanceForSeason(null) === null && observanceForSeason('nope') === null && observanceForSeason('spring') === null);

// Every observance in the registry is well-formed — this catches a missing
// field the moment the other seven sabbats are added as data.
const STATS = new Set(['power', 'guard', 'vitality', 'haste', 'swift', 'leech', 'xp', 'forage']);
for (const key of Object.keys(OBSERVANCES)) {
  const o = OBSERVANCES[key];
  check(`${key}: seasonKey matches its map key`, o.seasonKey === key, o.seasonKey);
  check(`${key}: blessingHours >= 1`, typeof o.blessingHours === 'number' && o.blessingHours >= 1, o.blessingHours);
  check(`${key}: >= 1 offering`, Array.isArray(o.offerings) && o.offerings.length >= 1);
  // Every offering must be a real, obtainable item (the phantom-item lesson
  // from #583) — the rite must never ask for something not in the catalog.
  for (const id of o.offerings) check(`${key}: offering ${id} exists`, !!PLANT_CATALOG[id], id);
  check(`${key}: has an altar name + glyph`, !!(o.altarName && o.glyph), key);
  check(`${key}: carries panel flavor`, !!(o.text && o.text.hint && o.text.closed && o.text.setButton && o.text.setButton), key);
  check(`${key}: >= 1 virtue`, Array.isArray(o.virtues) && o.virtues.length >= 1);
  const ids = new Set();
  for (const v of o.virtues) {
    check(`${key}/${v.id}: name+emoji+line`, !!(v.name && v.emoji && v.line), v);
    check(`${key}/${v.id}: known stat`, STATS.has(v.stat), v.stat);
    check(`${key}/${v.id}: positive amount`, typeof v.amount === 'number' && v.amount > 0, v.amount);
    check(`${key}/${v.id}: unique id`, !ids.has(v.id), v.id); ids.add(v.id);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
