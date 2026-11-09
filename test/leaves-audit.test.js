// Reading the Leaves, read against A Highland Seer's book (Gutenberg #18241):
// the meanings that had been softened or added to are put back to the book
// (the cross "or even death", the clouded anchor read in reverse, the bird's
// "good" news, the fish's dots, the serpent's illness, no added "take care");
// and the provenance no longer calls the symbol dictionaries Victorian and
// Edwardian, nor gives the undated book a firm date.
const { LEAF_SYMBOLS, LEAVES_LORE } = require('../data/leaves.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const m = (k) => LEAF_SYMBOLS.find((s) => s.key === k).meaning;
check('still all 26 symbols', LEAF_SYMBOLS.length === 26);
check('the cross: "or even death"', /or even death/.test(m('cross')));
check('the anchor: clouded, read the reverse', /clouded, read the reverse/.test(m('anchor')) && !/unless it lies clouded/.test(m('anchor')));
check('the bird: good news if flying', /Flying, it brings good news/.test(m('bird')));
check('the fish: dots mean emigration; the serpent: illness', /ringed with dots, emigration/.test(m('fish')) && /illness/.test(m('serpent')));
check('the hourglass: no added "take care"', m('hourglass') === 'A peril close at hand.');
check('the provenance: turn of the 20th century, not Victorian and Edwardian; the book undated', !/Victorian and Edwardian/.test(LEAVES_LORE.provenance) && /turn of the 20th century/.test(LEAVES_LORE.provenance) && /undated, c\. 1920/.test(LEAVES_LORE.provenance));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
