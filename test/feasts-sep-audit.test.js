// The Turning Year, late August to October, read against its sources: Hone's
// Holy Rood in vol. I (1826), the Eton manuscript dated 1560, Poor Robin's
// couplet as usually printed, and the Bury man as a correspondent's
// recollection; the Horn Dance's reindeer "most likely" Scandinavian; the
// Statute of Artificers' year-long hiring as it applies to the crafts, and
// no groom's sponge; RTÉ's "pooka crawls on them"; Poor Robin's goose with
// Brand's commas.
const one = (o) => Object.values(o)[0];
const R = one(require('../data/holyRood.js').ROOD_RITES);
const H = one(require('../data/hornDance.js').HORN_RITES);
const M = one(require('../data/mopFair.js').MOP_RITES);
const G = one(require('../data/michaelmasGoose.js').GOOSE_RITES);
const { WHEEL_RITES } = require('../data/wheelRites.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
check('Holy Rood: Hone vol. I; 1560; Poor Robin; the Bury man recalled', /vol\. I \(1826\), 14 September/.test(R.source) && /An Eton manuscript of 1560/.test(R.lore) && /"The devil, as the common people say, \/ Doth go a nutting/.test(R.lore) && /a correspondent recalled a very old man at Bury St Edmunds/.test(R.lore));
check('the Horn Dance: "most likely" from Scandinavia', /most likely came from Scandinavia/.test(H.lore) && !/must have come/.test(H.lore));
check('the mop: the statute\'s crafts; no groom', /allowed no one in the crafts it named to be hired/.test(M.lore) && !/servant in husbandry to be hired "for any/.test(M.lore) && !/for a groom/.test(M.how));
const br = Object.values(WHEEL_RITES).find((r) => /pooka/.test(r.lore || ''));
check('the brambles: RTÉ\'s quotation', br && /the "pooka crawls on them"/.test(br.lore));
check('the goose: Poor Robin with Brand\'s commas', /Which, if well roasted, are good fare"/.test(G.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
