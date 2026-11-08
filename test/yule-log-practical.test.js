// The Yule log's practical half (GOV.UK fire safety; London Fire Brigade;
// HETAS; Oxfordshire and Dorset & Wiltshire Fire and Rescue on hot ashes; NHS
// on burns and carbon monoxide; Healthier Together), with the saved brand
// cooled for days before it goes in the press; and Chambers (1864) on the brand
// as "a most effectual security to the house against fire", in place of an
// unchecked "classic early English account".
const { CALLERS } = require('../data/callers.js');
const { YULE_RITES } = require('../data/yule.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'yule_log');
check('the scene kept, but the brand doused and cooled in a tin for days before the eldest wraps it', c && /touch last year's brand to the new one/.test(c.resolution) && /douse it, and set it in a lidded tin out on the step, and days later, when it's cold through, the eldest wraps it up herself/.test(c.resolution) && !/In the morning you pull a sound piece from the ashes and she wraps it up/.test(c.resolution));
check('the practical half: a guard, the children back, matches out of reach; nobody leaves it, or it\'s put out before bed', /Then the practical half/.test(c.resolution) && /Put a guard in front of it against sparks and embers/.test(c.resolution) && /keep the matches out of their reach/.test(c.resolution) && /a grown-up sits up with it, or it's put out properly before bed/.test(c.resolution));
check('…the brand hides embers for days: wet, metal tin, lid, outside, never wrapped till cold; ashes likewise', /Wood that looks dead can hide embers for several days/.test(c.resolution) && /wet it, cool it in a metal tin with a lid, outside the house, and never wrap it or put it in a cupboard till it's cold through/.test(c.resolution) && /never a box or a bag/.test(c.resolution));
check('…the chimney twice a year for wood; smoke alarm every floor, monthly; CO alarm and its signs; get out, stay out, 999', /swept at least twice a year if you burn wood/.test(c.resolution) && /a smoke alarm on every floor and test it monthly/.test(c.resolution) && /a carbon monoxide alarm in any room with a fire/.test(c.resolution) && /a headache, dizziness, sickness or confusion indoors can be the gas, so get outside/.test(c.resolution) && /get out, stay out, and call 999/.test(c.resolution));
check('…a burn: cool running water twenty minutes, no butter or ice, cling film laid over; blistered or hand-sized child\'s burn to A&E, 111', /cool running water for twenty minutes, no butter and no ice, and cling film laid loosely over it/.test(c.resolution) && /a child's burn that blisters, or is bigger than their hand, goes to A&E, and 111/.test(c.resolution));
check('…cited, with one NHS citation', /GOV\.UK, "Fire safety in the home"/.test(c.source) && /HETAS/.test(c.source) && /NHS, "Burns and scalds" and "Carbon monoxide poisoning"/.test(c.source) && (c.source.match(/NHS,/g) || []).length === 1 && /Chambers, The Book of Days \(1864\), 24 December/.test(c.source));
const R = YULE_RITES.yulelog;
check('Chambers on the kept brand against fire, in the caller and the rite; no unchecked "classic early English account"', /"a most effectual security to the house against fire\."/.test(c.lore) && /"it was believed that the preservation of last year's Christmas log was a most effectual security to the house against fire\."/.test(R.lore) && !/classic early English account/.test(R.lore) && /Chambers/.test(R.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
