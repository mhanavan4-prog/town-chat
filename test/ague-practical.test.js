// The ague's practical half (NHS, "High temperature (fever) in children";
// NCCIH on feverfew) and its lore put right (Quintus Serenus's Liber
// Medicinalis, in Vollmer's text; Gerard, 1633; Reiter on English malaria;
// Notes and Queries, 1854): no "burn it when he's well", which Serenus doesn't
// say, and no firm third-century date.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'ague');
check('the amulet as Serenus has it: a letter dropped each line, bound with linen and hung round the neck; no burning it', c && /a letter dropped each time, till it narrows to a point/.test(c.resolution) && /bind it with a linen thread and hang it round the lad's neck/.test(c.resolution) && !/Burn it/.test(c.resolution) && c.steps[0].item === 'feverfew_tincture');
check('the practical half: 38 degrees; drink; paracetamol or ibuprofen if distressed, not swapped between, no aspirin under sixteen; no stripping or sponging, no heaped blankets', /A high temperature is 38 degrees or more/.test(c.resolution) && /plenty to drink/.test(c.resolution) && /paracetamol or ibuprofen if he's distressed, but don't swap between the two unless a doctor or nurse says so/.test(c.resolution) && /no aspirin for anyone under sixteen/.test(c.resolution) && /Don't strip him or sponge him down, and don't heap the blankets on/.test(c.resolution));
check('…111 for the young babies, five days, or dried out; 999 for stiff neck, the glass test, light, a first fit, skin colour, drowsiness, breathing; feverfew\'s cautions', /Ring 111 for a baby under three months at 38 or more, or three to six months at 39/.test(c.resolution) && /five days/.test(c.resolution) && /sunken eyes, no tears/.test(c.resolution) && /Ring 999 for a stiff neck, a rash that doesn't fade under a pressed glass/.test(c.resolution) && /a first fit/.test(c.resolution) && /drowsy and hard to wake/.test(c.resolution) && /struggles to breathe/.test(c.resolution) && /chewed fresh it can make the mouth sore, and it's not for a woman with child/.test(c.resolution));
check('the lore: Gerard against the ague; Serenus\'s Latin, "Inscribes", the cone, the linen; the date softened', /'bound to the wrests with bay salt… as a most singular experiment against the ague'/.test(c.lore) && /'Inscribes chartae quod dicitur abracadabra'/.test(c.lore) && /'donec in angustum redigatur littera conum'/.test(c.lore) && /'his lino nexis collum redimire memento'/.test(c.lore) && /perhaps about AD 200/.test(c.lore) && !/3rd century AD/.test(c.lore) && !/so the illness would shrink/.test(c.lore));
check('…the ague as marsh malaria, and the fen charm of 1854; sources cited, the NHS among them', /malaria of the marshes/.test(c.lore) && /'another charm for the ague, in which the fen people put great faith'/.test(c.lore) && /Vollmer/.test(c.source) && /Gerard/.test(c.source) && /Notes and Queries/.test(c.source) && /NHS/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
