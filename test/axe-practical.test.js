// The axe wound's practical half (NHS, "Cuts and grazes" and "Tetanus"; St
// John Ambulance, "Severe bleeding" and "Life-threatening bleed"; British Red
// Cross, "Bleeding heavily"), giving both answers where they differ on a soaked
// pad; and the blood verse's lore put right: Ezekiel 16:6 as the American
// bloodstopper's charm (Dorson, 1946 fieldwork), the opposite-sex rule as
// American, and Hunt's Zennor charmers, who kept theirs from the other sex.
const { CALLERS } = require('../data/callers.js');
const { CHARMS } = require('../data/charms.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'the_axe_slipped');
check('the old scene kept: the verse said while pressing, the surgeon sends for', c && /You say the verse while you press down on the wound with both hands/.test(c.resolution) && /whoever bound it saved the leg/.test(c.resolution) && c.steps[0].charm === 'blood');
check('the caller\'s lore: Ezekiel as the American charm, Dorson in 1946, Hunt\'s Zennor words; no "most widely recorded in English", no lumber country', /the American bloodstopper's charm/.test(c.lore) && /1946/.test(c.lore) && /Zennor/.test(c.lore) && !/most widely recorded/.test(c.lore) && !/lumber country/.test(c.lore) && /Zennor Charmers/.test(c.source));
const b = CHARMS.blood;
check('the blood charm: the opposite-sex rule given as American, Zennor\'s the other way; Hunt quoted and cited', b && /American bloodstoppers say it three times with the bleeder's full name, and hand it on man to woman to man/.test(b.use) && /Zennor kept theirs from the other sex/.test(b.use) && /"A man would not on any account tell his charm to a woman, or a woman communicate hers to a man\."/.test(b.lore) && /"Christ was born in Bethlehem; \/ Baptized in the river Jordan"/.test(b.lore) && /"with the lifesaving power to stop the flow of blood"/.test(b.lore) && !/best-known bloodstopping charm in English/.test(b.lore) && /Zennor Charmers/.test(b.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
