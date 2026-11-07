// The Real Shelf: real books of witchcraft and herb-lore in the Library, each
// honestly summarised and badged; reading one writes it into the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-realshelf-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { REAL_BOOKS } = require('../data/realBooks.js');
const { buildCharmBook } = require('../lib/charmBook.js');
const FURN = fs.readFileSync(path.join(__dirname, '../client/furniture.js'), 'utf8');
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
const B = (id) => REAL_BOOKS.find((b) => b.id === id);

check('eighteen real books with unique ids', REAL_BOOKS.length === 18 && new Set(REAL_BOOKS.map((b) => b.id)).size === 18);
check('every book has a title, author, date, summary, fact, source and tier', REAL_BOOKS.every((b) => b.title && b.author && b.date && b.summary && b.fact && b.source && /^(record|revival)$/.test(b.tier)));
check('the modern revival is badged revival: Leland, Murray, Gardner', ['aradia', 'murray', 'gardner'].every((id) => B(id).tier === 'revival') && REAL_BOOKS.filter((b) => b.tier === 'revival').length === 3);
check('no quotation from a book still in copyright (Gardner)', B('gardner').quote === null);
check('quotations are short', REAL_BOOKS.every((b) => !b.quote || b.quote.split(/\s+/).length <= 25));
check('the Malleus gives Kramer, doubts Sprenger, and calls the Cologne approval likely forged', /Kramer/.test(B('malleus').author) && /doubted/.test(B('malleus').author) && /forged/.test(B('malleus').fact));
check('Scot\'s burning is called a tradition, not a fact', /later tradition, not a fact/.test(B('scot').fact));
check('Bald\'s eyesalve and the 2015 MRSA study, with its caveat', /2015/.test(B('balds_leechbook').fact) && /MRSA/.test(B('balds_leechbook').fact) && /only all together/.test(B('balds_leechbook').fact));
check('the Key of Solomon is not Solomon\'s', /falsely given to King Solomon/.test(B('key_of_solomon').author));
check('Gerard is honest about Dodoens', /Dodoens/.test(B('gerard').author) && /unacknowledged translation/.test(B('gerard').summary));
check('Gardner\'s nine million is corrected', /nine million/.test(B('gardner').fact) && /forty to sixty thousand/.test(B('gardner').fact));
check('the Library has the Real Shelf to browse', /npc: 'real_shelf'/.test(FURN));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Reader'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Reader', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  s.emit('message', JSON.stringify({ type: 'real_shelf' }));
  const g = s.lastOfType('real_shelf');
  check('a guest can browse the shelf', g && g.books.length === 18 && g.read.length === 0 && g.intro);
  s.emit('message', JSON.stringify({ type: 'read_real_book', id: 'scot' }));
  check('…but a guest\'s reading is not kept', s.lastOfType('real_shelf').read.length === 0);

  p.accountKey = 'reader'; h.accounts.reader = {}; h.playerProgress.reader = { level: 1, xp: 0 };
  s.emit('message', JSON.stringify({ type: 'read_real_book', id: 'scot' }));
  s.emit('message', JSON.stringify({ type: 'read_real_book', id: 'scot' }));
  s.emit('message', JSON.stringify({ type: 'read_real_book', id: 'not_a_book' }));
  s.emit('message', JSON.stringify({ type: 'read_real_book', id: 'culpeper' }));
  check('reading records each real book once, and nothing else', JSON.stringify(h.accounts.reader.booksRead) === '["scot","culpeper"]', h.accounts.reader.booksRead);
  check('the shelf shows what you have read', JSON.stringify(s.lastOfType('real_shelf').read) === '["scot","culpeper"]');
  const book = buildCharmBook({ acct: h.accounts.reader, prog: {}, seasonKey: null });
  const ch = book.chapters.find((c) => c.key === 'library');
  check('the Charm Book has a Library chapter of eighteen, two written in', ch && ch.total === 18 && ch.met === 2 && ch.entries.find((e) => e.id === 'scot').met);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
