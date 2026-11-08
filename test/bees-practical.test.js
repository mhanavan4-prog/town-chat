// Telling the bees: a practical half for a widow who may keep her husband's
// hives (the National Bee Unit and BeeBase; the Bee Diseases and Pests Control
// (England) Order 2006; the BBKA; the NHS on stings), and the lore put right:
// the Book of Days' contributor and "many parts of England", the house-key
// knock from the Magazine of Natural History (1828), Bradfield (1851), the
// Argus (1790), and Whittier (1858); the bees' fretting is Abigail's, not a
// source's.
const { CALLERS } = require('../data/callers.js');
const { HOUSEHOLD_RITES: R } = require('../data/household.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'tell_the_bees');
check('the telling stands, now three knocks; the fretting is Abigail\'s own', c && c.steps[0].rite === 'telling_bees' && /knock three times on every hive with the house key/.test(c.resolution) && /'They'll fret, with Samuel gone,' she says/.test(c.resolution) && !/Bees do fret when their keeper changes/.test(c.resolution));
check('the practical half: the local association, BeeBase free with alerts; foulbrood, small hive beetle, Tropilaelaps reported by law; the hornet app', /Then the practical half/.test(c.resolution) && /local beekeepers' association, which runs taster days and may find her a mentor/.test(c.resolution) && /register the hives on BeeBase, which is free and sends alerts of disease nearby/.test(c.resolution) && /American and European foulbrood, the small hive beetle and Tropilaelaps mites must by law be reported to the National Bee Unit at once/.test(c.resolution) && /Asian Hornet Watch app/.test(c.resolution) && /Bee Diseases and Pests Control \(England\) Order 2006/.test(c.source));
check('…a sting scraped out sideways, not tweezered; washed, cold for 20 minutes; the signs that mean 999', /scrape the stinger out sideways with a fingernail or the edge of a card; tweezers can squeeze more poison in/.test(c.resolution) && /cold cloth on it for at least 20 minutes/.test(c.resolution) && /Ring 999 if the lips, mouth, throat or tongue swell/.test(c.resolution) && /faints and can't be woken/.test(c.resolution) && /NHS/.test(c.source));
const T = R.telling_bees;
check('the rite: three knocks; the Book of Days\' "many parts of England" under a Suffolk heading, by C. W. J.; the auction hive that "recovered"', /knock on it three times with the house key/.test(T.how) && /under a Suffolk heading/.test(T.lore) && /"customary in many parts of England, when a death takes place, to go and formally impart the fact to the bees, to ask them to the funeral, and to fix a piece of crape upon their hives"/.test(T.lore) && /"C\. W\. J\."/.test(T.lore) && /"at an auction of the goods of a farmer who had recently died"/.test(T.lore) && /"the bees recovered"/.test(T.lore) && !/In Suffolk, Chambers wrote/.test(T.lore));
check('…the key from the Magazine of Natural History (1828); Bradfield\'s messenger (1851); the Argus\'s Devon (1790); Whittier', /"to take the key of the house, and knock with it three times against the hive"/.test(T.lore) && /"dwindle and die"/.test(T.lore) && /"because it is considered that, if this compliment be omitted, the bees will die"/.test(T.lore) && /a London paper said in 1790/.test(T.lore) && /"at the moment the corpse is carrying out of the house"/.test(T.lore) && /"For I knew she was telling the bees of one \/ Gone on the journey we all must go!"/.test(T.lore) && /Magazine of Natural History/.test(T.source) && /Argus/.test(T.source) && /Whittier/.test(T.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
