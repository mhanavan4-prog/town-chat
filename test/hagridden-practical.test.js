// The hag-ridden mare's practical half (Defra's Code of Practice for horses,
// 2018; the British Horse Society on colic; the Animal Welfare Act 2006) and
// its lore put right (Aubrey, 1696; Herrick, 1648; the First Folio; the Pitt
// Rivers Museum's own record): no "thirsty, sick or cold", no cow doctor, and
// the stone from Rushmore on the Wiltshire–Dorset border, not "Dorset".
const { CALLERS } = require('../data/callers.js');
const { HOUSEHOLD_RITES: HOUSE_RITES } = require('../data/household.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'hagridden');
check('the stone still goes up; the night sweat put down to colic, fever or heat, not cold; no cow doctor', c && c.steps[0].rite === 'hagstone' && /most often in pain, with colic, or feverish, or shut up too hot, not cold; cold horses shiver/.test(c.resolution) && /going short of water makes colic likelier/.test(c.resolution) && !/cow doctor|thirsty, sick or cold|sack over the gap/.test(c.resolution));
check('the practical half: water always, 25 to 50 litres; the signs of colic; the vet at once; pulse, breathing, temperature', /Then the practical half/.test(c.resolution) && /always have clean, fresh water: an average horse drinks 25 to 50 litres a day/.test(c.resolution) && /sweating for no reason, pawing the ground, rolling again and again, looking round at her flanks, or going off her feed/.test(c.resolution) && /send for the vet at once/.test(c.resolution) && /28 to 44 beats a minute, her breathing 8 to 16 breaths, and her temperature 37\.5 to 38\.5 degrees/.test(c.resolution));
check('…an airy stable without draughts, and the duty of care in law', /Keep the stable airy, with a top door or window open, but out of draughts/.test(c.resolution) && /under the Animal Welfare Act it's an offence not to meet a horse's needs as good practice requires/.test(c.resolution) && /Defra/.test(c.source) && /British Horse Society/.test(c.source) && /Animal Welfare Act 2006, s\. 9/.test(c.source));
check('the lore: Aubrey\'s flint by the manger and the Hag that makes horses "sweat all Night"; Herrick\'s hooks and shears; Mab\'s plaited manes', /'To hinder the Night-mare, they hang in a string a Flint with a hole in it \(naturally\) by the Manger'/.test(c.lore) && /'It is to prevent the Night-mare \(viz\.\) the Hag from riding their Horses, who will sometimes sweat all Night\.'/.test(c.lore) && /'HAng up Hooks, and Sheers to scare \/ Hence the Hag, that rides the Mare'/.test(c.lore) && /'the Manes shall be \/ Of your horses, all knot free'/.test(c.lore) && /'plats the manes of Horses in the night'/.test(c.lore) && /Aubrey/.test(c.source) && /Herrick/.test(c.source));
check('…the Pitt Rivers stone: a carter\'s cottage door at Rushmore, on the Wiltshire–Dorset border, to keep away witches', /'found fixed on a nail to the cottage-door' of a carter at Rushmore, on the Wiltshire–Dorset border, 'to keep away witches'/.test(c.lore) && !/in Dorset/.test(c.lore) && /1884\.56\.3/.test(c.source));
const R = HOUSE_RITES.hagstone;
check('the Hagstone rite: Aubrey added, Rushmore on the border, not "in Dorset"', R && /"by the Manger"/.test(R.lore) && /"the Hag from riding their Horses, who will sometimes sweat all Night"/.test(R.lore) && /Rushmore, on the Wiltshire–Dorset border/.test(R.lore) && !/in Dorset/.test(R.lore) && /Aubrey/.test(R.source) && /until the 1930s/.test(R.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
