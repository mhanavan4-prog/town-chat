// The wresting thread's practical half (NHS, "Sprains and strains"): his
// mother's binding, cold water and foot up kept, but not the fire, since heat
// feeds the swelling in the first days; and its lore put right: the New
// Statistical Account quoted, Katherine Caray's trial of 1616 (Dalyell), and
// Grimm's comparison with the Merseburg Charm as he made it, from Chambers
// (1842), in place of an unsourced "oldest charm in German".
const { CALLERS } = require('../data/callers.js');
const { CHARMS } = require('../data/charms.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'the_sprain');
check('the old scene kept: the thread, the words under the breath, his mother\'s other half', c && /You tie the knotted thread round his ankle and say the words under your breath/.test(c.resolution) && /foot up on a stool/.test(c.resolution));
check('the caller\'s lore: the bystanders quoted, Caray in 1616, Grimm\'s comparison; no "oldest charm in German"', /"not to be heard by the bystanders"/.test(c.lore) && /Katherine Caray/.test(c.lore) && /Grimm set its words beside the Second Merseburg Charm/.test(c.lore) && !/oldest charm in German/.test(c.lore) && /Dalyell/.test(c.source));
const S = CHARMS.sprain;
check('the charm\'s lore: the NSA quoted, Caray\'s wresting thread "haill", the Merseburg text and its riders, Grimm in his own words', /"a thread spun from black wool, on which are cast nine knots"/.test(S.lore) && /"wald mak ony wrest of man or beast haill"/.test(S.lore) && /Phol and Wodan ride to the wood/.test(S.lore) && /"so he uuola conda"/.test(S.lore) && /"ben zi bena, bluot zi bluoda, lid zi geliden, sose gelimida sin"/.test(S.lore) && /"in conjuring formulas known to the country folk of Scotland and Denmark"/.test(S.lore) && !/oldest charm in German/.test(S.lore) && !/about 1841/.test(S.lore) && /Dalyell/.test(S.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
