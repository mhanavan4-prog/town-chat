// Against the Witch: the Charm Book chapter for counter-magic (the glass, the
// pinned heart, the witch post, the changeling question), moved out of The
// House and the Hive, with an intro that names what it could cost.
const { HOUSEHOLD_RITES } = require('../data/household.js');
const { CALLERS } = require('../data/callers.js');
const { buildCharmBook } = require('../lib/charmBook.js');
const { whereNext } = require('../lib/whereNext.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const AGAINST = ['witch_post', 'shewstone', 'pinned_heart', 'changeling_wife'];
const flagged = Object.values(HOUSEHOLD_RITES).filter((r) => r.against).map((r) => r.key);
check('the counter-magic rites are marked: the post, the glass, the heart, the question', JSON.stringify([...flagged].sort()) === JSON.stringify([...AGAINST].sort()), flagged);

const book = buildCharmBook({ acct: { ritesDone: ['shewstone'] }, prog: {}, seasonKey: null });
const keys = book.chapters.map((c) => c.key);
const ag = book.chapters.find((c) => c.key === 'against');
const home = book.chapters.find((c) => c.key === 'household');
check('Against the Witch comes straight after The House and the Hive', keys.indexOf('against') === keys.indexOf('household') + 1);
check('it holds exactly the counter-magic, with their sources and tiers', ag && ag.title === 'Against the Witch' && JSON.stringify(ag.entries.map((e) => e.id).sort()) === JSON.stringify([...AGAINST].sort()) && ag.entries.every((e) => e.source && /^(record|folk)$/.test(e.tier)));
check('…and The House and the Hive no longer does', home && !home.entries.some((e) => AGAINST.includes(e.id)) && home.entries.some((e) => e.id === 'telling_bees') && home.entries.some((e) => e.id === 'smooring'));
check('its intro names the cost: Ruth Osborne (1751) and Bridget Cleary (1895)', /Ruth Osborne at Tring in 1751/.test(ag.intro) && /Bridget Cleary in Tipperary in 1895/.test(ag.intro) && /told the truth/.test(ag.intro));
check('a rite worked for a caller is met there', ag.met === 1 && ag.entries.find((e) => e.id === 'shewstone').met);

// Where next still finds these rites for a caller at the door.
const c = CALLERS.find((x) => x.id === 'pinned_heart_pigs');
const items = whereNext({ book: buildCharmBook({ acct: {}, prog: {}, seasonKey: null }), offeredIds: [c.id] });
const door = items.find((x) => x.key === 'door');
check('Where next names the counter-magic rite a caller brings', door && door.lines.some((l) => l.includes(c.caller) && l.includes('The Pinned Heart')), door && door.lines);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
