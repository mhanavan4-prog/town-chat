// The Yule log's practical half (GOV.UK fire safety; London Fire Brigade;
// HETAS; Oxfordshire and Dorset & Wiltshire Fire and Rescue on hot ashes; NHS
// on burns and carbon monoxide; Healthier Together), with the saved brand
// cooled for days before it goes in the press; and Chambers (1864) on the brand
// as "a most effectual security to the house against fire", in place of an
// unchecked "classic early English account".
const { CALLERS } = require('../data/callers.js');
const { YULE_RITES } = require('../data/yule.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'yule_log');
check('the scene kept, but the brand doused and cooled in a tin for days before the eldest wraps it', c && /touch last year's brand to the new one/.test(c.resolution) && /douse it, and set it in a lidded tin out on the step, and days later, when it's cold through, the eldest wraps it up herself/.test(c.resolution) && !/In the morning you pull a sound piece from the ashes and she wraps it up/.test(c.resolution));
const R = YULE_RITES.yulelog;
check('Chambers on the kept brand against fire, in the caller and the rite; no unchecked "classic early English account"', /"it was believed that the preservation of last year's Christmas log was a most effectual security to the house against fire"/.test(c.lore) && /"it was believed that the preservation of last year's Christmas log was a most effectual security to the house against fire\."/.test(R.lore) && !/classic early English account/.test(R.lore) && /Chambers/.test(R.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
