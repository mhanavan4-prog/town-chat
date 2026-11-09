// Yuletide, read against its sources: Hone's Devon toast to its real end,
// Herrick's lines as Pollard prints them; the first-foot without the
// unconfirmed Simpson and Roud quote and the unsourced "bread and coal…
// salt", Moore's "reverse" in his words; the Museum Wales and Trac Cymru
// pages by their real titles; Brand without an unseen edition, Quainton as
// Brand prints it; the wren boys collecting "for charity", the unsourced
// betrayal legend gone, Marloes named; calennig's gift as Museum Wales gives
// it, the 2009 blog cited for Owen and 1819, Hen Galan on 13 January, the
// unfound song and OED citation left out; Hone's pastrycooks' characters;
// English Heritage by its title; Aubrey's charm as Hone quotes it.
const { YULE_RITES: Y } = require('../data/yule.js');
const { CHRISTMAS_EVE_RITES } = require('../data/christmasEve.js');
const { WREN_RITES } = require('../data/wrenDay.js');
const { CALENNIG_RITES } = require('../data/calennig.js');
const { TWELFTH_RITES } = require('../data/twelfthNight.js');
const { AGNES_RITES } = require('../data/stAgnes.js');
const { MARI_RITES } = require('../data/mariLwyd.js');
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const one = (o) => Object.values(o)[0];
const all = JSON.stringify([Y, CHRISTMAS_EVE_RITES, WREN_RITES, CALENNIG_RITES, TWELFTH_RITES, AGNES_RITES, MARI_RITES, CALLERS]);

check('wassail: the toast to its end, Pollard\'s "plum and many a pear", "Carhampton Wassailing"', /down to "sacks full, \/ And my pockets full too! Huzza!"/.test(Y.wassail.lore) && /You many a plum and many a pear: \//.test(Y.wassail.lore) && !/many a plum, and many a pear/.test(all) && /"Carhampton Wassailing"/.test(Y.wassail.source));
check('first-foot: no Simpson and Roud, no "later lists salt"; the likely suitor; Moore\'s reverse quoted, ch. VI', !/Simpson/.test(Y.firstfoot.lore + Y.firstfoot.source) && !/later lists salt/.test(Y.firstfoot.lore) && /always considered lucky, and a likely suitor"/.test(Y.firstfoot.lore) && /"the superstition in Scotland is the exact reverse of this"/.test(Y.firstfoot.lore) && /\(1891\), ch\. VI/.test(Y.firstfoot.source));
check('the Yule log: "log to the firing;" and the line running on', /The Christmas log to the firing;"/.test(Y.yulelog.lore) && /Light the new block, and \/ For good success…"/.test(Y.yulelog.lore));
check('the Mari Lwyd pages by their titles', /"Winter Folklore and Tradition: The Mari Lwyd" \(2014\)/.test(one(MARI_RITES).source) && /Trac Cymru, "Mari Lwyd: the winter horse"/.test(one(MARI_RITES).source) && !/"Christmas traditions" \(2014\)/.test(all));
check('the oxen: no unseen Ellis edition, no unseen Hazlitt', !/Ellis \(1813\)/.test(all) && !/Hazlitt, Faith/.test(all) && /as printed in Brand's Popular Antiquities/.test(one(CHRISTMAS_EVE_RITES).source));
const W = one(WREN_RITES);
check('the wren: Leinster and Connaught; "for charity", no party; no betrayal legend; Marloes', /In Leinster and Connaught, Frazer wrote/.test(W.lore) && /"for charity"/.test(W.lore) && !/party/.test(W.lore) && !/betrayed/.test(W.lore) && /At Marloes in Pembrokeshire/.test(W.lore) && /People's Collection Wales, item 1248/.test(W.source));
const C = one(CALENNIG_RITES);
check('calennig: the gift as Museum Wales gives it; the real page title and the 2009 blog; Hen Galan 13 January; no song, no OED', /"received a gift or food or money for their troubles"/.test(C.lore) && !/bread and cheese or a new coin/.test(all) && /"New Year Traditions: Collecting Calennig" \(2014\)/.test(C.source) && /"Calennig" \(blog, 22 December 2009\)/.test(C.source) && /on 13 January/.test(C.lore) && !/Deffrwch|Oxford English Dictionary/.test(C.lore + C.source) && !/Hel Calennig/.test(all));
const T = one(TWELFTH_RITES);
check('Twelfth Night: Hone\'s "characters sold by the pastrycooks"; English Heritage by its title', /"characters sold by the pastrycooks"/.test(T.lore) && /"Why you should leave up your Christmas decorations until February"/.test(T.source) && !/Leaving up Christmas decorations/.test(all));
const A = one(AGNES_RITES);
check('St Agnes: Aubrey as Hone quotes him, no unseen 1696 spelling or chapter', /as Hone quotes it: "Upon St\. Agnes' night you take a row of pins"/.test(A.lore) && !/Ianuary/.test(all) && /Aubrey, Miscellanies \(1696\), as Hone quotes it/.test(A.source) && !/ch\. XIII/.test(A.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
