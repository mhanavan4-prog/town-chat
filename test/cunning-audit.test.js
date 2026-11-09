// The Cunning Folk, read against their records (the 1566 Walsh pamphlet, the
// two 1652 Peterson pamphlets and Bower's 1653 Bodenham read in full; the
// Dictionary of Welsh Biography; History Ireland; the Survey of Scottish
// Witchcraft): Joan Peterson acquitted of Lady Powel and hanged over
// Christopher Wilson; Walsh examined on 20 August; Wrightson only probably
// the 1800 paper's "Wise Man"; Murrell's chest of letters, not horoscopes;
// Biddy Early's priests attending, not saying Mass; Harries "one of the
// best-known", dead on 11 May 1839, the padlocked book unknown to the
// Library; Bessie Dunlop "convict and brynt"; Head's Shipton printed 1677.
const { CUNNING_FOLK } = require('../data/cunningFolk.js');
const F = Object.fromEntries(CUNNING_FOLK.map((f) => [f.id, f]));
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

check('Joan Peterson: not guilty of Lady Powel, hanged at Tyburn over Christopher Wilson; the Declaration quoted as printed; the Folger post by its title', /found not guilty of it, and hanged at Tyburn for bewitching a sick man, Christopher Wilson/.test(F.joan_peterson.summary) && !/hanged in April 1652 for bewitching to death/.test(F.joan_peterson.summary) && /amongst the Neighboures/.test(F.joan_peterson.quote) && /Printed Pamphlets for the Witch of Wapping/.test(F.joan_peterson.source));
check('John Walsh: 20 August 1566; the quote as printed; Murray printed only part', /examined on 20 August 1566/.test(F.john_walsh.summary) && !/23 August/.test(F.john_walsh.summary) && F.john_walsh.quote === 'ther be. iii. kindes of Feries, white, greene, & black.' && /in part in M\. Murray/.test(F.john_walsh.source));
check('Wrightson: the 1800 paper\'s unnamed "Wise Man", probably him; one ostler and a code of signals', /"had been to the Wise Man"/.test(F.wrightson.summary) && /probably Wrightson, though the paper does not name him/.test(F.wrightson.summary) && /"a code of signals"/.test(F.wrightson.fact));
check('Murrell: born about 1781; died 16 December 1860; letters, notes and books in the chest, no horoscopes; "to the very minute"', /born about 1781/.test(F.murrell.summary) && /16 December 1860/.test(F.murrell.fact) && /clients' letters/.test(F.murrell.fact) && !/horoscopes, charms against spirits/.test(F.murrell.fact) && /"to the very minute"/.test(F.murrell.legend));
check('Biddy Early: most, not everyone, said the fairies; the Chronicle of 29 July 1869; 27 priests attended; Maxwell cited', /most said had come from the fairies/.test(F.biddy_early.summary) && /29 July 1869/.test(F.biddy_early.fact) && /27 priests attended her funeral/.test(F.biddy_early.legend) && /Maxwell/.test(F.biddy_early.source));
check('Harries: one of the best-known; Henry seems to have; 11 May 1839; the Library has no record of the padlocked book', /One of the best-known of the dyn hysbys/.test(F.harries.summary) && /seems to have carried/.test(F.harries.summary) && /11 May 1839/.test(F.harries.fact) && /The National Library has no record of the padlocked volume/.test(F.harries.legend));
check('Bessie Dunlop: a tenant\'s wife; "convict and brynt"; Henderson\'s chapter named; no unsourced "one record leaves her fate unclear"', /tenant's wife/.test(F.bessie_dunlop.summary) && /"convict and brynt"/.test(F.bessie_dunlop.fact) && !/leaves her fate unclear/.test(F.bessie_dunlop.fact) && /Fantastical Imaginations \(2009\)/.test(F.bessie_dunlop.source));
check('Anne Bodenham at the Lent Assizes, "aged 80. years"; Mother Shipton eighty years on, the DNB\'s commas, Head printed 1677', /Lent Assizes of 1653, "aged 80\. years"/.test(F.anne_bodenham.fact) && /some eighty years after/.test(F.mother_shipton.summary) && /"in all likelihood, a wholly mythical personage"/.test(F.mother_shipton.summary) && /printed 1677/.test(F.mother_shipton.fact));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
