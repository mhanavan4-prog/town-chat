// Before Michaelmas: the practical half for the picking (Food Standards
// Agency, "Guidance for safe foraging"), the jam pan and its burns (NHS),
// the jars (Coventry Trading Standards) and Mother Furlong's legs (NHS,
// "Falls"); the honest half grounded in grey mould on over-ripe fruit; the
// Devil's days set out by place (Folkard, 1884; Old Michaelmas in Sussex;
// Samhain in Ireland), and no "far hotter than boiling" for jam.
const { CALLERS } = require('../data/callers.js');
const { WHEEL_RITES } = require('../data/wheelRites.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'mabon_michaelmas_brambles');
check('the old scene kept: the lane hedge stripped, the steamed-up windows, "the Devil anyway"; the honest half is the grey mould', c && /You strip the lane hedge just in time and she makes the jam with the windows steamed up/.test(c.resolution) && /it was the Devil anyway/.test(c.resolution) && /in the wet the grey mould gets into them/.test(c.resolution));
check('the lore: Threlkeld\'s club; Sussex on Old Michaelmas and Folkard\'s spitting; the Scottish cloak in Folkard\'s words; Ireland till Samhain', /"the D—l casts his club over them"/.test(c.lore) && /Old Michaelmas Day \(10 October\)/.test(c.lore) && /"goes round the county and spits on the Blackberries"/.test(c.lore) && /"throws his cloak over the Blackberries, and renders them unwholesome"/.test(c.lore) && /Samhain/.test(c.lore) && /Folkard/.test(c.source));
const R = WHEEL_RITES.michaelmas;
check('the rite: no "most widespread"; the pooka at Samhain; the grey mould "particularly in wet, humid and cool conditions"', !/most widespread/.test(R.lore) && /the "pooka crawls on them"/.test(R.lore) && /"particularly in wet, humid and cool conditions"/.test(R.lore) && /Folkard/.test(R.source) && /Threlkeld.*1727/.test(R.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
