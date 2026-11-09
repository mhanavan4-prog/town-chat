// The Witch's Library, second half, read against its sources: Murray took
// "esbat" from a French trial record rather than coining it; Lamb's line as
// the Every-Day Book reprints it, and the dedication to both Lambs; Mathers's
// Key printed in 1889 (preface October 1888); Robertson's finding on
// Carmichael in his own terms.
const { REAL_BOOKS } = require('../data/realBooks.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const B = (id) => REAL_BOOKS.find((b) => b.id === id);
check('Murray: "esbat" from de Lancre\'s trial record, not coined', !/coined/.test(B('murray').fact) && /from a French trial record \(de Lancre, 1612\)/.test(B('murray').fact));
check('Hone: both Lambs; the poem as the Every-Day Book has it', /Charles Lamb and his sister Mary/.test(B('hone').fact) && /"I like you, and your book ingenuous Hone!"/.test(B('hone').fact));
check('the Key: 1889, preface dated October 1888', /edition 1889/.test(B('key_of_solomon').date) && /Redway, 1889; preface dated October 1888/.test(B('key_of_solomon').source));
check('Carmichael: Robertson argued, in his own terms', /Hamish Robertson argued that hardly a text he checked had not been touched up/.test(B('carmichael').fact) && !/showed that he touched up nearly every text/.test(B('carmichael').fact));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
