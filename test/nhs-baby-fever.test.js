// The babies' fevers, as the NHS's newer page has them ("When to get urgent
// medical help for babies and children under 5", reviewed 6 August 2026):
// 38C or more under 3 months, or 39C or more at 3 to 6 months, and no pee in
// 12 hours, are "Call 999 or go to A&E", not 111 as the older fever page
// (January 2024) has it. Every caller who gives a baby's fever threshold
// follows the newer page, and none says 111 for it.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const by = (id) => CALLERS.find((x) => x.id === id);

const ague = by('ague'), eye = by('overlooked_child'), teeth = by('sleepless_child');
check('the ague: 111 for five days or dried out; 999 or A&E for a baby under three months at 38, three to six at 39, or no wee in 12 hours', /Ring 111 for a fever that's lasted five days/.test(ague.resolution) && /ring 999 or go to A&E for one under three months at 38 or more, or three to six months at 39 or more, or one that hasn't had a wee in 12 hours/.test(ague.resolution) && /When to get urgent medical help for babies and children under 5/.test(ague.source));
check('the overlooked child: fewer wet nappies is 111; none in 12 hours is 999 or A&E, with the fevers by age', /ring 111 or the GP if she's not feeding, has fewer wet nappies than usual/.test(eye.resolution) && /Ring 999 or go to A&E if she's had no wet nappy in 12 hours, if she's under three months with a temperature of 38 or more, or three to six months with 39 or more/.test(eye.resolution));
check('the teething child: 38 isn\'t teething, 111 or the GP; under three months, 999 or A&E', /isn't teething, so ring 111 or the GP; and if he's under three months, 38 or more means 999 or A&E/.test(teeth.resolution) && /When to get urgent medical help for babies and children under 5/.test(teeth.source));
const bad = CALLERS.filter((c) => /111 for (a baby|one|babies) (aged )?under three months|under three months[^.;]*(ring|call) 111/i.test(c.resolution || '')).map((c) => c.id);
check('no caller sends a baby under three months with a fever to 111', bad.length === 0, bad);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
