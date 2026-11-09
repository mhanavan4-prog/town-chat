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
check('the practical half: holidays hardest, not all at once; grief no illness but the GP after two weeks low', /Then the practical half, for a first New Year without him/.test(c.resolution) && /holidays and anniversaries are when grief comes hardest/.test(c.resolution) && /grief isn't an illness, but if she's low for more than two weeks together, the GP/.test(c.resolution));
check('…Cruse Scotland 0808 802 6161 with its hours; Samaritans 116 123 always; Breathing Space 0800 83 85 87', /Cruse Scotland's bereavement helpline is free on 0808 802 6161, weekdays nine to five and till eight on Monday and Thursday nights/.test(c.resolution) && /Samaritans are on 116 123, free, day and night, every day of the year/.test(c.resolution) && /Breathing Space on 0800 83 85 87, evenings in the week and all weekend/.test(c.resolution));
check('…Age Scotland 0800 12 44 222 mornings and a friendship caller; the Silver Line 0800 4 70 80 90; NHS 24 on 111, or 999', /Age Scotland's helpline, 0800 12 44 222 on weekday mornings, can find her a friendship caller/.test(c.resolution) && /the Silver Line, 0800 4 70 80 90, is open all hours/.test(c.resolution) && /ring NHS 24 on 111, or 999/.test(c.resolution) && /Cruse Scotland/.test(c.source) && /NHS inform/.test(c.source));
check('the caller\'s lore: Edinburgh\'s dark young man, Aberdeenshire\'s red-haired men, not empty-handed, black bun', /"A dark-complexioned young man was always considered lucky"/.test(c.lore) && /"males who had red hair"/.test(c.lore) && /never come empty-handed/.test(c.lore) && /"A Festive Cake at Hogmanay"/.test(c.lore) && /Folk-Lore 4 \(1893\)/.test(c.source));
const R = YULE_RITES.firstfoot;
check('the rite: Chambers\' definition; Aberdeenshire and Edinburgh quoted; Simpson and Roud\'s dark-or-fair; Moore\'s dark qualtagh and his reverse; no Yorkshire', /"the first to enter the house since twelve o'clock"/.test(R.lore) && /"women generally"/.test(R.lore) && /"A dark-complexioned young man was always considered lucky"/.test(R.lore) && /"In most places the first footer must be dark haired,"/.test(R.lore) && /"of dark complexion"/.test(R.lore) && /the other way about/.test(R.lore) && !/Yorkshire/.test(R.lore) && /Chambers/.test(R.source) && /qualtagh/.test(R.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
