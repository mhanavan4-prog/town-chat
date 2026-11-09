// The standing rule, now that every caller has it: whatever the old way does,
// each caller's resolution also gives "the practical half" (what modern,
// authoritative advice says to do), and each caller is sourced and badged
// with a provenance tier. A new caller without them fails here.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

check('there are callers to check', CALLERS.length >= 129, CALLERS.length);
const missing = CALLERS.filter((c) => !/the practical half/i.test(c.resolution || '')).map((c) => c.id);
check('every caller gives the practical half', missing.length === 0, missing);
const unsourced = CALLERS.filter((c) => !(c.source || '').trim()).map((c) => c.id);
check('every caller names its sources', unsourced.length === 0, unsourced);
const untiered = CALLERS.filter((c) => !['record', 'folk', 'revival'].includes(c.tier)).map((c) => c.id);
check('every caller is badged record, folk or revival', untiered.length === 0, untiered);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
