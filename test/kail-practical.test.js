// The Kail Yard at Midnight: the practical half for the candle at the glass,
// since Burns's note has the comb going "all the time" (SFRS, "Halloween
// candle safety"; London Fire Brigade on costumes; stop, drop, cover and
// roll; NHS on burns); and Burns's own notes quoted from the 1786 text.
const { CALLERS } = require('../data/callers.js');
const { HALLOWEEN_RITES } = require('../data/halloween.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'hallowe_en_kail');
check('the old scene kept: the stock read seriously, the glass, the coat on the door, the schoolmaster\'s daughter', c && /He reads his kail stock very seriously/.test(c.resolution) && /the coat on the door after all/.test(c.resolution) && /the schoolmaster's daughter/.test(c.resolution));
check('the lore: Burns\'s kail note and the comb quoted from 1786', /"hand in hand, with eyes shut"/.test(c.lore) && /"prophetic of the size and shape of the grand object of all their Spells"/.test(c.lore) && /runts then set above the door/.test(c.lore) && /"some traditions say you should comb your hair all the time"/.test(c.lore) && /"as if peeping over your shoulder"/.test(c.lore));
check('the apple rite quotes Burns\'s note whole', /"Take a candle, and go, alone, to a looking glass: eat an apple before it, and some traditions say you should comb your hair all the time/.test(HALLOWEEN_RITES.apple.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
