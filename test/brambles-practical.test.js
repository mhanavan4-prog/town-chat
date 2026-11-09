// Before Michaelmas: the practical half for the picking (Food Standards
// Agency, "Guidance for safe foraging"), the jam pan and its burns (NHS),
// the jars (Coventry Trading Standards) and Mother Furlong's legs (NHS,
// "Falls"); the honest half grounded in grey mould on over-ripe fruit; the
// Devil's days set out by place (Folkard, 1884; Old Michaelmas in Sussex;
// Samhain in Ireland), and no "far hotter than boiling" for jam.
const { CALLERS } = require('../data/callers.js');
const { WHEEL_RITES } = require('../data/wheelRites.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'mabon_michaelmas_brambles');
check('the old scene kept: the lane hedge stripped, the steamed-up windows, "the Devil anyway"; the honest half is the grey mould', c && /You strip the lane hedge just in time and she makes the jam with the windows steamed up/.test(c.resolution) && /it was the Devil anyway/.test(c.resolution) && /in the wet the grey mould gets into them/.test(c.resolution));
check('the practical half: above dog height, away from busy roads, washed, some left for the birds, nothing uncertain', /Then the practical half, for the picking and the pan/.test(c.resolution) && /Pick above the height a dog can reach and away from busy roadsides, wash them well whatever hedge they came off/.test(c.resolution) && /leave plenty for the birds/.test(c.resolution) && /eat nothing you aren't certain is a blackberry/.test(c.resolution));
check('…jam only a few degrees hotter, but it clings: a deep pan half full, a long spoon, children out; the burn cooled twenty minutes, A&E if large or deep', /only a few degrees hotter than boiling water, but it's sticky and it clings/.test(c.resolution) && /a deep pan no more than half full, a long-handled spoon, and the children out of the kitchen/.test(c.resolution) && /cool running water for twenty minutes and cling film laid over it, and a large or deep one goes to A&E/.test(c.resolution) && !/far hotter/.test(c.resolution));
check('…jars sterilised ten minutes at 160°C, lids on hot; low-sugar jam in the fridge; mould binned, not scraped; shoes that grip and a stick', /ten minutes at 160°C, and put the lids on while the jam's still hot/.test(c.resolution) && /a jam with less sugar goes in the fridge once it's opened/.test(c.resolution) && /a jar with mould on it goes in the bin, not scraped/.test(c.resolution) && /shoes that grip, and a stick/.test(c.resolution));
check('…cited: the FSA, Trading Standards, the NHS once', /Food Standards Agency/.test(c.source) && /Trading Standards/.test(c.source) && /NHS, "Burns and scalds" and "Falls"/.test(c.source) && (c.source.match(/NHS,/g) || []).length === 1);
check('the lore: Threlkeld\'s club; Sussex on Old Michaelmas and Folkard\'s spitting; the Scottish cloak in Folkard\'s words; Ireland till Samhain', /"the D—l casts his club over them"/.test(c.lore) && /Old Michaelmas Day \(10 October\)/.test(c.lore) && /"goes round the county and spits on the Blackberries"/.test(c.lore) && /"throws his cloak over the Blackberries, and renders them unwholesome"/.test(c.lore) && /Samhain/.test(c.lore) && /Folkard/.test(c.source));
const R = WHEEL_RITES.michaelmas;
check('the rite: no "most widespread"; the pooka at Samhain; the grey mould "particularly in wet, humid and cool conditions"', !/most widespread/.test(R.lore) && /the "pooka crawls on them"/.test(R.lore) && /"particularly in wet, humid and cool conditions"/.test(R.lore) && /Folkard/.test(R.source) && /Threlkeld.*1727/.test(R.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
