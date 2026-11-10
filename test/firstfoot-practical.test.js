// A First-Foot for Elspeth: the practical half for a first Hogmanay alone
// (NHS inform on grief at holidays; Cruse Scotland, Samaritans, Breathing
// Space, Age Scotland and the Silver Line, with their hours; NHS 24 and 999);
// and the lore read from the records: Chambers (1864), the Folk-Lore notes
// of 1893 from Aberdeenshire and Edinburgh, Simpson and Roud's dark-or-fair,
// Moore's qualtagh and his "reverse", and black bun in the Scots Kitchen.
// The Yorkshire contrast, which is Roberts's (2013), not Simpson and Roud's,
// is dropped.
const { CALLERS } = require('../data/callers.js');
const { YULE_RITES } = require('../data/yule.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'yule_first_foot');
check('the old scene kept: the knock after the bells, the good glasses, Wullie\'s toast, cries then laughs, next year', c && /You knock just after the bells/.test(c.resolution) && /Wullie's toast/.test(c.resolution) && /then she cries a little and then she laughs/.test(c.resolution) && /come again next year/.test(c.resolution));
check('the caller\'s lore: Edinburgh\'s dark young man, Aberdeenshire\'s red-haired men, not empty-handed, black bun', /"A dark-complexioned young man was always considered lucky"/.test(c.lore) && /"males who had red hair"/.test(c.lore) && /never come empty-handed/.test(c.lore) && /"A Festive Cake at Hogmanay"/.test(c.lore) && /Folk-Lore 4 \(1893\)/.test(c.source));
const R = YULE_RITES.firstfoot;
check('the rite: Chambers\' definition; Aberdeenshire and Edinburgh quoted; the unconfirmed Simpson and Roud quote left out; Moore\'s dark qualtagh and his reverse in his words; no Yorkshire', /"the first to enter the house since twelve o'clock"/.test(R.lore) && /"women generally"/.test(R.lore) && /"A dark-complexioned young man was always considered lucky, and a likely suitor"/.test(R.lore) && !/Simpson/.test(R.lore + R.source) && /"of dark complexion"/.test(R.lore) && /"the superstition in Scotland is the exact reverse of this"/.test(R.lore) && !/Yorkshire/.test(R.lore) && /Chambers/.test(R.source) && /qualtagh/.test(R.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
