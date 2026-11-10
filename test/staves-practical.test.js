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
check('the practical half: the reader\'s first, under consumer law since 2008 and the 2024 Act from April 2025; a reading never a promise', /Then the practical half, and the first of it is yours/.test(c.resolution) && /since April 2025 under the Digital Markets, Competition and Consumers Act: you may not mislead him/.test(c.resolution) && /a reading is a reading and never a promise that the Marta will come home/.test(c.resolution));
check('…the shipping forecast\'s times; the beacon registered, free, a quarter hour, the law for UK ships; the Sailors\' Society round the clock', /on Radio 4 after midnight and early each morning, and at 17:54 at weekends/.test(c.resolution) && /Register her emergency beacon with the UK Beacon Registry, which is free, takes a quarter of an hour, and is the law for UK ships/.test(c.resolution) && /the Sailors' Society gives seafarers and their families support around the clock/.test(c.resolution));
check('the lore: Tacitus in Church and Brodribb\'s words; "each piece three times"; the Vimose comb c. 160; Blum 1982; Bessie Millie\'s winds; no "faithful customers"', /"A little bough is lopped off a fruit-bearing tree, and cut into small pieces; these are distinguished by certain marks, and thrown carelessly and at random over a white garment"/.test(c.lore) && /"takes up each piece three times"/.test(c.lore) && /Vimose comb, are from about AD 160/.test(c.lore) && /Blum's book of 1982/.test(c.lore) && /"favourable winds to mariners"/.test(c.lore) && !/faithful customers/.test(c.lore) && !/drawn three at a time/.test(c.lore) && c.tier === 'revival');
check('…cited: the translators, Rundata, Blum, Stromness, the 2025 commencement order, the Met Office, the beacon registry, the Sailors\' Society', /Church & W\. J\. Brodribb \(1877\)/.test(c.source) && /Rundata/.test(c.source) && /Blum/.test(c.source) && /Scott, The Pirate \(1822\), note, on Bessy Millie/.test(c.source) && /SI 2025\/272/.test(c.source) && /Met Office/.test(c.source) && /406 MHz beacon/.test(c.source) && /Sailors' Society/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
