// The Charm Book's Sources page: every work the book cites, A to Z, with the
// entries that cite it (lib/sources.js), built from the entries' own sources so
// it can't disagree with them, and keeping un-met callers hidden.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-sources-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { buildCharmBook } = require('../lib/charmBook.js');
const { buildSources, worksOf, nameKey, firstYear } = require('../lib/sources.js');
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

const book = buildCharmBook({ acct: { callers: { byId: { butter_wont_come: 1 } } }, prog: {}, seasonKey: null });
const src = buildSources(book.chapters);
const keyOf = (c) => nameKey(c) + '|' + firstYear(c);
const findWork = (re) => src.works.filter((w) => re.test(w.cite));

check('over a hundred works, A to Z', src.works.length > 100 && src.works.every((w, i) => i === 0 || src.works[i - 1].sortKey.localeCompare(w.sortKey, 'en', { sensitivity: 'base' }) <= 0), src.works.length);
// Every entry with a source is listed under every work it cites, and nowhere else.
const listed = new Map();
for (const w of src.works) for (const e of w.entries) listed.set(e.chapter + ':' + e.id, (listed.get(e.chapter + ':' + e.id) || 0) + 1);
let missing = [];
for (const ch of book.chapters) for (const e of ch.entries) {
  if (!e.source) continue;
  const n = new Set(worksOf(e.source).map(keyOf)).size;
  const got = listed.get(ch.key + ':' + e.id) || 0;
  if (got < 1 || got > n) missing.push(`${ch.key}:${e.id} ${got}/${n}`);
}
check('every cited entry is listed under its works', missing.length === 0, missing.slice(0, 5));
check('…and nothing is listed that the book does not have', [...listed.keys()].every((k) => { const [c, id] = k.split(':'); const ch = book.chapters.find((x) => x.key === c); return ch && ch.entries.some((e) => e.id === id); }));

check('"O. Davies" and "Owen Davies" (2003) are one work', findWork(/Davies, Cunning-Folk/).length === 1);
check('"M. Martin" and "Martin Martin" (1703) are one work', findWork(/Martin, A Description of the Western Islands/).length === 1);
check('Culpeper\'s English Physitian (1652) and Complete Herbal (1653) stay two', findWork(/Culpeper/).length === 2);
check('Pennant\'s "Tour in Scotland, 1769 (1771)" is dated by its 1771 printing', firstYear('Thomas Pennant, A Tour in Scotland, 1769 (1771)') === '1771' && findWork(/Pennant/).length === 1);
check('an undated "A. Carmichael, notes" joins Carmina Gadelica', findWork(/Carmichael/).length === 1 && findWork(/Carmichael/)[0].entries.length >= 4);
check('a paper keeps its name ("Kelso Chronicle"), a person sorts by surname', nameKey('Kelso Chronicle (10 July 1863)') === 'kelso chronicle' && nameKey('M. MacNeill, The Festival of Lughnasa (1962)') === 'macneill' && nameKey('Richard M. Dorson, Bloodstoppers and Bearwalkers (1952)') === 'dorson' && nameKey('Opie & Tatem, A Dictionary of Superstitions (1989)') === 'opie');
check('two documents from one body stay two works', nameKey("Historic England, 'Discovering Witches' Marks'") !== nameKey('Historic England, list entry 1148581 (Postgate Farmhouse, Glaisdale)') && nameKey('Pitt Rivers Museum 1911.32.7') === nameKey('Pitt Rivers Museum 1911.32.7 (the Wellington witch\'s ladder)'));
check('Dee\'s mirror and the Antiquity paper are two works', findWork(/^British Museum 1966,1001\.1$/).length === 1 && findWork(/Campbell et al\., Antiquity/).length === 1);
const ogam = findWork(/McManus, A Guide to Ogam \(1991\)/);
check('the tree alphabet now cites McManus\'s Guide to Ogam, all twenty letters under it', ogam.length === 1 && ogam[0].entries.length === 20 && ogam[0].entries.every((e) => e.chapter === 'ogham'));

const callerRows = src.works.flatMap((w) => w.entries).filter((e) => e.chapter === 'callers');
check('un-met callers stay hidden on the Sources page', callerRows.some((e) => !e.met) && callerRows.filter((e) => !e.met).every((e) => e.title === null && e.icon === null));
check('…and a met one is named', callerRows.some((e) => e.id === 'butter_wont_come' && e.met && e.title));
check('the open chapters are named even un-met (the calendar is no secret)', src.works.flatMap((w) => w.entries).filter((e) => e.chapter === 'wheel').every((e) => e.title));
check('the tea-leaf chapter is said to cite its sources in its note', /Reading the Leaves gives its sources once, in the chapter's note\./.test(src.note));

const CB = fs.readFileSync(path.join(__dirname, '../client/charm-book.js'), 'utf8');
check('the client draws a Sources page from the book, and only with textContent', /function renderSources\(body\)/.test(CB) && /openChapter === SOURCES/.test(CB) && !/innerHTML/.test(CB));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Reader'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Reader', charId: 0 }));
  s.emit('message', JSON.stringify({ type: 'charm_book_state' }));
  const st = s.lastOfType('charm_book_state');
  check('the server sends the Sources with the book', st && st.sources && Array.isArray(st.sources.works) && st.sources.works.length === src.works.length, st && st.sources && st.sources.works.length);
  void h;
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
