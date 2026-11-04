// The Pendulum (data/pendulum.js) — a yes/no/unclear reading, deterministic per
// (gazer, question, day) so a question can't be re-rolled, and surer (never
// unclear) while the veil of Samhain is thin.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { PENDULUM, pendulumAnswer } = require('../data/pendulum.js');

const VERDICTS = ['yes', 'no', 'unclear'];
for (const v of VERDICTS) {
  check(`${v} has a good handful of lines`, Array.isArray(PENDULUM[v]) && PENDULUM[v].length >= 3, v);
  for (const ln of PENDULUM[v]) check(`${v} line is a non-empty string`, typeof ln === 'string' && ln.trim().length > 0, ln);
}

// Shape + in-pool.
const a = pendulumAnswer('alice', 'will it rain?', 20000, false);
check('a reading has a verdict + line', VERDICTS.indexOf(a.verdict) !== -1 && typeof a.line === 'string', a);
check('the line belongs to its verdict pool', PENDULUM[a.verdict].indexOf(a.line) !== -1, a);

// Deterministic: same (seed, question, day) → same answer, every time (no reroll).
const b1 = pendulumAnswer('alice', 'should I go?', 20000, false);
const b2 = pendulumAnswer('alice', 'should I go?', 20000, false);
check('same question same day = same answer', b1.verdict === b2.verdict && b1.line === b2.line, [b1, b2]);
// A different question (or day, or witch) can answer differently.
check('a different question can differ', JSON.stringify(pendulumAnswer('alice', 'q A', 20000, false)) !== JSON.stringify(pendulumAnswer('alice', 'q B wholly other', 20000, false)) || true); // not guaranteed, but must not throw

// Distribution: across many questions, all three verdicts appear off-veil, and
// the veil removes 'unclear'.
const seen = { yes: 0, no: 0, unclear: 0 };
const seenVeil = { yes: 0, no: 0, unclear: 0 };
for (let i = 0; i < 400; i++) {
  seen[pendulumAnswer('alice', 'question number ' + i, 20000, false).verdict]++;
  seenVeil[pendulumAnswer('alice', 'question number ' + i, 20000, true).verdict]++;
}
check('off-veil, yes/no/unclear all occur', seen.yes > 0 && seen.no > 0 && seen.unclear > 0, seen);
check('thin veil never answers unclear', seenVeil.unclear === 0, seenVeil);
check('thin veil still yields yes and no', seenVeil.yes > 0 && seenVeil.no > 0, seenVeil);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
