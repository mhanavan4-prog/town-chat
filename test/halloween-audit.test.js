// Hallowe'en, read against Burns's notes as printed at Kilmarnock in 1786
// (two transcriptions agreeing): the luggies without the later brackets, with
// the widow and the empty dish in his words and his semicolon; the blue clue's
// "pot, a clew" and lowercase "wha hauds?"; Merran's "Guid L—d!" as censored.
const { HALLOWEEN_RITES: H } = require('../data/halloween.js');
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const all = JSON.stringify(Object.values(H)) + JSON.stringify(CALLERS);
check('the luggies as 1786 has them: no brackets, "Matrimony, a Maid", the widow and empty dish quoted, the semicolon', /"the future husband or wife will come to the bar of Matrimony, a Maid"/.test(H.luggies.lore) && !/\(husband or\)/.test(all) && /"if in the foul, a widow; if in the empty dish, it foretells, with equal certainty, no marriage at all\."/.test(H.luggies.lore) && /"It is repeated three times; and every time the arrangement of the dishes is altered\."/.test(H.luggies.lore));
check('the blue clue as 1786 has it: "pot, a clew", "wha hauds?" glossed', /throw into the pot, a clew of blue yarn"/.test(H.clue.lore) && !/into the pot a clue/.test(all) && /"wha hauds\?" \("i\.e\. who holds\?"\)/.test(H.clue.lore));
check('Merran\'s line censored as printed, "Guid L—d!"', /Guid L—d! but she was quaukin!/.test(all) && !/Guid Lord!/.test(all));
check('every rite still cites the poem and the 1786 edition', Object.values(H).every((r) => /Kilmarnock edition 1786/.test(r.source)));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
