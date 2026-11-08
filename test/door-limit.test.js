// The door limit: on any day of any year, at most two dated callers (the old
// calendar's own, and the fixed-date ones) come before the season's caller, so
// three are always offered and the season is never pushed off the step. Checked
// day by day from 2027 to 2060, which takes in every way Easter and the
// moveable Mondays fall against the fixed days.
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CALLERS } = require('../data/callers.js');
const { nextWindow } = require('../lib/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const dated = CALLERS.filter((c) => c.when);
check('there are dated callers to check', dated.length > 60, dated.length);
const crowded = [];
let days = 0;
for (let t = Date.UTC(2027, 0, 1, 12); t < Date.UTC(2061, 0, 1); t += 864e5) {
  days++;
  const on = dated.filter((c) => { const w = nextWindow(c.when, t); return w && w.start <= t && t < w.end; }).map((c) => c.id);
  if (on.length > 2) crowded.push(`${new Date(t).toISOString().slice(0, 10)} ${on.join(', ')}`);
}
check(`no day from 2027 to 2060 has more than two dated callers (${days} days)`, crowded.length === 0, crowded.slice(0, 10));
const at = (y, m, d) => dated.filter((c) => { const t = Date.UTC(y, m - 1, d, 12); const w = nextWindow(c.when, t); return w && w.start <= t && t < w.end; }).map((c) => c.id);
check('7 January 2030, a Monday: St Distaff and the plough boys, and Twelfth Night stays on the 6th', at(2030, 1, 7).sort().join() === 'plough_boys,st_distaff' && at(2030, 1, 6).includes('twelfth_night_cake'), [at(2030, 1, 6), at(2030, 1, 7)]);
check('1 May 2035, in Rogationtide: the bounds and the garland, and May Eve stays on the 30th', at(2035, 5, 1).sort().join() === 'may_garland,rogation_bounds' && at(2035, 4, 30).includes('may_eve_rowan'), [at(2035, 4, 30), at(2035, 5, 1)]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
