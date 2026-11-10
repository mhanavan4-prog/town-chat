// Callers 17–24, read against their sources: the 1697 Cummertrees case as
// Wood prints it (a sack of provisions; the Presbytery's sentence; one
// spelling of M'Kinnell) and Napier's key, Tylor's verse wording credited;
// the scald's charmers not said to take nothing (Courtney's made an income);
// the bleeding pad as each authority gives it; Scot's "slight of the
// fingers", Jonson's comma and Mather as reprinted.
const { CALLERS } = require('../data/callers.js');
const arr = Array.isArray(CALLERS) ? CALLERS : Object.values(CALLERS);
const C = (id) => arr.find((c) => c.id === id);
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const k = C('cheese_and_herrings');
check('the key and Bible: Wood\'s sack of provisions, the Presbytery, M\'Kinnell, Tylor\'s wording', /a sack of provisions, cheese and herrings by the museum's account/.test(k.lore) && !/"containing some cheese and herrings"/.test(k.lore) && /the Presbytery of Dumfries appointed him/.test(k.lore) && !/M'Kinnel of Bankend/.test(k.lore) && /\(Tylor's wording\)/.test(k.lore) && !/door key/.test(k.lore));
const s = C('the_scald');
check('the scald: no "traditionally took nothing"', !/traditionally took nothing/.test(s.lore) && /made a good income by it/.test(s.lore));
const sp = C('silver_spoons');
check('the spoons: Scot, Jonson and Mather as printed', /'slight of the fingers'/.test(sp.lore) && /"searching for things lost, with a sieve and shears"/.test(sp.lore) && /'detestable Conjurations, with Sieves, and Keys' \(1693, as reprinted\)/.test(sp.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
