// A Stye on Wenna's practical half (NHS, "Stye"): a warm flannel, not hot,
// five to ten minutes two to four times a day; no squeezing; washed hands and
// her own towel; painkillers but no aspirin under sixteen; about a week; and
// when to get urgent help; and the lore put right from the texts: Hunt's word
// is "wilks", not "whilk", and the Mad Lover's line is the Fool's, angling for
// gold, in Fletcher's play acted at court in 1617.
const { CALLERS } = require('../data/callers.js');
const { STYE_CHARM } = require('../data/charms.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'the_stye');
check('the old scene kept: nine strokes, the complaining cat, Wenna giggling, the cat gone till supper', c && /Nine strokes of the tail, the cat complaining at every one and Wenna giggling/.test(c.resolution) && /does not come back until supper/.test(c.resolution) && c.steps[0].count === 9);
check('the caller\'s lore: "wilks", not "whilk"; Hunt\'s ram cat; the Fool\'s line and the gold; Fletcher, 1617', /"locally called 'wilks'"/.test(c.lore) && !/whilk/.test(c.lore) && /"If a ram cat, the cure is more certain"/.test(c.lore) && /the Fool says "I have a Stye here"/.test(c.lore) && /"I have no Gold to cure it"/.test(c.lore) && /J\. Fletcher, The Mad Lover \(acted 1617/.test(c.source));
check('the charm\'s lore: Hunt in full; the Fool angling, Chilax with gold in his purse; no "lover complains"', /"Those little gatherings which occur on the eye-lids of children, locally called 'wilks,' are cured by passing a black cat's tail nine times over the place\. If a ram cat, the cure is more certain\."/.test(STYE_CHARM.lore) && /the Fool angles for a coin: "I have a Stye here, Chilax\."/.test(STYE_CHARM.lore) && /"I have no Gold to cure it, not a penny\."/.test(STYE_CHARM.lore) && !/lover complains/.test(STYE_CHARM.lore) && /Fletcher/.test(STYE_CHARM.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
