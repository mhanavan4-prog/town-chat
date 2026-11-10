// To See the Sun Dance: the practical half for a child's eyes (College of
// Optometrists and Royal College of Ophthalmologists, 2026: never look at the
// sun, the damage painless and late; children's eyes more at risk; NHS on
// sunlight off water; an optician for blurring or a dark spot); and the lore
// put right: Browne's chapter numbered by edition (21 in 1646), the "pretty
// reflection" given to Dunton's Athenian Oracle, not to Browne, and Carmichael's
// Barbara Macphie, who saw it dance.
const { CALLERS } = require('../data/callers.js');
const { WHEEL_RITES } = require('../data/wheelRites.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'ostara_sun_dance');
check('the old scene kept: the wall, the pail, "There!"; the reflection credited to the Athenian Oracle, not Browne', c && /sit on the wall with the pail between you/.test(c.resolution) && /she grips your arm and says "There!"/.test(c.resolution) && /The Athenian Oracle said it was "nothing but the pretty reflection"/.test(c.resolution) && !/Browne said as much/.test(c.resolution));
check('the practical half: never straight at the sun, sunrise included; painless damage found hours later; the unconfirmed child\'s-eyes line dropped', /Then the practical half, and it's for her eyes/.test(c.resolution) && /Never look straight at the sun, not even at sunrise/.test(c.resolution) && /because the eye feels no pain there you may not know for hours/.test(c.resolution) && !/A child's eyes take more harm/.test(c.resolution));
check('…the pail the better way, but not staring at the bright spot; blur, bent lines, wrong colours or a dark spot to an optician at once; cited', /Watching it in the pail is the old way and the better one, but don't stare long at the bright spot either/.test(c.resolution) && /blurred or bent, the colours are wrong, or there's a dark spot in the middle of what she sees, take her to an optician straight away/.test(c.resolution) && /College of Optometrists/.test(c.source) && /Royal College of Ophthalmologists/.test(c.source));
check('the caller\'s lore: Ireland at four, the lamb-playing from Dunton via Hone, Browne\'s line; Browne\'s chapter by edition', /"rise about four o'clock to see the sun dance"/.test(c.lore) && /"the lamb-playing"/.test(c.lore) && /Dunton's Athenian Oracle/.test(c.lore) && /"the Sun doth not dance on Easter day"/.test(c.lore) && /Book V ch\. 21 \(ch\. 22 in later editions\)/.test(c.source));
const R = WHEEL_RITES.sundance;
check('the rite: the Irish correspondent, the Athenian Oracle\'s "pretty reflection", Barbara Macphie on Benmore; Browne and Carmichael cited', /"rise about four o'clock to see the sun dance in honour of the resurrection"/.test(R.lore) && /nothing but the pretty reflection it makes from the water"/.test(R.lore) && /Barbara Macphie/.test(R.lore) && /"It was dancing up and down in exultation at the joyous resurrection"/.test(R.lore) && /the Sun doth not dance on Easter day/.test(R.lore) && /Browne.*1646/.test(R.source) && /Carmina Gadelica vol\. 2/.test(R.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
