// The Practices chapter, read against its texts: Culpeper in his own words
// (and chamomile's Sun found in the 1652 catalogue, not its entry), his rule
// to gather in the planet's hour, and Pliny's rules given plant by plant as
// the Druids' and magicians'; the Clouds and Gorgias in Hickie's and Lamb's
// English, the witch bought not hired, and no "oldest witches in European
// literature" while Circe stands before them; Hávamál's túnriður playing in
// the air, the hedge from the dictionary, Hartlieb's ointment named and not
// described; and the crossed loaf to keep the witches out, the Irish cross so
// the fairies wouldn't touch it, and the Good Friday bread from Courtney and
// Hone. No recipe for any ointment anywhere.
const PR = require('../data/practices.js');
const by = (id) => PR.PRACTICES.find((p) => p.id === id);
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const G = by('green'), M = by('lunar'), H = by('hedge'), K = by('kitchen');
check('wort-cunning: Culpeper quoted on St John\'s wort and henbane, chamomile from the 1652 catalogue; the planetary hour in his words', /"under the celestial sign Leo, and the dominion of the Sun"/.test(G.lore) && /first catalogue puts chamomile under the Sun/.test(G.lore) && /"how astrologers could take on them to make this an herb of Jupiter"/.test(G.lore) && /"Gather all leaves in the hour of that planet that governs them\."/.test(G.lore) && /English Physitian \(1652\)/.test(G.source) && /Complete Herbal \(1653\)/.test(G.source));
check('…Pliny plant by plant, as the Druids\' and magicians\' rules, half mocked: selago, samolus, before sunrise', /half mocking, the rules of the Druids and the magicians/.test(G.lore) && /"without the use of iron, the right hand being passed/.test(G.lore) && /"gathered fasting with the left hand"/.test(G.lore) && /"gathered before sunrise on the banks of a stream"/.test(G.lore) && /24\.62–63/.test(G.source));
check('drawing down the moon: not "the oldest witches"; Circe older; the witch bought; Hickie\'s lines; Lamb\'s "hags of Thessaly"; Adler 1979', !/The oldest witches in European literature/.test(M.lore) && /Homer's Circe is older still/.test(M.lore) && /"If I were to purchase a Thessalian witch, and draw down the moon by night/.test(M.lore) && /I should not pay the interest"/.test(M.lore) && /"the creatures who would draw down the moon, the hags of Thessaly"/.test(M.lore) && /Margot Adler's book of that title \(1979\)/.test(M.lore) && /Clouds 749–756/.test(M.source));
check('riding the hedge: túnriður play in the air; the hedge from Cleasby and Vigfússon; Bellows\'s house-riders; Hartlieb named, 1455–6; Rae Beth 1990', /"play in the air"/.test(H.lore) && /"hedge-rider"/.test(H.lore) && /"were thought to ride on hedges and the tops of houses during the night"/.test(H.lore) && /"house-riders"/.test(H.lore) && /1455–6/.test(H.lore) && /Rae Beth's Hedge Witch \(1990\)/.test(H.lore) && /Cleasby & G\. Vigfússon/.test(H.source));
check('…and no ointment recipe: no ingredients, no doses', !/(belladonna|aconite|henbane|hemlock|mandrake|fat|grains|drachm|ounce)/i.test(H.lore));
check('the crossed loaf: Thiselton-Dyer quoted; to keep the witches or the Devil out, not "let out"; the Irish fairies "wouldn\'t touch it"; Courtney\'s bread and bun; Hone\'s cake and fire', /"many a housewife still marks the sign of the cross upon her loaf/.test(K.lore) && /"crossing the witches out"/.test(K.lore) && /to keep the Devil out/.test(K.lore) && !/to let the devil out/i.test(K.lore) && !/let the fairies out/.test(K.lore) && /"so that the fairies wouldn't touch it during the night"/.test(K.lore) && /"Bread baked on this day never gets mouldy"/.test(K.lore) && /"is hung up in the kitchen from one year to the other"/.test(K.lore) && /"preserves the house from fire"/.test(K.lore) && !/Roud/.test(K.source) && K.tier === 'folk');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
