// Hallowe'en at the Gibbs': the practical half for Nell's burnt fingers (NHS,
// "Burns and scalds", on nhs.uk and NHS 111 Wales; British Red Cross,
// "Burns"); Burns's own notes quoted, the night and the west of Scotland
// among them; and the luggies put right: the clean water means the one you
// marry comes "to the bar of matrimony a maid", and the foul a widow, not that
// you are widowed yourself.
const { CALLERS } = require('../data/callers.js');
const { HALLOWEEN_RITES } = require('../data/halloween.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'hallowe_en_nuts');
check('the old scene kept: the laughing kitchen and Nell\'s burnt fingers', c && /Nell has burnt her fingers fishing her nut back out/.test(c.resolution) && /blame it on the nuts/.test(c.resolution));
check('the practical half: cool running water twenty minutes; the ring off before swelling, nothing stuck pulled; no butter, ice or creams, no bursting', /Then the practical half/.test(c.resolution) && /cool running water for twenty minutes, straight away/.test(c.resolution) && /take her ring off before the fingers swell, but leave anything that's stuck to the skin/.test(c.resolution) && /No butter, no ice, no creams, and don't burst the blister/.test(c.resolution));
check('…cling film laid loosely or a clean plastic bag; painkillers; blisters seen, hand burns and deep or large ones to A&E; 111 under five; the tongs', /Lay cling film loosely over it, or put the hand in a clean plastic bag/.test(c.resolution) && /paracetamol or ibuprofen/.test(c.resolution) && /Get any burn that blisters looked at, and a burn on the hand, or one that's deep, white or charred, or bigger than her own hand, goes to A&E/.test(c.resolution) && /under five, ring 111/.test(c.resolution) && /the tongs/.test(c.resolution));
check('…cited, one NHS citation, with the Red Cross', /NHS, "Burns and scalds" \(nhs\.uk and NHS 111 Wales\)/.test(c.source) && /British Red Cross, "Burns"/.test(c.source) && (c.source.match(/NHS,/g) || []).length === 1);
check('the lore: Burns\'s night, "abroad" not "all abroad"; the west of Scotland; his nut note', /"thought to be a night when witches, devils, and other mischief-making beings are abroad"/.test(c.lore) && /"the peasantry in the west of Scotland"/.test(c.lore) && /"according as they burn quietly together, or start from beside one another, the course and issue of the courtship will be"/.test(c.lore));
const L = HALLOWEEN_RITES.luggies;
check('the luggies as Burns has them: "the bar of matrimony a maid", a widow, "no marriage at all", three times, the dishes altered', /"the future husband or wife will come to the bar of Matrimony, a Maid"/.test(L.lore) && /the foul, a widow/.test(L.lore) && /"foretells, with equal certainty, no marriage at all\."/.test(L.lore) && /"It is repeated three times; and every time the arrangement of the dishes is altered\."/.test(L.lore) && !/marriage bed/.test(L.lore));
check('…and the signs follow: the clean water a maid, the foul one widowed before; no "you are widowed", no "marry young"', /the one you marry will come to you a maid/.test(L.outcomes[0]) && /the one you marry will have been widowed before/.test(L.outcomes[1]) && !L.outcomes.some((o) => /before you are wed|marry young/.test(o)) && L.outcomes.every((o) => `${L.icon} ${L.name}: ${o}`.length <= 140));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
