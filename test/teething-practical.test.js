// The teething child's practical half (NHS: teething, drinks for babies, safe
// sleep) and its lore put right (Campbell, 1900; Henderson, 1879; Lady Wilde,
// 1887; Harland and Wilkinson, 1867; Gregor, 1881; Potter, 1902): no tisane
// for the baby, no salt in the cot, and salt only where the record has it.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'sleepless_child');
check('the tisane is for the mother, and the salt goes by the cradle, not in it', c && /for Mary/.test(c.steps[1].label) && /for her mother's peace of mind/.test(c.steps[2].label) && /The chamomile is for Mary/.test(c.resolution) && /on the shelf by the cradle, not in it/.test(c.resolution));
check('the practical half: the signs of teething; 38 degrees isn\'t teething, 111 or the GP; a ring from the fridge not the freezer, never round the neck; a clean finger on the gum', /sore red gum, dribbles, chews everything, has a flushed cheek, and sleeps badly/.test(c.resolution) && /a temperature of 38 degrees or more isn't teething, so ring 111 or the GP/.test(c.resolution) && /cooled in the fridge, never the freezer, and never tie one round his neck/.test(c.resolution) && /clean finger/.test(c.resolution));
check('…paracetamol from 2 months, ibuprofen from 3; no sugary rusks, no honey before one, no tea of any kind, milk only under six months; on his back, feet to foot, the cot clear', /Paracetamol can be given from 2 months and ibuprofen from 3/.test(c.resolution) && /No sugary rusks, no honey before he's one, and no tea, herbal or otherwise/.test(c.resolution) && /milk is all a baby under six months needs/.test(c.resolution) && /on his back, feet to the foot of the cot, with nothing in it that could cover his face/.test(c.resolution));
check('the lore: Campbell\'s iron poker, Henderson\'s carving knife, Wilde\'s salt in the dress; the coral and the bannock; Potter\'s tablespoonful', /'In the North of Ireland, an iron poker, laid across the cradle, kept away the Fairies till the child was baptized'/.test(c.lore) && /carving knife hung from the head of the cradle/.test(c.lore) && /'a little salt tied up in the child's dress when it is laid to sleep in the cradle'/.test(c.lore) && /coral with bells/.test(c.lore) && /'teethin bannock'/.test(c.lore) && /'One table-spoonful to be taken at bed-time'/.test(c.lore));
check('…no more "iron and salt across Scotland, Ireland and England" or "longest-lived remedy"; record, with the collectors and the NHS cited', !/across Scotland, Ireland and England/.test(c.lore) && !/longest-lived/.test(c.lore) && c.tier === 'record' && /Campbell/.test(c.source) && /Wilde/.test(c.source) && /NHS/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
