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
check('the practical half: two or three days of protecting, rest, cold for twenty minutes every two or three hours, a bandage, the foot raised', /Then the practical half, and his mother had most of it right/.test(c.resolution) && /For the first two or three days/.test(c.resolution) && /ice or a bag of frozen peas in a tea towel, for up to twenty minutes every two or three hours/.test(c.resolution) && /a bandage round it in the day/.test(c.resolution) && /raised on a pillow/.test(c.resolution));
check('…not the fire: heat, drink and rubbing feed the swelling; paracetamol and ibuprofen gel; moving it once he can; no running for eight weeks', /But not the fire: heat, drink and rubbing it all feed the swelling in those first days/.test(c.resolution) && /Paracetamol for the pain, and ibuprofen gel for the swelling/.test(c.resolution) && /keep it moving so it doesn't stiffen/.test(c.resolution) && /no running on it for up to eight weeks/.test(c.resolution));
check('…111 if he can\'t bear weight or walk a few steps; 999 or A&E for a crack, a changed shape, numb, tingling, blue or cold', /Ring 111 if he can't put weight on it or walk more than a few steps/.test(c.resolution) && /999 or A&E if he heard a crack when he went over, it's out of shape, or the foot goes numb, tingling, blue or cold/.test(c.resolution) && /NHS, "Sprains and strains"/.test(c.source));
check('the caller\'s lore: the bystanders quoted, Caray in 1616, Grimm\'s comparison; no "oldest charm in German"', /"not to be heard by the bystanders"/.test(c.lore) && /Katherine Caray/.test(c.lore) && /Grimm set its words beside the Second Merseburg Charm/.test(c.lore) && !/oldest charm in German/.test(c.lore) && /Dalyell/.test(c.source));
const S = CHARMS.sprain;
check('the charm\'s lore: the NSA quoted, Caray\'s wresting thread "haill", the Merseburg text and its riders, Grimm in his own words', /"a thread spun from black wool, on which are cast nine knots"/.test(S.lore) && /"wald mak ony wrest of man or beast haill"/.test(S.lore) && /Phol and Wodan ride to the wood/.test(S.lore) && /"so he uuola conda"/.test(S.lore) && /"ben zi bena, bluot zi bluoda, lid zi geliden, sose gelimida sin"/.test(S.lore) && /"in conjuring formulas known to the country folk of Scotland and Denmark"/.test(S.lore) && !/oldest charm in German/.test(S.lore) && !/about 1841/.test(S.lore) && /Dalyell/.test(S.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
