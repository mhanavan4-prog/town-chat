// The Turning Year in May, read against its sources: the well-dressing "red
// daises" are a correspondent's of Hone's who never saw the day, not Hone's
// own; the solstice falls nine or ten days after St Barnabas; the garlands as
// St Mary at Hill bought them, not "as the clerks wore them"; Oxford's stone
// in a glass case in Marks & Spencer; the Manx gorse burned "from time
// immemorial" as the 1837 paper reported; Durgan's 1790 letter as Knowlson
// and the Library of Congress quote it, not Bell's shortened text.
const one = (o) => Object.values(o)[0];
const W = one(require('../data/wellDressing.js').WELL_RITES);
const B = one(require('../data/barnabyBright.js').BARNABY_RITES);
const R = one(require('../data/rogation.js').ROGATION_RITES);
const M = one(require('../data/mayEve.js').MAY_EVE_RITES);
const F = one(require('../data/furryDay.js').FURRY_RITES);
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
check('well dressing: the correspondent\'s "red daises", not Hone seeing them', /a correspondent of Hone's in 1826, who had never seen the day/.test(W.lore) && /"red daises, and none else"/.test(W.lore) && !/Hone saw/.test(W.lore));
check('Barnaby Bright: nine or ten days; St Mary at Hill bought the garlands', /nine or ten days after St Barnabas/.test(B.lore) && /as the parish of St Mary at Hill bought them in 1477–9/.test(B.how) && !/clerks once wore/.test(B.how));
check('Beating the bounds: the stone in a glass case in Marks & Spencer', /a boundary stone kept in a glass case inside Marks & Spencer/.test(R.lore) && !/middle of a shop/.test(R.lore));
check('May Eve: the gorse burned "from time immemorial", as reported in 1837', /"have, from time immemorial, burned all the whin \(gorse\) bushes in the Island"/.test(M.lore));
check('the Furry: Durgan as Knowlson quotes him; no Bell', /"some troublesome rogues go round the streets with drums, or other noisy instruments"/.test(F.lore) && /Knowlson/.test(F.source) && !/Bell/.test(F.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
