// The Beltane cake's practical half: a spring fire on the hill (Scottish
// Outdoor Access Code; Scottish Fire and Rescue Service; National Trust for
// Scotland on peat; the Cairngorms fire byelaw of 2026), and the fox (the
// Scottish sheep welfare code; snares banned from 25 November 2024; the
// two-dog limit of 2023); and Pennant quoted from the text, as a recorder of
// the custom rather than its witness.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'beltane_cake');
check('the old scene kept: trench, caudle, libation, the knobs and the fox last, the fold wall mended', c && /You cut the square trench, light the fire and stir the caudle/.test(c.resolution) && /the fox last and loudest/.test(c.resolution) && /mend the gap in the fold wall before dark/.test(c.resolution));
check('the lore: Pennant recorded it, not saw it; his opening, "every one takes a cake", and the caudle eaten after', !/Pennant saw it/.test(c.lore) && /set down the herdsmen's Bel-tein/.test(c.lore) && /"On the 1st of May, the herdsmen of every village hold their Bel-tein, a rural sacrifice\."/.test(c.lore) && /"every one takes a cake of oatmeal, upon which are raised nine square knobs"/.test(c.lore) && /"When the ceremony is over, they dine on the caudle\."/.test(c.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
