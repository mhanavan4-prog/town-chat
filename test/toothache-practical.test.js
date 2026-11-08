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
check('the practical half: a dentist after two days or if painkillers fail, not the GP; ibuprofen or paracetamol, no aspirin under sixteen; salt water, not for children; soft food, nothing sweet, hot or cold', /if it hasn't eased in two days, the shilling is cheaper/.test(t.resolution) && /lasts more than two days, or won't go with painkillers, wants a dentist, not the doctor/.test(t.resolution) && /ibuprofen or paracetamol, and no aspirin for anyone under sixteen/.test(t.resolution) && /rinse with salt water, though not the children/.test(t.resolution) && /nothing sweet, very hot or very cold/.test(t.resolution));
check('…111 if there\'s no dentist; A&E for swelling to the eye or neck, or trouble breathing, swallowing or speaking; don\'t drive yourself', /If you can't get a dentist, ring 111/.test(t.resolution) && /swelling reaches the eye or the neck, or makes it hard to breathe, swallow or speak, go to A&E, and don't drive yourself/.test(t.resolution) && /NHS, "Toothache"/.test(t.source));
check('the caller\'s lore: one of the most widespread, not "the commonest"; Mary McLeod and Mull; the exact promise', !/commonest/.test(t.lore) && /one of the most widespread toothache charms/.test(t.lore) && /Mary McLeod/.test(t.lore) && /Mull/.test(t.lore) && /"shall never have the toothache\."/.test(t.lore));
check('the charm\'s lore: the eleventh-century Latin, worn round the neck, the Fylde\'s "foolish charm", Wilde\'s sewn-on version; no "commonest"', !/commonest/.test(CHARMS.tooth.lore) && /"Christus super marmoreum sedebat, Petrus tristes ante eum stabat"/.test(CHARMS.tooth.lore) && /"this charm was to be worn around the neck"/.test(CHARMS.tooth.lore) && /"a foolish charm, yet much accredited amongst us"/.test(CHARMS.tooth.lore) && /"to be sewn on the clothes"/.test(CHARMS.tooth.lore) && /Lancashire Folk-lore \(1867\)/.test(CHARMS.tooth.source));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
