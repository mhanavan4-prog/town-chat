// No Letter from America: the practical half for anyone waiting on word from
// abroad (the police and the FCDO, 020 7008 5000; Missing People, 116 000;
// Salvation Army Family Tracing; the "friend in need" scam and clairvoyant
// scam mail; Report Fraud and Police Scotland); and the lore read from A
// Highland Seer (New York, c. 1920, not "early 1900s"): the letter with dots
// that "will contain money", which is the dollar in Davey's letter; Payton on
// Cornish emigration; and no unsourced claim about emigrants' families.
const { CALLERS } = require('../data/callers.js');
const { LEAF_SYMBOLS, LEAVES_LORE } = require('../data/leaves.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'letter_from_abroad');
check('the old scene kept: the cup turned three times, the good sign first, the dollar in the letter', c && /You turn her cup three times and set it to drain/.test(c.resolution) && /the good sign first/.test(c.resolution) && /has a dollar folded in it/.test(c.resolution));
check('the practical half: no need to wait; the police at any time; the Foreign Office day and night on 020 7008 5000', /Then the practical half, for anyone waiting on word from abroad today/.test(c.resolution) && /you needn't wait: tell your local police at any time/.test(c.resolution) && /the Foreign Office answers day and night on 020 7008 5000/.test(c.resolution));
check('…Missing People 116 000, free, confidential, every day; Salvation Army Family Tracing', /Missing People's line, 116 000, is free and confidential, every day/.test(c.resolution) && /Salvation Army's Family Tracing/.test(c.resolution) && !/116 000[^.]*(24 hours|day and night)/.test(c.resolution));
check('…the "son abroad" scam: stop, think, call the number you know; clairvoyant letters: send nothing; Report Fraud 0300 123 2040, Police Scotland 101', /stop, think, and call him on the number you know/.test(c.resolution) && /a letter from a clairvoyant offering to tell you more for a fee is a scam, so send nothing/.test(c.resolution) && /Report fraud on 0300 123 2040, or to Police Scotland on 101/.test(c.resolution) && !/Action Fraud/.test(c.resolution + c.source));
check('the lore: the Seer dated c. 1920; the turn, the handle, the letter with dots and money, the fish; Cornwall\'s quarter of a million; no "faithful customers"', /New York, c\. 1920/.test(c.lore) && !/early 1900s/.test(c.lore + c.source) && /"three times from left to right"/.test(c.lore) && /"represents the consultant"/.test(c.lore) && /"if accompanied by dots they will contain money"/.test(c.lore) && /"good news from abroad"/.test(c.lore) && /a quarter of a million people went overseas between 1815 and 1914/.test(c.lore) && !/most faithful customers/.test(c.lore) && /Payton/.test(c.source));
const L = LEAF_SYMBOLS.find((s) => s.key === 'letter');
check('the leaf book: the letter carries money when dotted; the Seer dated c. 1920', L && /with dots about it, there is money in it/.test(L.meaning) && /New York, undated, c\. 1920/.test(LEAVES_LORE.provenance) && !/early 1900s/.test(LEAVES_LORE.provenance));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
