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
check('the practical half: the straw is kindling, the basket set back, a guard; the smooring set against "don\'t damp down"; embers out before bed', /Then the practical half, because a straw sheaf in a wicker basket sleeping by the fire is kindling/.test(c.resolution) && /Set the basket well back from the hearth/.test(c.resolution) && /a guard in front of the fire/.test(c.resolution) && /Her mother would have smoored the peats/.test(c.resolution) && /don't build the fire up or damp it down for the night, but see the embers properly out before bed/.test(c.resolution) && /The ashes will still be on the hearth to read/.test(c.resolution));
check('…ash in a metal can, checked daily; the chimney twice a year for peat; the 2022 alarm law and a CO detector; help for older homeowners; the free visit', /a metal ash can, and empty and check it every day/.test(c.resolution) && /every day/.test(c.resolution) && /swept twice a year/.test(c.resolution) && /interlinked smoke and heat alarms since February 2022/.test(c.resolution) && /carbon monoxide detector/.test(c.resolution) && /older homeowners/.test(c.resolution) && /0800 0731 999, or text FIRE to 80800/.test(c.resolution));
check('…cited: the fire service and mygov.scot', /Scottish Fire and Rescue Service/.test(c.source) && /mygov\.scot/.test(c.source) && /"Ancient and Modern Customs"/.test(c.source));
check('the lore: published 1703, found in the 1690s; no "around 1695"; Martin\'s own words', /publishing in 1703 what he had found in the Western Isles in the 1690s/.test(c.lore) && !/around 1695/.test(c.lore) && /"Another ancient custom observed on the second of February"/.test(c.lore) && /"and this they call Briid's-bed"/.test(c.lore) && /"a true presage of a good crop and prosperous year"/.test(c.lore));
const R = WHEEL_RITES.bridesbed;
check('the rite: Carmichael in 1900, the peeled white wand and Bride\'s footprint; no "in the 1890s"', /Carmichael, in 1900/.test(R.lore) && /"a small straight white wand \(the bark being peeled off\)"/.test(R.lore) && /"the footprint of Bride"/.test(R.lore) && !/in the 1890s/.test(R.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
