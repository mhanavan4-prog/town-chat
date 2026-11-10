// The death in the house: a practical half (NHS on the last hours and days;
// Marie Curie; GOV.UK on what to do after a death; NHS trusts and nidirect on
// expected and unexpected deaths at home; Cruse) and its lore put right
// (Napier, 1879; Notes and Queries, 1850; Thiselton Dyer, 1881 and 1893;
// Henderson, 1879; Gregor, 1881; Frazer, 1890).
const { CALLERS } = require('../data/callers.js');
const { HOUSEHOLD_RITES: R } = require('../data/household.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'death_in_house');
check('the old working stands: salt, then the doors, the clock and the glass', c && c.steps[0].item === 'salt' && c.steps[1].rite === 'death_house' && /stop the clock and cover the glass/.test(c.resolution));
check('the caller\'s lore: Napier\'s "struggled hard and long", the clock and glass straight after the death, the salt at the laying-out, "ostensibly"', /'struggled hard and long'/.test(c.lore) && /'that the spell might be broken, and the spirit let loose'/.test(c.lore) && /after the death the clock was stopped and the looking-glass covered, and when the body was laid out a plate of salt/.test(c.lore) && /'ostensibly to prevent the body swelling'/.test(c.lore) && !/dying hard|and later the clock/.test(c.lore) && /Napier/.test(c.source));
const D = R.death_house;
check('the rite\'s lore: Napier, Exeter 1850, Dyer\'s four countries; the clock and glass as Napier gives them, the unconfirmed Henderson left out; salt for swelling or for spirits; Pennant reported, not saw; Frazer\'s theory dated', /"it was therefore customary, under these circumstances, for the attendants to open every lock in the house, that the spell might be broken, and the spirit let loose\."/.test(D.lore) && /"any bolt or lock fastened was supposed to cause uneasiness to, and hinder the departure of the soul"/.test(D.lore) && /"a superstition common in France, Germany, Spain, and England"/.test(D.lore) && !/time is over/.test(D.lore) && /"The clock was stopped, the looking-glass was covered with a cloth"/.test(D.lore) && /"to keep the evil spirits away"/.test(D.lore) && /Pennant reported/.test(D.lore) && !/Pennant saw/.test(D.lore) && /Gregor/.test(D.source) && !/Henderson/.test(D.source) && /Frazer/.test(D.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
