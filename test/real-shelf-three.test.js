// Three more books on the Real Shelf, the ones the callers lean on most:
// Kirk's Secret Common-Wealth (1691), Moore's Folk-Lore of the Isle of Man
// (1891) and Elworthy's The Evil Eye (1895), each verified, the legend of Kirk
// marked as legend, and each joining the works it already stood for on the
// Charm Book's Sources page.
const { REAL_BOOKS } = require('../data/realBooks.js');
const { buildCharmBook } = require('../lib/charmBook.js');
const { buildSources } = require('../lib/sources.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const B = (id) => REAL_BOOKS.find((b) => b.id === id);
const order = REAL_BOOKS.map((b) => b.id);

const k = B('kirk');
check('Kirk: minister of Aberfoyle, 1691, record', k && /Aberfoyle/.test(k.author) && k.date === '1691' && k.tier === 'record');
check('…his own title-page words for the fairies', /"the Subterranean \(and, for the most Part,\) Invisible People"/.test(k.summary));
check('…the Gaelic Psalms, printed only in 1815, and the fairy abduction called legend', /Gaelic verse \(1684\)/.test(k.fact) && /not printed until 1815/.test(k.fact) && /is legend/.test(k.fact) && /"if he did die, which is disputed"/.test(k.fact));
check('…quoted from his first chapter, with the manuscript and Lang\'s edition', k.quote === 'These Siths, or Fairies, they call Sleagh Maith, or the Good People' && /La\.III\.551/.test(k.source) && /Lang/.test(k.source));
const m = B('moore_manx');
check('Moore: 1891, the Speaker of the House of Keys, his opening regret', m && m.date === '1891' && /Speaker of the House of Keys/.test(m.fact) && /"has been unfortunate in not having had competent collectors of its Legendary Lore\."/.test(m.fact) && /Brown & Son/.test(m.source));
const e = B('elworthy');
check('Elworthy: 1895, John Murray, the dialect scholar, and the pinned heart', e && e.date === '1895' && /John Murray/.test(e.source) && /West Somerset Word-Book \(1886\)/.test(e.fact) && /pinned heart/.test(e.fact) && /he was overlooked/.test(e.quote));
check('shelved in order: Kirk after Glanvill, Moore and Elworthy before Leland', order.indexOf('kirk') === order.indexOf('glanvill') + 1 && order.indexOf('elworthy') === order.indexOf('moore_manx') + 1 && order.indexOf('aradia') === order.indexOf('elworthy') + 1);

const book = buildCharmBook({ acct: { booksRead: ['kirk'] }, prog: {}, seasonKey: null });
const lib = book.chapters.find((c) => c.key === 'library');
check('reading one writes it into the Library chapter', lib.entries.find((x) => x.id === 'kirk').met && !lib.entries.find((x) => x.id === 'elworthy').met);
const src = buildSources(book.chapters);
const work = (re) => src.works.find((w) => re.test(w.cite));
check('on the Sources page each book is one work with what cites it: Kirk with elf-shot', (() => { const w = work(/Kirk, The Secret Common-Wealth \(1691\)/); return w && w.entries.some((x) => x.id === 'kirk') && w.entries.some((x) => x.id === 'elf_shot'); })());
check('…Moore with the wren, Elworthy with the pinned heart', (() => { const w1 = src.works.find((w) => w.sortKey === 'moore|1891'); const w2 = src.works.find((w) => w.sortKey === 'elworthy|1895'); return w1 && w1.entries.some((x) => x.id === 'moore_manx') && w1.entries.some((x) => x.id === 'wren_hunt') && w2 && w2.entries.some((x) => x.id === 'elworthy') && w2.entries.some((x) => x.id === 'pinned_heart'); })());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
