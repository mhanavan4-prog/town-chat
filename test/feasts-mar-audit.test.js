// The Turning Year, March and April, read against its sources: the St Mark's
// Eve porch watch is in Hone's vol. I (1826), without a false ellipsis, and
// the sleeping watcher's death is O'Donnell's (1939), not found in Morris;
// Easter lifting's "armchair" and "the custom of the place on that morning",
// with the 1784 Gentleman's Magazine cited; Hone only "heard" of the cake
// that "preserves the house from fire"; the Widow's Son as its listing
// gives it; Preston's council page by its title.
const one = (o) => Object.values(o)[0];
const M = one(require('../data/stMarksEve.js').MARK_RITES);
const E = one(require('../data/easterLifting.js').LIFTING_RITES);
const G = one(require('../data/goodFriday.js').GOOD_FRIDAY_RITES);
const { WHEEL_RITES } = require('../data/wheelRites.js');
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
check('St Mark\'s Eve: Hone vol. I (1826), no ellipsis; the sleeper\'s death O\'Donnell\'s', /vol\. I \(1826\), 25 April/.test(M.source) && /who are to die the next year/.test(M.lore) && !/who … are/.test(M.lore) && /O'Donnell, Haunted Churches, 1939/.test(M.lore) && !/Morris/.test(M.lore + M.source) && !/Morris, Yorkshire Folk-Talk/.test(JSON.stringify(CALLERS)));
check('Easter lifting: Hone\'s armchair and full clause; the Gentleman\'s Magazine cited', /"an armchair, lined with white/.test(E.lore) && /"it was the custom of the place on that morning\."/.test(E.lore) && /Gentleman's Magazine \(1784\)/.test(E.source));
check('Good Friday: Hone heard of the fire cake; the Widow\'s Son as listed', /had heard it said of a hard cross-work cake hung from the ceiling/.test(G.lore) && /"to the legend of the Widow's Son"/.test(G.lore));
const pace = Object.values(WHEEL_RITES).find((r) => /Pace eggs/.test(r.lore || ''));
check('Pace eggs: Preston\'s page by its title, and Visit Preston for 1867', pace && /"Join us for Egg Rolling in Avenham Park on Easter Monday" \(2024\) · Visit Preston/.test(pace.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
