// Aubrey's Miscellanies (1696) and Martin's Description of the Western Islands
// (1703) on the Real Shelf: the books behind the St Agnes pins and the second
// sight, each verified, and each joined on the Sources page with what cites it.
const { REAL_BOOKS } = require('../data/realBooks.js');
const { buildCharmBook } = require('../lib/charmBook.js');
const { buildSources } = require('../lib/sources.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const B = (id) => REAL_BOOKS.find((b) => b.id === id);
const order = REAL_BOOKS.map((b) => b.id);

const a = B('aubrey');
check('Aubrey: Miscellanies, 1696, Edward Castle, record', a && a.title === 'Miscellanies' && a.date === '1696' && a.tier === 'record' && /Edward Castle/.test(a.source));
check('…its twenty-one heads, from "Day-fatality" to "Second-sighted persons", and the St Agnes pins in "Magick"', /twenty-one heads/.test(a.summary) && /"Day-fatality"/.test(a.summary) && /"Second-sighted persons"/.test(a.summary) && /"Magick"/.test(a.summary));
check('…the only book he published in his lifetime; Brief Lives printed in part in 1813', /only book Aubrey \(1626–1697\) published in his lifetime/.test(a.fact) && /1813/.test(a.fact));
check('…quoted from his dedication', a.quote === 'The matter of this collection is beyond human reach: we being miserably in the dark');
const m = B('martin');
check('Martin: A Description of the Western Islands of Scotland, 1703, Andrew Bell, record', m && m.date === '1703' && /Andrew Bell/.test(m.source) && m.tier === 'record');
check('…his title page\'s cures "by Simples" and "A Particular Account of the Second Sight"', /"by Simples of their own Product"/.test(m.summary) && /"A Particular Account of the Second Sight"/.test(m.summary));
check('…Johnson, in Boswell, given it as a boy', /"put Martin's Account into his hands when he was very young, and that he was much pleased with it"/.test(m.fact) && /1773/.test(m.fact));
check('…quoted from its account of the second sight', /^The second-sight is a singular faculty of seeing an otherwise invisible object/.test(m.quote));
check('shelved after Kirk, before the Key of Solomon', order.indexOf('aubrey') === order.indexOf('kirk') + 1 && order.indexOf('martin') === order.indexOf('aubrey') + 1 && order.indexOf('key_of_solomon') === order.indexOf('martin') + 1);

const src = buildSources(buildCharmBook({ acct: {}, prog: {}, seasonKey: null }).chapters);
const w = (k) => src.works.find((x) => x.sortKey === k);
check('on the Sources page Martin sits with the second sight and his other citers', w('martin|1703') && w('martin|1703').entries.some((x) => x.id === 'martin') && w('martin|1703').entries.some((x) => x.id === 'second_sight'));
check('…and Aubrey with the St Agnes pins', w('aubrey|1696') && w('aubrey|1696').entries.some((x) => x.id === 'aubrey') && w('aubrey|1696').entries.some((x) => x.id === 'st_agnes_pins'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
