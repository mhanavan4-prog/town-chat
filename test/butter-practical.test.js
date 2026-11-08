// The butter that won't come: a practical half (the dairy books on churning
// temperature, Burch, 1888, and Bailey; the Food Standards Agency on raw
// cream; Ruth Osborne at Tring, 1751, from the DNB) and its lore put right
// (Henderson, 1879; Harland and Wilkinson, 1873, in their own words; Scot,
// 1584; Ady, 1656, as Halliwell gives it): a piece of red-hot iron, rowan in
// the byre not over the dairy door, and the hot iron's warmth called a guess.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'butter_wont_come');
check('the working stands: the pendulum, then the rowan, now for the byre with red thread', c && c.steps[0].kind === 'pendulum' && c.steps[1].item === 'rowan_charm' && /bound with red thread, for the byre/.test(c.steps[1].label) && !/dairy door/.test(c.steps[1].label + c.resolution + c.lore));
check('the hot iron, then the thermometer and hot water; Old Marrow cleared', /'that the witch may be burnt out'/.test(c.resolution) && /try the cream with the thermometer/.test(c.resolution) && /A little hot water, stirred in carefully/.test(c.resolution) && /Old Marrow was only leaning on the gate/.test(c.resolution) && !/Whether it was the iron or the warming/.test(c.resolution));
check('the practical half: churning at about 60 degrees, 65 to 68 in winter, and how to warm it; the FSA on raw cream and who should not have it', /Then the practical half/.test(c.resolution) && /about 60 degrees Fahrenheit, 15 or 16 Celsius, and warmer in winter, 65 to 68/.test(c.resolution) && /add a little hot water, or warm some of the cream and pour it back/.test(c.resolution) && /Raw, unpasteurised cream can carry harmful bacteria that cause food poisoning/.test(c.resolution) && /people aged 65 or over, pregnant women, infants and small children, and anyone with a weakened immune system should not have it/.test(c.resolution) && /Food Standards Agency/.test(c.source));
check('…and be slow to blame a neighbour: Ruth Osborne, Tring, 1751', /be slow to blame a neighbour: at Tring in 1751 Ruth Osborne/.test(c.resolution) && /Osborne, Ruth/.test(c.source));
check('the lore: Henderson\'s "most common misdeeds", Lancashire iron and Northumbrian sixpence; Harland and Wilkinson\'s own words, "a piece of red hot-iron"', /'One of the most common misdeeds of witches is to hinder the dairymaid in butter-making,'/.test(c.lore) && /'In Lancashire the witch is driven away by putting a hot iron into the churn, in Northumberland by popping in a crooked sixpence'/.test(c.lore) && /'a piece of red hot-iron is frequently put into the churn, in order that "the witch may be burnt out"'/.test(c.lore) && !/records the cure exactly/.test(c.lore));
check('…the rowan rhyme and the twig in the byre; Scot\'s "comming of butter"; Ady\'s "Come, butter, come"; the dairy books; the iron\'s warmth only a guess', /'Rowan-tree and red thread \/ Put the witches to their speed'/.test(c.lore) && /'bound with scarlet thread'/.test(c.lore) && /'hinder the comming of butter'/.test(c.lore) && /'Come, butter, come'/.test(c.lore) && /'Frequently the butter will not come because the cream is too cold'/.test(c.lore) && /Nobody wrote down that the hot iron worked by warming the cream/.test(c.lore) && !/The practical half is true too/.test(c.lore) && c.tier === 'record' && /Henderson/.test(c.source) && /Lancashire Legends, Traditions/.test(c.source) && /Burch/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
