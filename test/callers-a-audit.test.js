// Callers 1–8, read against their sources: Ruth Osborne refused buttermilk
// in 1745 and ducked at Long Marston in 1751; Henderson's rowan rhyme and
// the byre twig kept apart; the coral with bells as a guard against spirits,
// not a teething charm; Allice Swan's penance in the documented words; Scot's
// "slight of the fingers"; Keith Thomas, unconfirmed, dropped; CheckMEND, not
// "pawnbrokers check registers"; the NHS nosebleed wording; the Shipping
// Forecast as it now runs; Bessy Millie from Scott's own note.
const { CALLERS } = require('../data/callers.js');
const arr = Array.isArray(CALLERS) ? CALLERS : Object.values(CALLERS);
const C = (id) => arr.find((c) => c.id === id);
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const b = C('butter_wont_come');
check('butter: Osborne 1745 and 1751; the rhyme and the twig kept apart', /near Tring in 1745 Ruth Osborne/.test(b.resolution) && /in 1751 a crowd ducked her in a pond at Long Marston/.test(b.resolution) && /Henderson quotes the old rhyme/.test(b.lore) && !/Henderson's rhyme/.test(b.lore));
check('the sleepless child: the coral against spirits', /'would scare away evil spirits from the child'/.test(C('sleepless_child').lore) && !/a coral with bells \(Lancashire, 1867\)/.test(C('sleepless_child').lore));
const r = C('stolen_ring');
check('the stolen ring: Swan\'s words, Scot\'s slight, no Thomas, CheckMEND', /'to cast or tourne the riddle and sheares'/.test(r.lore) && /'slight of the fingers'/.test(r.lore) && !/Thomas/.test(r.lore + r.source) && /CheckMEND/.test(r.resolution));
check('the yarrow dream: the NHS\'s "large amount of blood that makes you vomit"', /swallowing a large amount of blood that makes you vomit/.test(C('dream_of_him').resolution));
const s = C('northern_staves');
check('the staves: the forecast as it now runs; Bessy Millie from Scott', /after midnight and early each morning, and at 17:54 at weekends/.test(s.resolution) && !/12:01/.test(s.resolution) && /Bessy Millie sold/.test(s.lore) && /Scott, The Pirate \(1822\), note/.test(s.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
