// The House and the Hive, read against its sources: the king's evil without
// the unsourced kneeling, "Hanoverians" or "17th-century note"; Campbell's
// full title, and his "dance to dead" not called Highland; five women cut at
// Obsdale; Howard's two explanations, Soane's cat with the rat in its mouth,
// the Sudbury plaque as worded; the hagstone without the unquoted
// "self-holed" or the witch-ball date; Martin's "for that end"; the
// need-fire without the unconfirmed Mull heifer; Gowdie's disputed line
// paraphrased; Henderson's unconfirmed lykewake quotes left out; the
// kindling blessing by its number and title, and no "year's end to the next".
const { HOUSEHOLD_RITES: H } = require('../data/household.js');
const { KINDLING } = require('../data/hearth.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

check('the king\'s evil: RCP on Anne; the Cambridge note undated, Mizaldus 16th-century; no kneeling', /"The death of Anne in 1714 marked the end of this ceremony in England\."/.test(H.kings_evil.lore) && /an undated note in a Cambridge manuscript, citing the 16th-century physician Mizaldus/.test(H.kings_evil.lore) && !/knelt|Hanoverians/.test(H.kings_evil.lore) && /MS Dd\. 2\. 41/.test(H.kings_evil.source));
check('Campbell by his full title, twice; forspeaking in the north-east and the Northern Isles; Carmichael\'s water not called silver', /Witchcraft & Second Sight in the Highlands & Islands of Scotland \(1902\)/.test(H.silver_water.source) && /Witchcraft & Second Sight in the Highlands & Islands of Scotland \(1902\)/.test(H.rowan_thread.source) && /In the north-east and the Northern Isles/.test(H.silver_water.lore) && !/Lowlands/.test(H.silver_water.lore) && /he does not call it silver water/.test(H.silver_water.lore));
check('rowan: "Gars a\' the witches dance to dead" in Campbell, not "in the Highlands"; five women at Obsdale', /another version, which Campbell gives, it "Gars a' the witches dance to dead"/.test(H.rowan_thread.lore) && !/in the Highlands it/.test(H.rowan_thread.lore) && /five women, two mothers and their daughters among them/.test(H.rowan_thread.lore));
check('the dried cat: two explanations, the rat in its mouth, Lord Yarborough\'s house, the plaque\'s wording', /offered two explanations/.test(H.dried_cat.lore) && /"Lord Yarborough's House in Chelsea"/.test(H.dried_cat.lore) && /"after four years eventful absence"/.test(H.dried_cat.lore) && !/1803|posed/.test(H.dried_cat.lore));
check('the hagstone: no quoted "self-holed", Aubrey\'s capital S, no witch-ball date', !/self-holed|1930s/.test(H.hagstone.lore) && /who will sometimes Sweat all Night"/.test(H.hagstone.lore));
check('second sight: Martin\'s "for that end"', /used by the person that sees it for that end"/.test(H.second_sight.lore));
check('need-fire: no unconfirmed Mull heifer or country list', !/Mull|heifer|Germany/.test(H.need_fire.lore) && /Balder the Beautiful/.test(H.need_fire.lore));
check('elf-shot: Gowdie paraphrased past "We haw no bow to shoot with"', /"We haw no bow to shoot with"/.test(H.elf_shot.lore) && !/naillis/.test(H.elf_shot.lore));
check('opening the door: no unconfirmed Henderson, no uncited Domestic Folk-Lore', !/Henderson|time is over/.test(H.death_house.lore + H.death_house.source) && !/Domestic Folk-Lore/.test(H.death_house.source));
check('the toadman\'s bone: Rolfe\'s anthill, no whitethorn', /left on an anthill/.test(H.toad_bone.lore) && !/whitethorn/.test(H.toad_bone.lore));
check('kindling: no. 82 "Blessing of the Kindling", no. 84\'s fire kept in, no "year\'s end"', /no\. 82, "Blessing of the Kindling", and no\. 84/.test(KINDLING.source) && /"Where wood is not obtainable the fire is kept in during the night"/.test(KINDLING.lore) && !/year's end/.test(KINDLING.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
