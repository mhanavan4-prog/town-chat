// The Turning Year, February and March, read against its sources: the
// Shrove Tuesday death near Birstall, not "at Leeds", and Taylor's
// Jack-a-Lent dated as first printed (1617?) and as Knowlson's 1630 text,
// not "1620"; Herrick's simnel in the 1648 spelling; Lloyd George's daffodil
// as Museum Wales tells it; St Patrick's shamrock drowned by the rule on
// Sheelah's night, the 18th; Dinely in the 1856–57 Journal; Lady Day's Hone
// in vol. I (1826).
const one = (o) => Object.values(o)[0];
const S = one(require('../data/shroveTuesday.js').SHROVE_RITES);
const M = one(require('../data/mothering.js').MOTHERING_RITES);
const D = one(require('../data/stDavid.js').DAVID_RITES);
const P = one(require('../data/stPatrick.js').PATRICK_RITES);
const L = one(require('../data/ladyDay.js').LADY_RITES);
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
check('Shrove Tuesday: near Birstall; Taylor 1617? and the 1630 text', /near Birstall in 1783/.test(S.lore) && !/at Leeds in 1783/.test(S.lore) && /first printed 1617\?; the 1630 Workes text/.test(S.source) && !/\(1620\)/.test(S.source));
check('Mothering Sunday: the 1648 "I\'Le … Simnell"', /"I'Le to thee a Simnell bring, \/ 'Gainst thou go'st a mothering"/.test(M.lore));
check('St David: the daffodil as Museum Wales tells it', /used it in the ceremonies for the investiture of 1911/.test(D.lore));
check('St Patrick: drowned on Sheelah\'s night by the rule; Dinely 1856–57', /"on the latter night, be drowned in the last glass"/.test(P.lore) && /Sheelah's night, the 18th/.test(P.how) && /\(1856–57\)/.test(P.source));
check('Lady Day: Hone vol. I (1826)', /Every-Day Book, vol\. I \(1826\), 25 March/.test(L.source) && !/vol\. II \(1827\)/.test(L.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
