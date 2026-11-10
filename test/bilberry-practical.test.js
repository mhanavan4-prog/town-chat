// Bilberry Sunday's practical half: a parish on the mountain (Mountaineering
// Ireland), ticks (HSE, "Lyme disease"), and berries a child takes for fruit
// (National Poisons Information Centre, 01 809 2166); with MacNeill quoted
// through Sexton (RTÉ, 2025), and the "195 places" and "1942" that only
// Wikipedia gives left out.
const { CALLERS } = require('../data/callers.js');
const { WHEEL_RITES } = require('../data/wheelRites.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'lughnasadh_bilberry_sunday');
check('the old scene kept: purple hands, the rush, the bracelet by the cairn', c && /The whole parish is on the mountain with purple hands/.test(c.resolution) && /thread them on a rush without bursting them/.test(c.resolution) && /beside the cairn/.test(c.resolution));
check('the lore: the date between July and August; the boys\' bracelets quoted; MacNeill\'s "most lasting"; through Sexton', /between the last Sunday of July and the first Sunday of August/.test(c.lore) && /"the boys strung the berries with straw, rushes or thread to make bracelets and necklaces for their sweethearts"/.test(c.lore) && /"no custom has been more lasting than the picking of bilberries"/.test(c.lore) && /Sexton/.test(c.source));
const R = WHEEL_RITES.bilberries;
check('the rite: MacNeill\'s eighty names and her line; no "195 places", no "1942"', /more than eighty local names/.test(R.lore) && /"no custom has been more lasting than the picking of bilberries"/.test(R.lore) && !/195/.test(R.lore) && !/1942/.test(R.lore + R.source) && R.tier === 'folk');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
