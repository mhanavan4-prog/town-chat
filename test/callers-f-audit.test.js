// Callers 49–59, checked against the corrected feasts and their practical
// authorities: "plough witches" credited to the 1886 paper, not Hone, and no
// ploughed doorstep; Herrick's brand burned on Candlemas Day, not "tonight";
// the plant warnings as PDSA and the RHS give them; Mitchell's volume dated
// 1872–74; the Childermas coronation tale told before it is denied, with The
// Spectator and Transport Scotland cited; suet, not "fat", for the wrens; the
// practical halves' authorities named.
const { CALLERS } = require('../data/callers.js');
const arr = Array.isArray(CALLERS) ? CALLERS : Object.values(CALLERS);
const C = (id) => arr.find((c) => c.id === id);
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const p = C('plough_boys');
check('Plough Monday: the 1886 paper\'s plough witches; no step', /\(Hone, 1826\); in parts, faces blacked, they were called "plough witches" \(Nottingham Guardian, 1886\)/.test(p.lore) && /lawn or drive/.test(p.resolution) && !/nobody's step/.test(p.resolution) && /Millington/.test(p.source));
const g = C('candlemas_green');
check('Candlemas Eve: the brand tomorrow; PDSA and RHS warnings; cited', /tomorrow, Candlemas Day, the brand is kindled/.test(g.resolution) && !/box is bad for dogs|mistletoe's are worse/.test(g.resolution) && /PDSA/.test(g.source) && /RHS/.test(g.source));
check('the Clavie: Mitchell 10 (1872–74)', /10 \(1872–74\), pp\. 656–57/.test(C('clavie_burghead').source));
const ch = C('childermas_carrier');
check('Childermas: the coronation rumour told; Spectator and Transport Scotland cited', /a rumour in 1461 had Edward IV's coronation put off a day/.test(ch.lore) && /The Spectator, no\. 7/.test(ch.source) && /Transport Scotland/.test(ch.source));
check('the wren boys: suet; RSPB cited', /a bit of suet/.test(C('wren_boys').resolution) && /RSPB/.test(C('wren_boys').source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
