// The lintel mark: a practical half on caring for and recording a historic
// mark (Historic England on redecorating, recording and Listed Building
// Consent; the SPAB on old buildings that breathe), and the lore in Historic
// England's own words, with the doubt given its due: "disputed", masons'
// practice, and protection "the most widely accepted theory at present". No
// "don't whitewash it again": limewash is the old finish.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'lintel_mark');
check('no curse but a daisy wheel, its endless line believed to tangle what crossed; no "don\'t whitewash it again"', c && /it is no curse\. It is a daisy wheel, its line without an end, cut, as the old folk believed, to tangle whatever would cross her threshold/.test(c.resolution) && !/whitewash it again/.test(c.resolution));
check('the practical half: no scraping, sanding or stripping, no modern paint; limewash breathes', /Then the practical half/.test(c.resolution) && /Don't scrape, sand or strip it, and don't seal the beam under modern paint: old timber needs to breathe, and limewash is the old finish that lets it/.test(c.resolution) && /SPAB/.test(c.source));
check('…photograph it in raking light; the Historic Environment Record; listed building consent, and the National Heritage List', /Photograph the mark with a torch held low to one side/.test(c.resolution) && /Historic Environment Record or a local graffiti survey/.test(c.resolution) && /unauthorised works to a listed building are a criminal offence/.test(c.resolution) && /National Heritage List by postcode/.test(c.resolution) && /Listed Building Consent/.test(c.source));
check('the lore in Historic England\'s words: the daisy wheel, its dates and places, the compasses, the endless line that "supposedly" trapped', /'A common type of apotropaic mark is known as a daisy wheel,'/.test(c.lore) && /'found in English buildings from the early medieval period, up into the 19th century'/.test(c.lore) && /particularly doorways, windows and fireplaces'/.test(c.lore) && /'a six petal "flower" drawn with a pair of compasses'/.test(c.lore) && /'a single, endless line which supposedly confused and entrapped evil spirits'/.test(c.lore));
check('…the doubt: "disputed", apprentices\' geometry, masons\' practice (2026); protection the most accepted; 600 responses; no "by the thousand"', /'The purpose of hexafoils is disputed'/.test(c.lore) && /'geometric exercises for apprentices'/.test(c.lore) && /masons' compass practice/.test(c.lore) && /'their interpretation as a ritual protection mark is the most widely accepted theory at present'/.test(c.lore) && /'over 600 responses from the public'/.test(c.lore) && !/by the thousand/.test(c.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
