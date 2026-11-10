// The Milk Will Not Come: the practical half for Bramble's mastitis (AHDB,
// "Symptoms of mastitis"; NADIS on treatment, the sick cow and milking order;
// FSA Scotland on her milk), without the "warm cloths" no vet source gives;
// and the lore put right: Thomas Cook's indictment of 1700 (Chambers), the
// Peeblesshire shepherd of 1814 (Scots Magazine), Banffshire's byre doors
// (1902), and Easter Ross in 1750 against Campbell's "unknown in the
// Highlands"; the unconfirmed Craigmillar cutting of 1831 left out.
const { CALLERS } = require('../data/callers.js');
const { HOUSEHOLD_RITES } = require('../data/household.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'byre_rowan');
check('the old scene kept: rowan and red thread, the hot hard quarter, the cow doctor today, Leave Elspet be; no warm cloths', c && /You hang rowan and red thread over the byre door/.test(c.resolution) && /one quarter of her udder is hot and hard/.test(c.resolution) && /it wants the cow doctor today/.test(c.resolution) && /Leave Elspet be/.test(c.resolution) && !/warm cloths/.test(c.resolution));
check('the practical half: the signs in the udder and the milk; the vet, intramammary antibiotic and painkiller, a plan', /Then the practical half\. A swollen, hot, hard, red or painful quarter, with clots, flakes or watery milk from it and less milk overall, is mastitis/.test(c.resolution) && /a tube of antibiotic into the quarter and something for the pain and swelling/.test(c.resolution) && /a treatment plan you agree with him/.test(c.resolution));
check('…off her food, dull, down, cold or sunken-eyed is the vet now; strip it out; milk her last or with her own cluster, gloves; her milk kept out, the withdrawal time', /If she goes off her food, goes dull, or is down, cold or sunken-eyed, she is very ill and needs the vet now/.test(c.resolution) && /Strip that quarter out by hand, as the vet tells you/.test(c.resolution) && /Milk her last, after the healthy cows, or with her own cluster, and wear gloves/.test(c.resolution) && /not drunk or sold/.test(c.resolution) && /withdrawal time/.test(c.resolution) && /AHDB/.test(c.source) && /NADIS/.test(c.source));
check('the caller\'s lore: Banffshire\'s byre doors; Thomas Cook, 1700, Auchencraw; the Peeblesshire shepherd; no Craigmillar, no Kelso Chronicle', /"over the byre doors and along the eaves you would see 'raan' or rowan sticks and red thread\."/.test(c.lore) && /Thomas Cook/.test(c.lore) && /Auchencraw/.test(c.lore) && /Peeblesshire shepherd/.test(c.lore) && !/Craigmillar/.test(c.lore) && !/Kelso/.test(c.source) && /Scots Magazine \(October 1814\)/.test(c.source));
const R = HOUSEHOLD_RITES.rowan_thread;
check('the rite: Cook\'s indictment and the 1814 shepherd quoted; Campbell\'s "unknown in the Highlands" set against Obsdale, 1750; no 1831', /"for scoring a woman in Auchencraw above the breath"/.test(R.lore) && /"dissatisfied with the quantity of milk which some of his cows yielded"/.test(R.lore) && /"unknown in the Highlands"/.test(R.lore) && /Obsdale in Easter Ross in 1750/.test(R.lore) && !/1831/.test(R.lore) && !/Kelso/.test(R.source) && /Tain Museum/.test(R.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
