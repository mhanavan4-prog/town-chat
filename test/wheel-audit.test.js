// The Wheel of the Year, read against its sources: Bede gives Lida for both
// June and July (not "Ærra and Æfterra Līða", which are later Old English);
// Kelly named Mabon and Litha in 1974, not "around 1970"; Samhain as the
// Celtic new year is a 19th-century theory Hutton doubts, not a fact cited to
// him, and not "its greatest" quarter-day; Old Irish spellings; Cormac's
// Glossary and Hákonar saga quoted.
const { SABBATS } = require('../data/seasons.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const P = (k) => SABBATS.find((s) => s.key === k).provenance;
check('Litha: Bede\'s Lida for June and July; ærra/æftera later; Kelly 1974; Tolkien\'s Lithe', /Bede gives Lida, 'gentle or navigable', as the Anglo-Saxon name of both June and July/.test(P('litha').line) && /later Old English texts tell them apart/.test(P('litha').line) && /Aidan Kelly gave the name to the solstice festival in 1974/.test(P('litha').line) && /Kelly/.test(P('litha').source));
check('Mabon: Kelly, 1974; no "around 1970"', /Aidan Kelly named the autumn equinox 'Mabon' in 1974/.test(P('mabon').line) && !/around 1970/.test(P('mabon').line));
check('Samhain: one of two chief quarter-days; the Celtic-new-year theory is 19th-century, doubted by Hutton; Echtra Nerai quoted', /one of the two chief Gaelic quarter-days/.test(P('samhain').line) && !/year's end|greatest/.test(P('samhain').line) && /a 19th-century theory \(Rhys, Frazer\) on thin evidence, Hutton argues/.test(P('samhain').line) && /'the fairy-mounds of Erinn are always opened about Halloween'/.test(P('samhain').line));
check('Old Irish spellings: Beltaine, Lugnasad', /^Old Irish Beltaine/.test(P('beltane').line) && /^Old Irish Lugnasad/.test(P('lughnasadh').line));
check('Beltane: Cormac\'s Glossary quoted, the cattle "between them" in one manuscript', /'two fires which Druids used to make with great incantations'/.test(P('beltane').line) && /between them, one manuscript says/.test(P('beltane').line) && /O'Donovan, ed\. W\. Stokes \(1868\)/.test(P('beltane').source));
check('Imbolc: St Brigid\'s by the late 7th century (Cogitosus); Yule: Bede\'s Giuli and Hákon quoted', /kept at Kildare by the late 7th century/.test(P('imbolc').line) && /Cogitosus/.test(P('imbolc').source) && /Bede gives Giuli as the name of both December and January/.test(P('yule').line) && /"at the same time as Christian people held it"/.test(P('yule').line));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
