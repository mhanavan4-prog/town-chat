// Cast the Old Staves: the practical half, first for the reader (paid
// readings are held to consumer protection law, since April 2025 the Digital
// Markets, Competition and Consumers Act: no misleading the customer), then
// for the voyage (the shipping forecast's times; beacon registration; the
// Sailors' Society); and the lore put right: Tacitus quoted in Church and
// Brodribb, the Vimose comb dated, Blum's 1982 book, and Bessie Millie's
// winds in place of an unsourced claim about sailors and cunning folk.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'northern_staves');
check('the old scene kept: three staves, read honestly, foreign silver, whistling to the harbour', c && /Three staves, drawn one at a time/.test(c.resolution) && /the hard one too/.test(c.resolution) && /goes down to the harbour whistling/.test(c.resolution));
check('the lore: Tacitus in Church and Brodribb\'s words; "each piece three times"; the Vimose comb c. 160; Blum 1982; Bessie Millie\'s winds; no "faithful customers"', /"A little bough is lopped off a fruit-bearing tree, and cut into small pieces; these are distinguished by certain marks, and thrown carelessly and at random over a white garment"/.test(c.lore) && /"takes up each piece three times"/.test(c.lore) && /Vimose comb, are from about AD 160/.test(c.lore) && /Blum's book of 1982/.test(c.lore) && /"favourable winds to mariners"/.test(c.lore) && !/faithful customers/.test(c.lore) && !/drawn three at a time/.test(c.lore) && c.tier === 'revival');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
