// "Check it": a Myth or record? verdict, a Real Shelf book and a cunning
// man or woman each link to their works on the Charm Book's Sources page
// (lib/checkIt.js, findWork in lib/sources.js), found by the same grouping
// as the page itself, so a link goes only where the book really cites it.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-checkit-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { buildCharmBook } = require('../lib/charmBook.js');
const { buildSources, findWork } = require('../lib/sources.js');
const { checksFor, partsOf } = require('../lib/checkIt.js');
const { MYTH_QUIZ } = require('../data/mythOrRecord.js');
const { REAL_BOOKS } = require('../data/realBooks.js');
const { CUNNING_FOLK } = require('../data/cunningFolk.js');
const MAIN = fs.readFileSync(path.join(__dirname, '../client/main.js'), 'utf8');
const BOOK = fs.readFileSync(path.join(__dirname, '../client/charm-book.js'), 'utf8');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

const src = buildSources(buildCharmBook({ acct: {}, prog: {}, seasonKey: null }).chapters);
const ids = src.works.map((w) => w.id);
check('every work on the Sources page has its own id', ids.every(Boolean) && new Set(ids).size === ids.length);
check('…and what it matches by is not sent with it', !('match' in JSON.parse(JSON.stringify(src.works[0]))) && src.works[0].match);

// findWork folds a citation the way the page does: by surname and year or
// title, so a longer or shorter form of the same work finds it.
const davies = findWork(src, 'Owen Davies, Cunning-Folk (2003), ch. 4');
check('a fuller form of a cited work finds it', davies && /Davies, Cunning-Folk \(2003\)/.test(davies.cite), davies && davies.cite);
check('a body is found by its name and document', findWork(src, 'Pitt Rivers Museum 1981.11.2') && !findWork(src, 'Pitt Rivers Museum 1999.1.1'));
check('a work the book does not cite finds nothing', findWork(src, 'B. Levack, The Witch-Hunt in Early Modern Europe (2006)') === null && findWork(src, 'the memorial by the Town Hall') === null);
check('a source line splits at "; " and " · "', JSON.stringify(partsOf('A (1); B · C')) === JSON.stringify(['A (1)', 'B', 'C']));

const checks = checksFor(src, { myth: MYTH_QUIZ, books: REAL_BOOKS, folk: CUNNING_FOLK });
const byWork = Object.fromEntries(src.works.map((w) => [w.id, w]));
const all = Object.values(checks).flat();
check('every link goes to a work on the Sources page', all.filter((p) => p.work).every((p) => byWork[p.work]));
check('every citation is kept, linked or not, in its order', MYTH_QUIZ.every((q) => checks['myth:' + q.id].map((p) => p.text).join('; ') === partsOf(q.source).join('; ')));
const linked = MYTH_QUIZ.filter((q) => checks['myth:' + q.id].some((p) => p.work)).map((q) => q.id);
check('most verdicts link to a work the book cites', linked.length >= 8, linked);
check('the Malleus verdict links to the Malleus on the Sources page', (() => { const p = checks['myth:malleus_approved'].find((x) => x.work); return p && /Malleus Maleficarum/.test(byWork[p.work].cite) && byWork[p.work].entries.some((e) => e.chapter === 'library' && e.id === 'malleus'); })());
check('every Real Shelf book links to its work, which lists its Library entry', REAL_BOOKS.every((b) => { const p = (checks['book:' + b.id] || [])[0]; return p && byWork[p.work].entries.some((e) => e.chapter === 'library' && e.id === b.id); }), REAL_BOOKS.filter((b) => !(checks['book:' + b.id] || []).length).map((b) => b.id));
check('every cunning man and woman links to at least one work', CUNNING_FOLK.every((f) => checks['folk:' + f.id].some((p) => p.work)));

// The client: links are escaped, close the shelf and open the book at the work.
check('the shelf draws each link escaped, and falls back to the plain source', /function checkLineHtml\(key, fallback\)/.test(MAIN) && /data-work="\$\{esc\(p\.work\)\}">\$\{esc\(p\.text\)\}/.test(MAIN) && /<div class="shelfSrc">\$\{esc\(fallback\)\}<\/div>/.test(MAIN));
check('…a link closes the shelf and opens the Sources page at the work', /closeShelfModal\(\);\s*_charmBook\.openSource\(b\.getAttribute\('data-work'\)\)/.test(MAIN) && /function openSource\(id\)/.test(BOOK) && /w\.id === focusWork \? ' focus'/.test(BOOK) && /scrollIntoView\(\{ block: 'center' \}\)/.test(BOOK));

require('../server.js');
setTimeout(() => {
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Checker'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Checker', charId: 0 }));
  s.emit('message', JSON.stringify({ type: 'real_shelf' }));
  const shelf = s.lastOfType('real_shelf');
  check('the shelf is sent with its links', shelf && shelf.checks && JSON.stringify(shelf.checks) === JSON.stringify(checks));
  s.emit('message', JSON.stringify({ type: 'charm_book_state' }));
  const book = s.lastOfType('charm_book_state');
  const sent = new Set(((book && book.sources && book.sources.works) || []).map((w) => w.id));
  check('…and every link is to a work the Charm Book sends', all.filter((p) => p.work).every((p) => sent.has(p.work)));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
