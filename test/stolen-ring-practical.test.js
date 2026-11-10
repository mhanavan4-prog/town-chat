// The stolen ring: a practical half (GOV.UK on reporting a crime; Immobilise;
// the pawnbrokers' checks; slander and the Defamation Act 2013) and the lore
// put right (Scot's Discoverie, XII.17; Jonson's Alchemist, I.i; Henderson,
// 1879, ch. VI, for Allice Swan and the Stokesley miller; Keith Thomas, unconfirmed, dropped): the
// sieve held up by two, the "tricks / Of cozening", goods sometimes returned,
// and the pendulum and the cards called late.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'stolen_ring');
check('the sieve held up by two, a fingertip each; no names, only quarters; the ring back on the step', c && /You and Tom hold the sieve up between you, a fingertip each under the shears/.test(c.resolution) && /name no names, only quarters of the village/.test(c.resolution) && /back on his step, wrapped in a dock leaf/.test(c.resolution));
check('the practical half: 999 if it\'s happening, 101 or online, Crimestoppers; the crime reference number', /Then the practical half/.test(c.resolution) && /If a theft is happening now, or anyone is in danger, ring 999; otherwise report it on 101 or online, or anonymously to Crimestoppers on 0800 555 111/.test(c.resolution) && /crime reference number, which an insurer may ask for/.test(c.resolution) && /GOV\.UK, "Report a crime"/.test(c.source));
check('…photographs and Immobilise; CheckMEND; and slander, for theft is imprisonable', /Photograph rings and jewellery, and register them free on Immobilise/.test(c.resolution) && /the second-hand trade can check items against CheckMEND/.test(c.resolution) && /can be slander, because theft is a crime that can be punished with prison/.test(c.resolution) && /Defamation Act 2013/.test(c.source));
check('the lore: Scot\'s two persons, Peter and Paul, the sieve turning, and his "slight of the fingers"; no Brewer formula', /'Stick a pair of Sheers in the rind of a Sieve, and let two persons set the top of each of their Forefingers upon the upper part of the Sheers'/.test(c.lore) && /'ask Peter and Paul whether A\. B\. or C\. hath stoln the thing lost, and at the nomination of the guilty person, the Sieve will turn round'/.test(c.lore) && /'slight of the fingers'/.test(c.lore) && !/By St\. Peter and St\. Paul/.test(c.lore) && !/balanced on two fingers/.test(c.lore) && /Scot/.test(c.source));
check('…Face\'s "tricks / Of cozening"; Allice Swan\'s penance; the Stokesley weights; the pendulum and cards called late', /'tricks \/ Of cozening'/.test(c.lore) && /'Searching for things lost, with a sieve and sheers'/.test(c.lore) && /'to cast or tourne the riddle and sheares'/.test(c.lore) && !/Keith Thomas/.test(c.lore) && /'as mysteriously as they had vanished, being placed at the miller's door'/.test(c.lore) && /France in the 1780s/.test(c.lore) && /pendulum for finding lost things belongs to the twentieth century/.test(c.lore) && !/often quietly returned/.test(c.lore) && /Henderson/.test(c.source) && !/Thomas, Religion/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
