// The lone thorn: a practical half on Irish law (the Wildlife Act 1976,
// ss. 22 and 40; the Forestry Act 2014, s. 19, which exempts hawthorn) and on
// felling safely (the HSA), and the lore put right: the period sources (Lady
// Wilde, 1887; Allingham, in Yeats, 1888; Evans-Wentz, 1911; Moore, 1891, for
// Man), a sceptic (Gordon, 1911), and Latoon told as the Irish Times has it:
// worked around, not rerouted.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'lone_thorn');
check('the thorn stands; Daly ploughs round it', c && /a lone thorn is the good people's/.test(c.resolution) && /ploughs around it/.test(c.resolution));
check('the lore: Lady Wilde\'s peasant; Allingham\'s thorns in the bed; Kilmessan\'s fairy-bushes that would not burn; Moore\'s Manx prejudice; Edith Gordon\'s doubt', /'A peasant would die sooner than cut down one of the ancient hawthorns sacred to the fairies'/.test(c.lore) && /He shall find their sharpest thorns \/ In his bed at night'/.test(c.lore) && /'would not burn', and 'In six months after cutting the fairy-bushes, he was dead'/.test(c.lore) && /'was regarded with veneration, there being a very strong prejudice against cutting it down'/.test(c.lore) && /'was felt by me alone'/.test(c.lore) && !/parts of Britain/.test(c.lore));
check('…Latoon as it was: worked around, "not rerouted", fenced between carriageway and slip road', /'it is possible to work around it'/.test(c.lore) && /'was not rerouted'/.test(c.lore) && /between the carriageway and a slip road, and was fenced in/.test(c.lore) && !/was re-routed after/.test(c.lore) && /Irish Times/.test(c.source) && c.tier === 'record');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
