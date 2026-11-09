// The Turning Year, June and early July, read against its sources: Hannah
// More's "or the left" as Hone prints it; Tynwald's own words for its
// open-air sitting; the fern seed caught on a plate, without an unsourced
// "without touching"; Hone's "dogs go mad" in its own context, and Achelley
// (1572) cited for the older almanac's dates; Britannica's punctuation and
// Hone's year and "on" for the quarter day; Grasmere's strewn rushes as an
// older guide quoted in 1843; Borlase cited; the Cawood ring's source named.
const one = (o) => Object.values(o)[0];
const MM = one(require('../data/midsummerMen.js').MIDSUMMER_MEN_RITES);
const T = one(require('../data/tynwald.js').TYNWALD_RITES);
const F = one(require('../data/fernSeed.js').FERN_RITES);
const D = one(require('../data/dogDays.js').DOG_RITES);
const Q = one(require('../data/midsummerQuarter.js').QUARTER_RITES);
const R = one(require('../data/rushbearing.js').RUSH_RITES);
const P = one(require('../data/stPetersEve.js').PETER_RITES);
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
check('Midsummer Men: "or the left"; the Cawood ring\'s source', /to the right, or the left"/.test(MM.lore) && /Cawood ring, as J\. Brand's Popular Antiquities quotes it/.test(MM.source));
check('Tynwald: its own words, and the 2023 page cited', /"in the open air once a year, on old midsummer's day, to hear the promulgation of Acts on Tynwald Hill"/.test(T.lore) && /"Tynwald Day 2023"/.test(T.source));
check('fern seed: no "without touching"', !/without touching/.test(F.how));
check('dog days: Hone\'s bite advice; Achelley cited', /Hone, advising on dog bites, wrote "as at this time dogs go mad"/.test(D.lore) && /Achelley, The Key of Knowledge \(1572\)/.test(D.source));
check('quarter day: Britannica\'s punctuation; Hone 1826; "on"', /rents should be paid and houses/.test(Q.lore) && /Every-Day Book \(1826\)/.test(Q.lore) && /ponder on these/.test(Q.lore));
check('rush-bearing: Grasmere as an older guide had it', /as an older guide quoted in 1843 had it/.test(R.lore) && !/church in 1843/.test(R.lore));
check('St Peter\'s Eve: Borlase cited', /Borlase, Observations on the Antiquities of Cornwall \(1754\)/.test(P.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
