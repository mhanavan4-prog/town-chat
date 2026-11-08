// The aspen ague: a practical half (NHS, "Malaria"; GOV.UK's malaria
// factsheet and UKHSA; NHS on fever in adults) and the lore put right: the
// hair bound round the aspen with a prayer, as Gordon Cumming has it for
// Lincolnshire (1887), not pinned with a thorn to an unverified rhyme; the
// Cross legend (Carmina Gadelica, 1900; Brewer, 1894); and the fen ague as
// tertian malaria (Reiter, 2000; Nicholls, 2000).
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'aspen_ague');
check('the hair bound round the trunk, the aspen asked to shake in her stead; no thorn, no rhyme, no looking back', c && c.steps[0].item === 'aspen_leaf' && /asks the aspen, through you, to shake in her stead/.test(c.resolution) && /You bind the hair round the trunk, as they did in Lincolnshire/.test(c.resolution) && !/thorn|Aspen tree, aspen tree|without looking back/.test(c.resolution + c.lore));
check('the practical half: malaria gone from England; fever after travel in the last 12 months an emergency, urgent GP or 111, a year after the trip', /Then the practical half/.test(c.resolution) && /it has gone from England, and malaria isn't caught here now/.test(c.resolution) && /within the last 12 months, is an emergency: get an urgent GP appointment or ring 111 the same day/.test(c.resolution) && /you could still have malaria a year after the trip/.test(c.resolution) && /NHS, "Malaria"/.test(c.source));
check('…the ABCD, with DEET, nets, covered arms and legs, tablets, prompt testing; a fever at home not getting better, urgent GP or 111', /follow the ABCD: know the risk, avoid the bites with a 50% DEET repellent, a treated net, and arms and legs covered in the evening, take the antimalarial tablets, and get tested promptly/.test(c.resolution) && /a fever at home that isn't getting better, or is getting worse, means an urgent GP appointment or 111/.test(c.resolution) && /GOV\.UK, "Malaria factsheet"/.test(c.source));
check('the lore: Gordon Cumming\'s Lincolnshire girl and her prayer; Henderson\'s index; the Cross from Carmichael and Brewer', /'In Lincolnshire, a girl suffering from ague, cuts a lock of her hair, and binds it round an aspen-tree, praying it to shake in her stead'/.test(c.lore) && /'charm for ague'/.test(c.lore) && /'was chosen by the enemies of Christ for the cross upon which to crucify the Saviour of mankind'/.test(c.lore) && /'The Aspen leaf is said to tremble because the cross was made of Aspenwood'/.test(c.lore) && /Gordon Cumming/.test(c.source) && !/Roud/.test(c.source));
check('…the ague as malaria (Reiter); tertian vivax in the Fens (Nicholls); the last English case in the 1950s', /'The English word for malaria was ague, a term that remained in common usage until the 19th century'/.test(c.lore) && /'a benign, tertian malaria, caused by Plasmodium vivax'/.test(c.lore) && /1950s/.test(c.lore) && /Nicholls/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
