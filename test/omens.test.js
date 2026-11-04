// The Scrying Bowl's omen (data/omens.js) — flavor portents, one per gazer per
// UTC day. The reading must be deterministic (stable all day) and in range.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { OMENS, omenFor, DEEP_OMENS, deepReading } = require('../data/omens.js');

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

// ── The deep reading (pour moon water) — a three-fold scry, fresh each pour ──
check('a good handful of deep omens', DEEP_OMENS.length >= 8, DEEP_OMENS.length);
for (const o of DEEP_OMENS) check('deep omen is a non-empty string', typeof o === 'string' && o.trim().length > 0, o);

const r = deepReading('alice', 1000);
check('a deep reading is three lines', Array.isArray(r) && r.length === 3, r);
check('the three lines are distinct', new Set(r).size === 3, r);
for (const ln of r) check('each deep line is a real deep omen', DEEP_OMENS.indexOf(ln) !== -1, ln);
// Deterministic for a given (seed, salt); fresh when the salt (moment of gazing) changes.
check('same seed + same pour = same reading', JSON.stringify(deepReading('alice', 1000)) === JSON.stringify(deepReading('alice', 1000)));
check('a later pour draws a fresh reading', JSON.stringify(deepReading('alice', 1000)) !== JSON.stringify(deepReading('alice', 2000)));
check('different witches read differently', JSON.stringify(deepReading('alice', 1000)) !== JSON.stringify(deepReading('zelda', 1000)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
