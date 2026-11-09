// The three spoken charms not yet checked, read against their sources: the
// burn charm's semicolon and Hunt's "Amen!", the leaves "employed" (not
// "passed over"), Bottrell's and Courtney's "Three ladies" across the West
// Country, no unconfirmed Wright, and the paid charmers in place of "took no
// money"; the toothache paper's real last line, not folded, the Latin as
// Kencis prints it, Harland and Wilkinson's section without the unconfirmed
// Fylde quote; Cochrane's 2003 title; the chapter intro's "usually for
// nothing" gone.
const { CHARMS, WART_CHARM } = require('../data/charms.js');
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const B = CHARMS.burn, T = CHARMS.tooth;
const book = fs.readFileSync(path.join(__dirname, '..', 'lib', 'charmBook.js'), 'utf8');
const head = fs.readFileSync(path.join(__dirname, '..', 'data', 'charms.js'), 'utf8').slice(0, 800);
check('the burn charm as Hunt prints it: the semicolon, four lines, his "Amen!" noted; the leaves only "employed"', B.lines.length === 4 && B.lines[1] === 'One brought fire and two brought frost;' && /who ends it "Amen!"/.test(B.use) && !/passed over/.test(B.use));
check('the burn charm\'s lore: the West Country, Bottrell and Courtney (1887), no Wright, no "took no money"; Jelbart\'s good income and the Penzance charmer', /across the West Country/.test(B.lore) && !/across Britain/.test(B.lore) && /Bottrell \(1873\) and Courtney \(1887\)/.test(B.lore) && !/Wright/.test(B.lore + B.source) && !/took no money/.test(B.lore) && /"made a good income by charming warts, wildfire \(erysipelas\), cataracts, &c\."/.test(B.lore) && /"made a great deal of money by her profession"/.test(B.lore) && /The Folk-Lore Journal 5 \(1887\)/.test(B.source) && !/pp\. 146/.test(B.source) && /Bottrell/.test(B.source));
check('the toothache paper\'s own last line; not folded; no "whoever"', T.lines[3] === 'and not only thee but all them that carries these lines for my sake shall never have the toothache.' && !/whoever/.test(T.lines.join(' ')) && !/folded/.test(T.use));
check('the toothache lore: the Latin as Kencis prints it, complete texts of the eleventh century; Wilde\'s rhyme; full titles and pages', /as Ķencis prints it from Roper, runs "Christus super marmoreum sedebat petrus tristes ante eum stabat"/.test(T.lore) && /oldest complete Latin texts are of the eleventh century/.test(T.lore) && /"As Peter sat on a marble stone, \/ The Lord came to him all alone"/.test(T.lore) && /"Charms for the Toothache", p\. 75/.test(T.source) && /Ancient Legends, Mystic Charms, and Superstitions of Ireland \(1887\)/.test(T.source) && /Incantatio 3 \(2013\), pp\. 100–108/.test(T.source));
check('the wart charm: Cochrane\'s 2003 title given', /2003, as "Local treatments for cutaneous warts"/.test(WART_CHARM.source));
check('no "usually for nothing" in the chapter intro or the file\'s head', !/usually for nothing/.test(book) && !/usually for no fee/.test(head));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
