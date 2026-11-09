// The Threshold & Hearth wards and the wind knots, read against their
// sources: witch bottles mostly after 1660 (MOLA, British Archaeology, 2019;
// Hoggard), the Greenwich bottle's urine and pierced leather heart; Historic
// England's own words on daisy wheels, with the masons' reading beside them;
// Swann's concealed shoes (now nearly three thousand finds; 1308 the date of
// the choir stalls, not the shoe); the Wellington ladder's full label, its
// British Association audience and Marianne Voader in 1893; Frazer's wind
// knots in his own words and Higden's Manx three knots. Each ward also says
// what to do if you find one.
const { WARDS } = require('../data/wards.js');
const { CORD_LORE } = require('../data/cords.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const B = WARDS.bottle, H = WARDS.hexafoil, S = WARDS.shoe, L = WARDS.ladder;
check('witch bottles: two to two and a half hundred, mostly after 1660; hearth and threshold; no "1500s to the 1700s"', /two to two and a half hundred/.test(B.lore) && /"most bottles post-date the Restoration of Charles II in 1660"/.test(B.lore) && /Half are found about the hearth and a quarter beneath thresholds/.test(B.lore) && !/1500s to the 1700s/.test(B.lore));
check('…the Greenwich bottle: late 17th-century, mid-2000s, urine, the nail through the leather heart; and if you find one, leave it, stopper in, Finds Liaison Officer', /late 17th-century stoneware jar found by builders in the mid-2000s/.test(B.lore) && /urine/.test(B.lore) && /"one of which was driven through a leather heart"/.test(B.lore) && /don't take the stopper out/.test(B.lore) && /Finds Liaison Officer/.test(B.lore) && /MOLA/.test(B.source) && /Massey/.test(B.source));
check('daisy wheels: Historic England quoted, disputed but most widely accepted; the endless line; the masons\' reading; no "by the thousand"; consent on listed buildings', /"The purpose of hexafoils is disputed"/.test(H.lore) && /"their interpretation as a ritual protection mark is the most widely accepted theory at present"/.test(H.lore) && /"single, endless line"/.test(H.lore) && /masons' practice/.test(H.lore) && !/by the thousand/.test(H.lore) && /listed building usually needs consent/.test(H.lore));
check('concealed shoes: nearly three thousand; late 1950s; floors, walls and roofs; choir stalls "installed in 1308"; usually single; a child\'s in two of five; report it', /Nearly three thousand finds/.test(S.lore) && /late 1950s/.test(S.lore) && /floors, walls and roofs/.test(S.lore) && /installed in 1308/.test(S.lore) && /Usually a single shoe/.test(S.lore) && /"all but twenty"/.test(S.lore) && /two in five of those that can be sized a child's/.test(S.lore) && !/Well over a thousand/.test(S.lore) && /Costume 30 \(1996\)/.test(S.source));
check('the witch\'s ladder: the label\'s deaths; the British Association audience; Marianne Voader in 1893; Tylor\'s "unsupported opinion does not suffice"; all four readings, honestly unknown', /"and for causing people's deaths"/.test(L.lore) && /two of his audience said it was a sewel/.test(L.lore) && /in 1893 Marianne Voader/.test(L.lore) && /"nothing but a string set with feathers to frighten birds from a line of peas"/.test(L.lore) && /"unsupported opinion does not suffice"/.test(L.lore) && /honestly unknown/.test(L.lore) && !/a local woman/.test(L.lore) && /Papers and Transactions \(1892\)/.test(L.source));
check('the wind knots: Frazer\'s Finnland quoted; Lerwick\'s old women; Higden\'s Manx three knots, not credited to Frazer; Bessie Millie; the ladder\'s label', /"In Finnland wizards used to sell wind to storm-staid mariners/.test(CORD_LORE.wind) && /"There are now in Lerwick old women who live by selling wind\."/.test(CORD_LORE.wind) && /Higden's 14th-century Polychronicon/.test(CORD_LORE.wind) && /"as it were closed under three knottes of threde"/.test(CORD_LORE.wind) && /Bessie Millie/.test(CORD_LORE.wind) && /Higden/.test(CORD_LORE.source) && !/1911 note/.test(CORD_LORE.ladder) && /causing deaths/.test(CORD_LORE.ladder));
const { MYTH_QUIZ } = require('../data/mythOrRecord.js');
const q = MYTH_QUIZ.find((x) => x.id === 'witch_bottles');
check('the Myth or record? verdict agrees: mostly after 1660, the urine and the pierced heart; no "1500s to the 1700s"', q && /mostly from after 1660/.test(q.verdict) && /urine/.test(q.verdict) && !/1500s to the 1700s/.test(q.verdict) && /MOLA/.test(q.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
