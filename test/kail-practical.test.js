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
check('the practical half: a steady holder on something that won\'t burn; clear of hair, sleeves, capes; never left burning; a battery candle', /Then the practical half, for a lad alone with a candle, a comb and his face close to the glass/.test(c.resolution) && /a steady holder on something that won't burn/.test(c.resolution) && /keep it clear of his hair, his sleeves and anything that hangs or flows, a cape or a costume most of all/.test(c.resolution) && /never leave it burning/.test(c.resolution) && /A battery candle/.test(c.resolution));
check('…stop, drop, cover the face, roll; cool running water twenty minutes, nothing stuck pulled off, no butter; A&E for large or deep', /stop, drop to the ground, cover the face with the hands, and roll till it's out/.test(c.resolution) && /cool running water for twenty minutes/.test(c.resolution) && /isn't stuck to the skin, and no butter or creams/.test(c.resolution) && /a large or deep burn goes to A&E/.test(c.resolution));
check('…cited: the fire services and the NHS', /Scottish Fire and Rescue Service, "Halloween candle safety"/.test(c.source) && /London Fire Brigade, "Fancy dress costumes"/.test(c.source) && /NHS, "Burns and scalds"/.test(c.source));
check('the lore: Burns\'s kail note and the comb quoted from 1786', /"hand in hand, with eyes shut"/.test(c.lore) && /"prophetic of the size and shape of the grand object of all their Spells"/.test(c.lore) && /runts then set above the door/.test(c.lore) && /"some traditions say you should comb your hair all the time"/.test(c.lore) && /"as if peeping over your shoulder"/.test(c.lore));
check('the apple rite quotes Burns\'s note whole', /"Take a candle, and go, alone, to a looking glass: eat an apple before it, and some traditions say you should comb your hair all the time/.test(HALLOWEEN_RITES.apple.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
