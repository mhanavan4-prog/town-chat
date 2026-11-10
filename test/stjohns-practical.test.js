// St John's Eve's practical half: the all-night lamp among dry greenery (London
// Fire Brigade, "Candles"), and St John's wort as a real medicine (NHS; MHRA,
// 2014, on hormonal contraceptives) (the grazing-stock line, unchecked, was dropped);
// with Stow's lamps quoted and his marching watch, laid down in 1539 and
// raised once more in 1548 (Survey of London, 1603, "Watches in London").
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'litha_st_johns_door');
check('the old scene kept: the door dressed, the lamp lit, the neighbours, the marching watch', c && /light the glass lamp in the doorway/.test(c.resolution) && /one of them has done his own door too/.test(c.resolution) && /tells you about the marching watch/.test(c.resolution));
check('…and the unchecked grazing-stock line dropped', !/burns their skin in the sun/.test(c.resolution) && !/NADIS/.test(c.source));
check('the lore: Stow\'s lamps quoted, and the marching watch laid down in 1539, raised in 1548, unused since', /"Lampes of glasse, with oyle burning in them all the night"/.test(c.lore) && /1539/.test(c.lore) && /"which beeing once laide downe, was not raysed againe till the yeare 1548"/.test(c.lore) && /"hath not been vsed"/.test(c.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
