// Callers 9–16, read against their sources: Trevisa's "wil"; Bessy Millie as
// Scott spelt her; Moore's "prejudice"; Queen Victoria's punctuation; no
// unsourced "one plant in a million", and the foraging guidance's rule on
// rare plants put first; Elworthy's twin of 1886; the NHS's 999 when a child
// may have swallowed something harmful; Kilmessan as the teller's home; no
// unsourced "premature"; the hedge-cutting ban's exemptions.
const { CALLERS } = require('../data/callers.js');
const arr = Array.isArray(CALLERS) ? CALLERS : Object.values(CALLERS);
const C = (id) => arr.find((c) => c.id === id);
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const be = C('becalmed');
check('becalmed: Trevisa\'s "wil"; Bessy Millie', /he wil unknette/.test(be.lore) && /Bessy Millie, 'upwards of ninety'/.test(be.lore) && !/Bessie/.test(be.lore));
const th = C('lone_thorn');
check('the lone thorn: "prejudice"; Kilmessan the teller\'s; the exemptions', /very strong prejudice/.test(th.lore) && /A Kilmessan man in Meath told of a neighbour/.test(th.lore) && /save for road safety and a few other exemptions/.test(th.resolution));
const wh = C('white_heather');
check('white heather: the Queen\'s commas; no "one in a million"; rare plants left', /'picked a piece of white heather, \(the emblem of "good luck,"\) which he gave to her'/.test(wh.lore) && !/one plant in a million/.test(wh.resolution) && /leave anything rare or unusual/.test(wh.resolution));
check('through the ash: 1886; no unsourced "premature"', /In Somerset in 1886/.test(C('through_the_ash').lore) && !/premature/.test(C('through_the_ash').resolution));
check('the green: 999 or A&E if it may be harmful, 111 if unsure', /ring 999 or go to A&E; if you're not sure it is harmful, ring 111/.test(C('bringing_in_green').resolution));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
