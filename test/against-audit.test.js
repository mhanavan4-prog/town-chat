// Against the Witch, read against its sources: Bridget Cleary's two nights
// told apart (the fire and "in the name of God" on the 14th, the Trinity and
// the burning on the 15th, after McCarthy), the doctor's words given as
// McCarthy's, her age "about twenty-six"; Elworthy's pinned heart a pig's;
// Dee relying on scryers, the 1542 Act's repeal in 1547 and its return in
// 1563 and 1604; the witch post's museum entry quoted with its own query
// mark, twenty to twenty-five known, and the mass-house reading in place of
// an unsourced "plain decoration".
const { HOUSEHOLD_RITES } = require('../data/household.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const C = HOUSEHOLD_RITES.changeling_wife, P = HOUSEHOLD_RITES.pinned_heart, S = HOUSEHOLD_RITES.shewstone, W = HOUSEHOLD_RITES.witch_post;
check('Bridget Cleary: about twenty-six; the doctor\'s words as McCarthy wrote them; the fire on the 14th "in the name of God", the Trinity and the burning the next night', /about twenty-six/.test(C.lore) && /McCarthy wrote, "found her suffering from nervous excitement and a slight bronchitis"/.test(C.lore) && /on the night of 14 March held over the fire and asked "Are you Bridget Boland, wife of Michael Cleary, in the name of God\?"/.test(C.lore) && /The next night he asked again, "in the name of the Father, Son and Holy Ghost", and then set her clothes alight/.test(C.lore) && /on a white horse, among a troop of fairies/.test(C.lore));
check('the pinned heart: a pig\'s, as Elworthy\'s note has it, not "when beasts died"', /when a pig died and a witch was blamed, its heart was "stuck full of pins and white thorns"/.test(P.lore) && !/when beasts died/.test(P.lore));
check('the shewstone: Dee relied on scryers; Davies named for the client looking; the 1542 Act quoted, repealed 1547, renewed 1563 and 1604; pretence from 1736', /Dee relied on scryers to look for him/.test(S.lore) && !/Dee did not look himself/.test(S.lore) && /Owen Davies writes/.test(S.lore) && /"where goodes stollen or lost shall become"/.test(S.lore) && /repealed in 1547/.test(S.lore) && /1563 and 1604 named it again/.test(S.lore) && /from 1736 it was punished as a pretence/.test(S.lore));
check('the witch post: twenty to twenty-five; the museum\'s own words and query; given 1884 from Scarborough; fished out; the mass-house reading; no "plain decoration"', /about twenty to twenty-five are known/.test(W.lore) && /"a cross heart stuck with pins and different \?phases of the moon" \(the query is the museum's\)/.test(W.lore) && /"for the purpose of keeping off fairies"/.test(W.lore) && /"in which it was safe to celebrate mass"/.test(W.lore) && !/plain decoration/.test(W.lore) && /Do you know about witch posts\?/.test(W.source) && W.tier === 'folk');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
