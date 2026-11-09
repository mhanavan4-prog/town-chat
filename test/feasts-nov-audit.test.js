// The Turning Year, late November and December, read against its sources:
// Hone's Cattern, St Andrew and St Thomas in vol. I (1826); the burnt-lace
// queen unnamed in 1862, Catherine named only later; Hone's Hasted shortened;
// Henry VIII's proclamation only in the words E. K. Chambers prints, and
// Hereford's revival in 1973; Crump cited for St Lucy; Addison's speaker his
// friend's wife, not an "old lady".
const one = (o) => Object.values(o)[0];
const C = one(require('../data/catterning.js').CATTERN_RITES);
const A = one(require('../data/stAndrew.js').ANDREW_RITES);
const T = one(require('../data/stThomas.js').THOMAS_RITES);
const L = one(require('../data/stLucy.js').LUCY_RITES);
const B = one(require('../data/boyBishop.js').BISHOP_RITES);
const CH = one(require('../data/childermas.js').CHILDERMAS_RITES);
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
check('Hone vol. I (1826) for Cattern, St Andrew and St Thomas', [C, A, T].every((r) => /Every-Day Book, vol\. I \(1826\)/.test(r.source) && !/vol\. II \(1827\)/.test(r.source)));
check('Cattern: the 1862 queen unnamed; no "probably far older"', /a queen "burnt all her lace, and ordered new to be made"/.test(C.lore) && !/Katharine of Aragon, who lived at Ampthill|probably far older/.test(C.lore));
check('St Andrew: Hone\'s version shortened and reworded', /shortened and reworded/.test(A.lore));
check('the Boy Bishop: Chambers\'s words only; Hereford 1973', /"decked and apparalid to counterfaite priestes, bysshopps, and women"/.test(B.lore) && !/strangelye|bleasing/.test(B.lore) && /Hereford revived the custom in 1973/.test(B.lore));
check('St Lucy: Crump cited; Childermas: the friend\'s wife', /Crump, The Christmas Encyclopedia \(2006\)/.test(L.source) && /his friend's wife/.test(CH.lore) && !/old lady/.test(CH.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
