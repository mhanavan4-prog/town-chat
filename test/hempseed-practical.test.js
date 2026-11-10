// Hemp-Seed on Midsummer Eve: the practical half is the law's, since hemp is
// cannabis (Misuse of Drugs Act 1971, s. 6; Home Office industrial hemp
// licensing, 2025); and the lore put right: no midnight, which neither Gay
// ("At eve") nor Hunt gives; Hunt's "not especially a Cornish superstition";
// Gay's girl who "look'd back"; and Burns's Scottish Hallowe'en version, over
// the left shoulder.
const { CALLERS } = require('../data/callers.js');
const { WHEEL_RITES } = require('../data/wheelRites.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'litha_hemp_seed');
check('the scene kept, on Midsummer Eve after dark, not at midnight', c && c.title === 'Hemp-Seed on Midsummer Eve' && /in the dark on my own/.test(c.plea) && !/midnight/.test(c.plea + c.title + c.steps[0].label) && /the miller's son/.test(c.resolution));
check('the caller\'s lore: Hunt\'s "not especially a Cornish superstition"; no "the Cornish words"; Burns\'s Hallowe\'en', /"is not especially a Cornish superstition"/.test(c.lore) && !/the Cornish words/.test(c.lore) && /Burns made it a Hallowe'en charm/.test(c.lore));
const R = WHEEL_RITES.hempseed;
check('the rite: after dark, not midnight; Gay\'s look back and the scythe; Hunt not especially Cornish; Burns\'s left shoulder and the pulling of hemp', /After dark on Midsummer Eve/.test(R.how) && !/midnight/.test(R.how) && /"I strait look'd back, and if my eyes speak truth, \/ With his keen scythe behind me came the youth\."/.test(R.lore) && /"is not especially a Cornish superstition"/.test(R.lore) && /"over your left shoulder"/.test(R.lore) && /"in the attitude of pulling hemp"/.test(R.lore) && /Burns/.test(R.source) && /Midsummer Superstitious Customs/.test(R.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
