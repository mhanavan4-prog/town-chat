// Words for the Haaf: the practical half for a boy going to the fishing
// (Seafish on danger and training; MCA, MGN 588(F) on lifejackets; HM
// Coastguard on locator beacons, 999 and Channel 16); and the lore put
// right: Humberstone's 2023 thesis named, with "the first comprehensive"
// glossary rather than "a full" one; sea-words from Jakobsen through Murison;
// the haaf itself; and the Gloup disaster of 1881.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'sea_words');
check('the old scene kept: the staves kind, the tea, the words never guessed at, learned in the boat', c && /The staves are kind/.test(c.resolution) && /never guess at/.test(c.resolution) && /He'll learn them in the boat/.test(c.resolution));
check('the lore: the haaf, the sea-words (bennihoose, upstander), Norn quoted, Jakobsen\'s fieldwork, the first comprehensive glossary of 2023, Gloup 1881', /thirty or forty miles out/.test(c.lore) && /the church was the bennihoose, the minister the upstander/.test(c.lore) && /"a Scandinavian language spoken in the isles until the eighteenth century"/.test(c.lore) && /Norn/.test(c.lore) && /1893–95/.test(c.lore) && /the first comprehensive glossary was made only in 2023/.test(c.lore) && !/a full glossary/.test(c.lore) && /fifty-eight men were drowned, thirty-six of them from Gloup/.test(c.lore));
check('…cited: Jakobsen, Murison, Humberstone\'s thesis by its title', /Jakobsen/.test(c.source) && /Murison/.test(c.source) && /Shetland sea language: a living tradition\? \(PhD thesis, University of Edinburgh, 2023\)/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
