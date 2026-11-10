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
check('the practical half: the forecast and turning back; boots and a waterproof; someone told; together and down before dark', /Then the practical half, for a parish on a mountain/.test(c.resolution) && /Check the forecast before you go, and be ready to turn back/.test(c.resolution) && /boots for wet, rough ground, and a waterproof/.test(c.resolution) && /Tell someone at home your way up and when you'll be down/.test(c.resolution) && /leave time to be down before dark/.test(c.resolution));
check('…999 or 112 and ask for Mountain Rescue, as Mountaineering Ireland says; six whistle blasts', /ring 999 or 112 and ask for Mountain Rescue/.test(c.resolution) && /six blasts on a whistle/.test(c.resolution));
check('…ticks: tucked trousers, DEET, the children\'s hairlines; fine tweezers, slowly, no crushing; a round red rash or fever to the GP', /trousers tucked into socks, a repellent with DEET/.test(c.resolution) && /the children's heads and hairlines/.test(c.resolution) && /fine tweezers, gripped close to the skin and pulled slowly up without crushing it/.test(c.resolution) && /a round red rash about it in the weeks after, or a fever, is a reason to see the GP/.test(c.resolution));
check('…berries you\'re sure of; the Poisons line, 01 809 2166, eight till ten; cited', /eat only the berries you're sure of/.test(c.resolution) && /01 809 2166, eight in the morning till ten at night/.test(c.resolution) && /Mountaineering Ireland/.test(c.source) && /HSE, "Lyme disease"/.test(c.source) && /National Poisons Information Centre/.test(c.source));
check('the lore: the date between July and August; the boys\' bracelets quoted; MacNeill\'s "most lasting"; through Sexton', /between the last Sunday of July and the first Sunday of August/.test(c.lore) && /"the boys strung the berries with straw, rushes or thread to make bracelets and necklaces for their sweethearts"/.test(c.lore) && /"no custom has been more lasting than the picking of bilberries"/.test(c.lore) && /Sexton/.test(c.source));
const R = WHEEL_RITES.bilberries;
check('the rite: MacNeill\'s eighty names and her line; no "195 places", no "1942"', /more than eighty local names/.test(R.lore) && /"no custom has been more lasting than the picking of bilberries"/.test(R.lore) && !/195/.test(R.lore) && !/1942/.test(R.lore + R.source) && R.tier === 'folk');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
