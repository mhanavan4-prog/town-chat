// The toothache caller's practical half (NHS, "Toothache") and the charm's
// lore put right (the Science Museum's paper; Harland and Wilkinson, 1867;
// Lady Wilde, 1887; Ķencis on the Latin): no feverfew, which neither Gerard
// nor Culpeper gave for teeth, and no "commonest in Britain and Ireland".
const { CALLERS } = require('../data/callers.js');
const { CHARMS } = require('../data/charms.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const t = CALLERS.find((c) => c.id === 'the_toothache');
check('the charm is still written out, and feverfew is gone from her errand', t && t.steps.length === 1 && t.steps[0].charm === 'tooth' && !/feverfew/i.test(t.resolution + JSON.stringify(t.steps)));
check('the caller\'s lore: one of the most widespread, not "the commonest"; Mary McLeod and Mull; the exact promise', !/commonest/.test(t.lore) && /one of the most widespread toothache charms/.test(t.lore) && /Mary McLeod/.test(t.lore) && /Mull/.test(t.lore) && /"shall never have the toothache\."/.test(t.lore));
check('the charm\'s lore: the eleventh-century Latin, worn round the neck, Harland and Wilkinson\'s section, Wilde\'s sewn-on version; no "commonest"', !/commonest/.test(CHARMS.tooth.lore) && /"Christus super marmoreum sedebat petrus tristes ante eum stabat"/.test(CHARMS.tooth.lore) && /"this charm was to be worn around the neck"/.test(CHARMS.tooth.lore) && /"Charms for the Toothache"/.test(CHARMS.tooth.lore) && !/Fylde|accredited/.test(CHARMS.tooth.lore) && /"to be sewn on the clothes"/.test(CHARMS.tooth.lore) && /Lancashire Folk-lore \(1867\)/.test(CHARMS.tooth.source));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
