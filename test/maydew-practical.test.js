// The May Dew's practical half: freckles are the sun's (Primary Care
// Dermatology Society), so sun protection (NHS, "Sunscreen and sun safety"),
// extra care with many freckles and a GP for a mark that changes (NHS,
// "Moles"), and no under-the-counter freckle creams (Chartered Trading
// Standards Institute, 2026); with Chambers' Arthur's Seat and Austen's
// Gowland, whose lotion was mercuric chloride. No record that May dew takes
// away freckles was found, so none is claimed.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'beltane_may_dew');
check('the old scene kept: hauled out in the dark, the cold dew, between her and the sun, pink and laughing', c && /You haul her out of bed in the dark and down to the meadow/.test(c.resolution) && /Whether the freckles go is between her and the sun/.test(c.resolution) && /pink and laughing all the way home/.test(c.resolution));
check('the lore: Woolwich and Mrs Turner; Chambers\' Arthur\'s Seat; Austen\'s Gowland and its mercuric chloride; no claim that the dew takes freckles', /Pepys's wife went to Woolwich/.test(c.lore) && /"the only thing in the world to wash her face with"/.test(c.lore) && /"and wash their faces with dew"/.test(c.lore) && /Arthur's Seat/.test(c.lore) && /"the constant use of Gowland, during the spring months"/.test(c.lore) && /mercuric chloride/.test(c.lore) && !/dew (removes|takes away|cures) freckles/.test(c.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
