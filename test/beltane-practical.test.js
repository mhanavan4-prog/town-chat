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
check('the practical half: spring is wildfire time; small, controlled, never left; not in drought or wind, never on peat', /Then the practical half, because a fire on a hill in spring is the likeliest wildfire of the year/.test(c.resolution) && /four in five of Scotland's large outdoor fires come between March and May/.test(c.resolution) && /Keep it small, under control, and never left/.test(c.resolution) && /never on peat: peat burns on underground long after the top has gone out/.test(c.resolution));
check('…drowned with plenty of water, no trace; don\'t fight it, 999 and where you are; the Cairngorms ban', /drown it with far more water than you'd think, and leave no trace of it/.test(c.resolution) && /don't fight it: get clear, ring 999 for the fire service, and say exactly where you are/.test(c.resolution) && /Cairngorms National Park, fires and barbecues are banned from April to September/.test(c.resolution) && /given leave in writing/.test(c.resolution));
check('…the fox: the dead and afterbirth taken away without delay, as the sheep code says, and no unsupported lambing claims; snares banned since 2024, two dogs without a licence', /the sheep code says dead lambs and afterbirth are to be taken away and disposed of without delay/.test(c.resolution) && !/in-bye|draw the fox in|takes first/.test(c.resolution) && /snares have been banned in Scotland since November 2024/.test(c.resolution) && /no more than two dogs may be used without a licence from NatureScot/.test(c.resolution));
check('…cited: the Access Code, the fire service, the Cairngorms byelaw, the welfare code, the two Acts', /Scottish Outdoor Access Code/.test(c.source) && /Scottish Fire and Rescue Service/.test(c.source) && /Cairngorms National Park Authority/.test(c.source) && /Welfare of Sheep/.test(c.source) && /Muirburn \(Scotland\) Act 2024/.test(c.source) && /Hunting with Dogs \(Scotland\) Act 2023/.test(c.source));
check('the lore: Pennant recorded it, not saw it; his opening, "every one takes a cake", and the caudle eaten after', !/Pennant saw it/.test(c.lore) && /set down the herdsmen's Bel-tein/.test(c.lore) && /"On the 1st of May, the herdsmen of every village hold their Bel-tein, a rural sacrifice\."/.test(c.lore) && /"every one takes a cake of oatmeal, upon which are raised nine square knobs"/.test(c.lore) && /"When the ceremony is over, they dine on the caudle\."/.test(c.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
