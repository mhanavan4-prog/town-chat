// Pace Eggs: the practical half for eggs rolled through the grass (NHS on
// toxocariasis and washing hands; the Food Standards Agency's two hours and
// two days; whin flowers for colour only; egg allergy in small children);
// and the lore read from Hone and the Scottish National Dictionary, the Scots
// days (Pace Saturday, Pasch Sunday) set beside Preston's Easter Monday, and
// the unconfirmed "north-east whin" claim replaced by Aberdeen's 1958 flowers.
const { CALLERS } = require('../data/callers.js');
const { WHEEL_RITES } = require('../data/wheelRites.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'ostara_pace_eggs');
check('the old scene kept: onion-brown and whin-yellow, the broken ones eaten, the Hartleys cried', c && /Onion-brown and whin-yellow, hard as stones/.test(c.resolution) && /eat every broken one on the way home/.test(c.resolution) && /The Hartleys, they report, cried/.test(c.resolution));
check('the caller\'s lore: Hone\'s onion and grass, the 1827 braes on Pasch Sunday, Preston "since, it says, 1867"', /"within the coat of an onion"/.test(c.lore) && /"roll them on the grass"/.test(c.lore) && /"for the bairns to … row on the braes on Pasch Sunday"/.test(c.lore) && /since, it says, 1867/.test(c.lore));
const R = WHEEL_RITES.paceeggs;
check('the rite: Pace Saturday 1834, Aberdeen\'s flowers 1958, Preston\'s Easter Monday "said to have begun"; no north-east whin claim', /"Pace Saturday"/.test(R.lore) && /"We eest tae gaither the flooers tae colour oor pess eggs"/.test(R.lore) && /said to have begun in 1867/.test(R.lore) && !/Children in the north-east gathered whin blossom/.test(R.lore) && /Pasch/.test(R.lore) && /Preston City Council/.test(R.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
