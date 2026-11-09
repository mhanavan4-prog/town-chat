// In Memory and After the Law, read against their sources: Scotland's dead
// at the usual estimate; Hopkins's "hundred or so"; the Bideford three the
// last known for certain (Alice Molland, 1685, uncertain); Carrickfergus the
// only mass trial, not the last (Sellor, that September); the 2023 plaque at
// the Gobbins, not a "stone"; the First Minister's apology in her words;
// Shannon, not "V.", Devlin; the 1645 Chelmsford pamphlet; the Act's title;
// Bridget Cleary on the night of 15 March.
const { MEMORIAL, AFTER_THE_LAW: A } = require('../data/memorial.js');
const { MYTH_SETS } = require('../data/mythOrRecord.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const M = MEMORIAL.text;
check('Scotland: perhaps two and a half thousand, not "over fifteen hundred"', /In Scotland perhaps two and a half thousand died/.test(M) && !/fifteen hundred/.test(M));
check('Hopkins: "the hundred or so"; Bideford the last known for certain; Molland cited', /the hundred or so hanged on Matthew Hopkins's word/.test(M) && /the last in England known for certain to have been hanged/.test(M) && /M\. Stoyle, University of Southampton \(2024\), on Alice Molland/.test(MEMORIAL.sources));
check('Ireland: the only mass trial; the 2023 plaque at the Gobbins naming Sellor too', /the largest, its only mass trial, was at Carrickfergus/.test(M) && /In 2023 a plaque to them, and to William Sellor/.test(M) && !/memorial stone/.test(M));
check('the apology in the First Minister\'s words', /"to all those accused, convicted, vilified or executed"/.test(M));
check('Shannon Devlin, everywhere; the 1645 pamphlet', /S\. Devlin \(eds\)/.test(MEMORIAL.sources) && !/V\. Devlin/.test(MEMORIAL.sources + JSON.stringify(MYTH_SETS)) && /1613 and 1645/.test(MEMORIAL.sources));
check('After the Law: the 1735 Act passed in 1736; Cleary on the night of 15 March', /Witchcraft Act 1735 \(9 Geo\. 2 c\. 5\), passed in March 1736/.test(A.sources) && /on the night of 15 March 1895/.test(A.text));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
