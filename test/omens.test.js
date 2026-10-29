// The Scrying Bowl's omen (data/omens.js) — flavor portents, one per gazer per
// UTC day. The reading must be deterministic (stable all day) and in range.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { OMENS, omenFor } = require('../data/omens.js');

check('a good handful of omens', OMENS.length >= 8, OMENS.length);
for (const o of OMENS) check('omen is a non-empty string', typeof o === 'string' && o.trim().length > 0, o);

// Always in range.
for (const seed of ['alice', 'bob', 'guest-123', '', null]) {
  for (const day of [0, 1, 20000, 20001]) {
    const i = omenFor(seed, day, OMENS.length);
    if (!(Number.isInteger(i) && i >= 0 && i < OMENS.length)) { check('omenFor in range', false, { seed, day, i }); }
  }
}
check('omenFor stays in range across seeds/days', true);

// Deterministic: same (seed, day) → same pick, every call.
check('same gazer + same day = same omen', omenFor('alice', 20000, OMENS.length) === omenFor('alice', 20000, OMENS.length));
// Varies across days (for at least one seed) and across seeds (for at least one day).
const diffDays = omenFor('alice', 20000, OMENS.length) !== omenFor('alice', 20001, OMENS.length);
const diffSeeds = omenFor('alice', 20000, OMENS.length) !== omenFor('zelda', 20000, OMENS.length);
check('the reading turns over between days', diffDays);
check('the reading differs between witches', diffSeeds);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
