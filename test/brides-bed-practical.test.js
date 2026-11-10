// Bride's Bed's practical half (Scottish Fire and Rescue Service on open
// fires, ash and bedtime; the Scottish alarm law of February 2022; the free
// Home Fire Safety Visit), with the old smooring set against the fire
// service's "don't damp down"; and Martin's dating put right (published 1703,
// no "around 1695", no island named), with Carmichael's wand and footprint.
const { CALLERS } = require('../data/callers.js');
const { WHEEL_RITES } = require('../data/wheelRites.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'imbolc_brides_bed');
check('the old scene kept: the shawl, the peat basket, the club, the cry, the morning ashes', c && /dress the sheaf in her mother's old shawl and lay it in the peat basket with the club beside it/.test(c.resolution) && /Briid is come, Briid is welcome/.test(c.resolution) && /the house feels like her mother's again/.test(c.resolution));
check('the lore: published 1703, found in the 1690s; no "around 1695"; Martin\'s own words', /publishing in 1703 what he had found in the Western Isles in the 1690s/.test(c.lore) && !/around 1695/.test(c.lore) && /"Another ancient custom observed on the second of February"/.test(c.lore) && /"and this they call Briid's-bed"/.test(c.lore) && /"a true presage of a good crop and prosperous year"/.test(c.lore));
const R = WHEEL_RITES.bridesbed;
check('the rite: Carmichael in 1900, the peeled white wand and Bride\'s footprint; no "in the 1890s"', /Carmichael, in 1900/.test(R.lore) && /"a small straight white wand \(the bark being peeled off\)"/.test(R.lore) && /"the footprint of Bride"/.test(R.lore) && !/in the 1890s/.test(R.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
