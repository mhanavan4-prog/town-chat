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
check('the practical half: freckles are the sun\'s, more in summer, fading in winter; SPF 30, four-star UVA, every two hours, shade eleven to three, a hat', /Then the practical half, which is the sun's\. Freckles come from the sun, more and bigger in summer and fading in winter/.test(c.resolution) && /at least SPF 30 with four-star UVA or better, put on again every two hours/.test(c.resolution) && /shade between eleven and three from March to October/.test(c.resolution) && /a wide-brimmed hat/.test(c.resolution));
check('…many freckles, higher risk; the GP for a mark that changes, itches, bleeds or crusts, or a new one that stays', /Lots of freckles or moles means a higher chance of skin cancer than most/.test(c.resolution) && /tell the GP about any mole or freckle that changes size, shape or colour, itches, bleeds or crusts, or any new mark that hasn't gone in a few weeks/.test(c.resolution));
check('…no under-the-counter creams: hydroquinone, mercury, strong steroids banned; cited', /never a freckle cream from under the counter: skin-lightening creams with hydroquinone, mercury or strong steroids are banned in the UK/.test(c.resolution) && /Chartered Trading Standards Institute/.test(c.source) && /NHS, "Sunscreen and sun safety" and "Moles"/.test(c.source) && /Primary Care Dermatology Society/.test(c.source));
check('the lore: Woolwich and Mrs Turner; Chambers\' Arthur\'s Seat; Austen\'s Gowland and its mercuric chloride; no claim that the dew takes freckles', /Pepys's wife went to Woolwich/.test(c.lore) && /"the only thing in the world to wash her face with"/.test(c.lore) && /"and wash their faces with dew"/.test(c.lore) && /Arthur's Seat/.test(c.lore) && /"the constant use of Gowland, during the spring months"/.test(c.lore) && /mercuric chloride/.test(c.lore) && !/dew (removes|takes away|cures) freckles/.test(c.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
