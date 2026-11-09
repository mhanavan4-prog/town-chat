// Bringing in the Green: the practical half for a house full of greenery (the
// London Fire Brigade on decorations and heat; the berries, after the National
// Poisons Information Service via the Pharmaceutical Journal; NHS on
// poisoning; PDSA on pets; RHS on ivy sap; the green bin); and the lore read
// from the texts: Stow's houses decked with holme and ivy, and Herrick's
// goblin lines as Pollard prints them, in place of "one of the best-recorded
// of all English customs".
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'bringing_in_green');
check('the old scene kept: holly over the door, ivy about the hearth, out by Candlemas Eve, the date in chalk', c && /Holly over the door, ivy wound about the hearth/.test(c.resolution) && /all of it out of the house by Candlemas Eve/.test(c.resolution) && /writes the date on the wall in chalk/.test(c.resolution));
check('the practical half: dried greenery near fire or flame catches fast; kept back from hearth, heaters and flame', /Then the practical half, for a house full of green/.test(c.resolution) && /dried greenery near a fire or a candle catches and spreads fast/.test(c.resolution) && /keep it well back from the hearth, the heaters and any flame/.test(c.resolution));
check('…the berries: a few holly mostly a sore stomach, mistletoe\'s poisonous, out of reach; 111 if unsure, 999 if very unwell, never made sick', /a few holly berries mostly mean a sore stomach, but mistletoe's are poisonous/.test(c.resolution) && /where small hands can't reach/.test(c.resolution) && /ring 111; if they're very unwell, 999; and never try to make them sick/.test(c.resolution));
check('…cats and dogs and the vet; ivy sap and gloves; the green bin or compost; cited', /poisonous to cats and dogs too, so the vet straight away/.test(c.resolution) && /Ivy sap can bring the skin up, so gloves/.test(c.resolution) && /the green bin or the compost heap/.test(c.resolution) && /London Fire Brigade/.test(c.source) && /NHS, "Poisoning"/.test(c.source) && /PDSA/.test(c.source) && /RHS/.test(c.source));
check('the lore: Stow quoted; Herrick\'s goblin lines as Pollard prints them; no "best-recorded of all"', /"euery mans house, as also their parish churches were decked with holme, Iuie, Bayes/.test(c.lore) && /"Down with the rosemary, and so \/ Down with the bays and misletoe; \/ Down with the holly, ivy, all"/.test(c.lore) && /"For look, how many leaves there be \/ Neglected, there \(maids, trust to me\) \/ So many goblins you shall see\."/.test(c.lore) && !/best-recorded/.test(c.lore) && /Ceremony upon Candlemas Eve/.test(c.source) && /Stow/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
