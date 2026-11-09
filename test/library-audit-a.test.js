// The Witch's Library, first half, read against its sources: Scot in his own
// words, not the DNB's paraphrase; the Malleus's bull only in some copies, and
// the denials and forgery as reported and argued, not fact; Bald's Leechbook
// as two books with a separate third; the eyesalve's finding exactly; Agrippa
// as a foundation, not the source of "most" tables; Gerard's page count and
// his woodblocks probably hired; the Lancaster Castle plot alleged in
// evidence, not a charge.
const { REAL_BOOKS } = require('../data/realBooks.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const B = (id) => REAL_BOOKS.find((b) => b.id === id);
check('Scot in his own words', /"in the behalfe of the poore, the aged, and the simple"/.test(B('scot').summary) && !/"poor, aged, and simple persons"/.test(B('scot').summary));
check('the Malleus: the bull in some copies; the denials reported, the forgery argued', /some copies with Innocent VIII's bull/.test(B('malleus').summary) && /a later report says two of the men/.test(B('malleus').fact) && /some historians think it was partly forged/.test(B('malleus').fact));
check('Bald\'s Leechbook: two parts and a separate third; no single ingredient alone', /in two parts, outer ailments and inner ailments, with a third, separate collection/.test(B('balds_leechbook').summary) && /not by any single ingredient alone/.test(B('balds_leechbook').fact));
check('Agrippa a foundation, not the source of "most" tables', !/most later tables/.test(B('agrippa').summary) && /Golden Dawn/.test(B('agrippa').summary));
check('Gerard: some 1,400 pages; the blocks probably hired', /some 1,400 pages/.test(B('gerard').summary) && /from Frankfurt, probably hired/.test(B('gerard').summary));
check('Potts: the castle plot alleged in evidence', /the evidence included an alleged plot to blow up Lancaster Castle/.test(B('potts').fact) && !/one charge was/.test(B('potts').fact));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
