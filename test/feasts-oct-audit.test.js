// The Turning Year, October and early November, read against its sources:
// Hone's Horn Fair and Simon and Jude in vol. I (1826); "too ridiculous" is
// Brand's, as Hone quotes him; Holinshed's margin does name "The euen of
// Simon and Iude"; Hone's "[Fawkes]" kept; Cressy's chapter in Myths of the
// English; Aubrey recorded souling rather than saw it, and Burne's book ran
// 1883–86; Moore's dates are of Hollantide's eve.
const one = (o) => Object.values(o)[0];
const H = one(require('../data/hornFair.js').HORN_RITES);
const S = one(require('../data/simonJude.js').SIMON_JUDE_RITES);
const F = one(require('../data/fifthNovember.js').FIFTH_RITES);
const SC = one(require('../data/souling.js').SOUL_RITES);
const HT = one(require('../data/hopTuNaa.js').HOP_RITES);
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
check('Horn Fair: Hone vol. I; "too ridiculous" is Brand\'s', /vol\. I \(1826\), 18 October/.test(H.source) && /Brand, whom Hone quotes, "too ridiculous/.test(H.lore));
check('Simon and Jude: Hone vol. I; Holinshed\'s margin names the eve', /vol\. I \(1826\), 28 October/.test(S.source) && /Hone wrote \(1826\)/.test(S.lore) && /"The euen of Simon and Iude"/.test(S.lore) && !/fitted to the story/.test(S.lore));
check('Fifth of November: "[Fawkes]"; Cressy in Myths of the English', /please to remember Guy \[Fawkes\]/.test(F.lore) && /Myths of the English \(1992\)/.test(F.source) && !/Journal of British Studies/.test(F.source));
check('Souling: Aubrey recorded; Burne 1883–86', /Aubrey recorded it in Shropshire/.test(SC.lore) && /Shropshire Folk-Lore \(1883–86\)/.test(SC.lore + SC.source) && !/Aubrey saw/.test(SC.lore));
check('Hop-tu-Naa: Moore\'s dates are of the eve', /of the eve of Hollantide/.test(HT.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
