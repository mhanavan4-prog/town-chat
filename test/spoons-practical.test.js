// The silver spoons: a practical half (the Met's "Mark your property" and
// Immobilise; reporting a theft; Acas on investigating fairly; the EHRC on
// Gypsies and Irish Travellers), and the lore put right: Scot's own words
// (XII.17); the sieve in New England as Rebecca Johnson owned to it (Salem
// Witch Trials Papers, 1692) and Cotton Mather condemned it (1693); Thomas's
// "deterrent", not "rarely caught"; and Agrippa dropped (no sieve in the 1651
// Three Books).
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'silver_spoons');
check('the practical half: photograph with a ruler, the marks and inscriptions, receipts; Immobilise; 101, online, 999', c && /Then the practical half/.test(c.resolution) && /Photograph the silver, a ruler beside each piece, write down its marks and any inscription, and keep any receipts/.test(c.resolution) && /register it free on Immobilise/.test(c.resolution) && /report it on 101 or online, or ring 999 if it's happening now/.test(c.resolution) && /Mark your property/.test(c.source));
check('…a suspicion isn\'t evidence: investigate fairly, evidence from all sides; Gypsies and Irish Travellers recognised and protected', /a suspicion isn't evidence: an employer must look into a matter fairly and gather evidence from all sides/.test(c.resolution) && /Gypsies and Irish Travellers are legally recognised ethnic groups, protected under equality law/.test(c.resolution) && /Acas/.test(c.source) && /EHRC/.test(c.source));
check('the lore: Scot\'s two persons and their forefingers, Peter and Paul, the sieve turning; his pulse and slight of the fingers', /let two persons set the top of each of their Forefingers upon the upper part of the Sheers, holding it with the Sieve up from the ground steadily, and ask Peter and Paul whether A\. B\. or C\. hath stoln the thing lost, and at the nomination of the guilty person, the Sieve will turn round'/.test(c.lore) && /'the beating of the pulse' and 'slight of the fingers'/.test(c.lore) && /Scot/.test(c.source));
check('…Face\'s "tricks / Of cozening"; New England\'s sieve: Rebecca Johnson at Andover, Cotton Mather\'s conjurations', /'tricks \/ Of cozening'/.test(c.lore) && /at Andover in 1692 Rebecca Johnson owned to 'the turneing of the sieve', with the words 'By Saint Peter & Saint Paul'/.test(c.lore) && /'detestable Conjurations, with Sieves, and Keys' \(1693, as reprinted\)/.test(c.lore) && /Salem Witch Trials Papers/.test(c.source) && /Mather/.test(c.source));
check('…Thomas\'s deterrent, not "rarely caught"; Agrippa and the unquoted Brewer gone', /'both a deterrent and a means of detection'/.test(c.lore) && !/rarely caught/.test(c.lore) && !/often brought/.test(c.lore) && !/Agrippa/.test(c.source) && !/Brewer/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
