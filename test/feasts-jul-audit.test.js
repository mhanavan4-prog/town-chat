// The Turning Year, late July and August, read against its sources: Lewis's
// "sometimes"; Puck Fair's patent as the fair's own history gives it;
// Bartholomew Fair last proclaimed in 1855 (Morley's main text), the ballad
// in the folio spelling at III.v; Chambers cited the Greenwich observations
// and Brand's annotator found the newspaper; Hone's St Swithin and grotto
// material in vol. I (1826); Whitstable's grotters in its own words; Lammas a
// money-term without unsourced "school fees"; Bilberry Sunday the first
// Sunday of August.
const one = (o) => Object.values(o)[0];
const P = one(require('../data/puckFair.js').PUCK_RITES);
const B = one(require('../data/bartholomewFair.js').BARTHOLOMEW_RITES);
const S = one(require('../data/stSwithin.js').SWITHIN_RITES);
const G = one(require('../data/grotto.js').GROTTO_RITES);
const L = one(require('../data/lammasTerm.js').LAMMAS_TERM_RITES);
const { OLD_CALENDAR } = require('../data/oldCalendar.js');
const { WHEEL_RITES } = require('../data/wheelRites.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const cal = JSON.stringify(OLD_CALENDAR);
check('Puck Fair: Lewis\'s "sometimes"; the patent from the fair\'s history', /a male goat is sometimes ornamented/.test(P.lore) && !/somtimes/.test(P.lore + cal) && /"fair on Lammas day and 2 days after"/.test(P.lore) && !/Irish Times/.test(P.source));
check('Bartholomew Fair: 1855; the folio ballad; III.v; Hone vol. I', /proclaimed for the last time in the year 1855/.test(B.lore) && !/1853/.test(B.lore + cal.match(/Smithfield[^"]*/)[0]) && /"Youth, youth, thou hadst better bin staru'd by thy Nurse/.test(B.lore) && /II\.ii, III\.v/.test(B.source) && /vol\. I \(1826\), 3 and 5 September/.test(B.source));
check('St Swithin: Chambers cited, Brand\'s annotator traced; Hone vol. I', /Chambers cited twenty years of Greenwich observations/.test(S.lore) && /an annotator on Brand traced it/.test(S.lore) && /vol\. I \(1826\), 15 July/.test(S.source));
check('the grotto: Hone vol. I; Whitstable in its own words', /vol\. I \(1826\), 25 July/.test(G.source) && /"lit from within by a candle"/.test(G.lore) && /late 1980s/.test(G.lore));
check('Lammas term: no unsourced school fees; Anderson p. 195', !/school fees/.test(L.lore) && /p\. 195/.test(L.source));
const bil = Object.values(WHEEL_RITES).find((r) => /bilberries/.test(r.how || ''));
check('Bilberry Sunday: the first Sunday of August', bil && /first Sunday of August/.test(bil.how));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
