// Hone's Every-Day Book (1826–27) and Carmichael's Carmina Gadelica (1900) on
// the Real Shelf: the two works the game cites most (the old calendar; the
// hearth blessings), each verified, with Carmichael's polishing said plainly.
const { REAL_BOOKS } = require('../data/realBooks.js');
const { buildCharmBook } = require('../lib/charmBook.js');
const { buildSources } = require('../lib/sources.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const B = (id) => REAL_BOOKS.find((b) => b.id === id);
const order = REAL_BOOKS.map((b) => b.id);

const h = B('hone');
check('Hone: The Every-Day Book, 1826–27, record', h && h.title === 'The Every-Day Book' && h.date === '1826–27' && h.tier === 'record' && /Hunt and Clarke/.test(h.source));
check('…the "Everlasting Calendar", in weekly parts from 1825', /"Everlasting Calendar"/.test(h.summary) && /weekly parts from 1825/.test(h.summary));
check('…the three trials of 1817 and the three acquittals; Lamb\'s dedication and poem', /December 1817/.test(h.fact) && /acquitted by all three juries/.test(h.fact) && /dedicated to Charles Lamb and his sister Mary/.test(h.fact) && /"I like you, and your book ingenuous Hone!"/.test(h.fact));
check('…quoted from his preface', /^This volume is a specimen of a work undertaken/.test(h.quote));
const c = B('carmichael');
check('Carmichael: Carmina Gadelica, 1900, Constable, record', c && c.title === 'Carmina Gadelica' && c.date === '1900' && c.tier === 'record' && /Constable/.test(c.source));
check('…the exciseman and the hearth blessings', /exciseman/.test(c.fact) && /smooring and kindling/.test(c.summary));
check('…and the honest caveat: Robertson (1976) on the touching up', /Hamish Robertson/.test(c.fact) && /1976/.test(c.fact) && /hardly a text he checked had not been touched up/.test(c.fact));
check('…quoted from his introduction', c.quote === 'This work consists of old lore collected during the last forty-four years.');
check('shelved by date among the record books, before the revival', order.indexOf('hone') < order.indexOf('moore_manx') && order.indexOf('carmichael') > order.indexOf('elworthy') && order.indexOf('carmichael') < order.indexOf('aradia'));

const src = buildSources(buildCharmBook({ acct: {}, prog: {}, seasonKey: null }).chapters);
const carm = src.works.find((w) => w.sortKey === 'carmichael|1900');
check('on the Sources page, Carmina Gadelica sits with the smooring and kindling it gave', carm && carm.entries.some((x) => x.id === 'carmichael') && carm.entries.some((x) => x.id === 'smooring') && carm.entries.some((x) => x.id === 'kindling'), carm && carm.entries.map((x) => x.id));
const hone = src.works.find((w) => w.sortKey === 'hone|1826');
check('…and The Every-Day Book with what cites it', hone && hone.entries.some((x) => x.id === 'hone') && hone.entries.length >= 3, hone && hone.entries.map((x) => x.id));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
