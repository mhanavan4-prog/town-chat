// St John's Eve's practical half: the all-night lamp among dry greenery (London
// Fire Brigade, "Candles"), and St John's wort as a real medicine (NHS; MHRA,
// 2014, on hormonal contraceptives) and a hazard to grazing stock (NADIS);
// with Stow's lamps quoted and his marching watch, laid down in 1539 and
// raised once more in 1548 (Survey of London, 1603, "Watches in London").
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'litha_st_johns_door');
check('the old scene kept: the door dressed, the lamp lit, the neighbours, the marching watch', c && /light the glass lamp in the doorway/.test(c.resolution) && /one of them has done his own door too/.test(c.resolution) && /tells you about the marching watch/.test(c.resolution));
check('the practical half: never a flame unwatched, out before bed; a stable heat-proof holder clear of the greenery; children and pets; a battery lamp', /Then the practical half, because a lamp burning all night in a doorway of dry greenery is how a street catches/.test(c.resolution) && /Never leave a flame burning when nobody's watching it: put it out when you go in, and before bed/.test(c.resolution) && /stable, heat-proof holder, well clear of the birch and the garlands/.test(c.resolution) && /out of reach of children and pets/.test(c.resolution) && /A battery lamp/.test(c.resolution));
check('…St John\'s wort as a medicine: the pill and implant, antidepressants, warfarin, epilepsy and HIV medicines; the pharmacist; not in pregnancy or breastfeeding', /it can stop the contraceptive pill or implant working/.test(c.resolution) && /antidepressants, blood-thinners such as warfarin, or epilepsy or HIV medicines/.test(c.resolution) && /tell the pharmacist before anyone takes it/.test(c.resolution) && /not at all in pregnancy or when breastfeeding/.test(c.resolution));
check('…and the grazing stock: it burns their skin in the sun', /Keep it from the horses and the sheep, too: grazed in quantity, it burns their skin in the sun/.test(c.resolution));
check('…cited: the Fire Brigade, the NHS, the MHRA, NADIS', /London Fire Brigade, "Candles"/.test(c.source) && /NHS, "Depression in adults: treatment"/.test(c.source) && /MHRA, Drug Safety Update \(March 2014\)/.test(c.source) && /NADIS/.test(c.source) && /"Watches in London"/.test(c.source));
check('the lore: Stow\'s lamps quoted, and the marching watch laid down in 1539, raised in 1548, unused since', /"Lampes of glasse, with oyle burning in them all the night"/.test(c.lore) && /1539/.test(c.lore) && /"which beeing once laide downe, was not raysed againe till the yeare 1548"/.test(c.lore) && /"hath not been vsed"/.test(c.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
