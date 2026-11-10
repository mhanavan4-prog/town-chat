// Dee's Monas Hieroglyphica (Antwerp, 1564) on the Real Shelf, and the Monad
// built there by straight line and circle to Theorem XXIII's proportions. The
// server checks the figure; the lore is record-tier and says what Dee meant it
// for (contemplation, not protection).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-monas-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const { MONAS_REQUIRED, monasProblem, MONAS_LORE, MONAS_SOURCE, MONAS_XP } = require('../data/monas');
const { REAL_BOOKS } = require('../data/realBooks');
const MONAD = [
  { tool: 'line', a: [0, 6], b: [0, -3] }, { tool: 'line', a: [2, 0], b: [-2, 0] },
  { tool: 'circle', c: [0, 3], through: [2, 3] }, { tool: 'dot', c: [0, 3] },
  { tool: 'cup', c: [0, 6], through: [-2, 6] },
  { tool: 'arch', c: [-1, -3], through: [0, -3] }, { tool: 'arch', c: [1, -3], through: [2, -3] },
];
check('the stem is nine parts, C to K (Theorem XXIII)', MONAS_REQUIRED[0].a[1] === -3 && MONAS_REQUIRED[0].b[1] === 6);
check('the Monad, in any order and either way round, is the Monad', monasProblem(MONAD) === null && monasProblem(MONAD.slice().reverse()) === null);
check('the Sun wants its visible centre (Theorem III)', /visible centre/.test(monasProblem(MONAD.filter((e) => e.tool !== 'dot')) || ''));
check('the Moon hangs below, horns up; arched, it is not the Moon', /Moon/.test(monasProblem(MONAD.map((e) => (e.tool === 'cup' ? { ...e, tool: 'arch' } : e))) || '') || /not in Dee/.test(monasProblem(MONAD.map((e) => (e.tool === 'cup' ? { ...e, tool: 'arch' } : e))) || ''));
check('a stem of the wrong length is not Dee\'s', !!monasProblem(MONAD.map((e, i) => (i === 0 ? { tool: 'line', a: [0, -2], b: [0, 6] } : e))));
check('a stray mark is called out; a mark twice is called out', /not in Dee/.test(monasProblem([...MONAD, { tool: 'line', a: [0, 0], b: [1, 1] }]) || '') && /twice/.test(monasProblem([...MONAD, MONAD[0]]) || ''));
check('nonsense is refused, not thrown', !!monasProblem('monad') && !!monasProblem([{ tool: 'circle', c: [0, 0], through: [0, 0] }]));
const book = REAL_BOOKS.find((b) => b.id === 'monas');
check('the book is on the Real Shelf: Dee, 1564, record, Theorem I quoted', book && book.author === 'John Dee' && book.date === '1564' && book.tier === 'record' && /straight line and the circle/.test(book.quote));
check('the lore: Maximilian, 13 to 25 January, the Sun, the horns, Aries and fire; contemplation, not a charm', /"the famous King Maximilian"/.test(MONAS_LORE) && /13 and 25 January/.test(MONAS_LORE) && /"a circle having a visible center"/.test(MONAS_LORE) && /use of fire is required/.test(MONAS_LORE) && /not a charm against harm/.test(MONAS_LORE) && /Hamilton-Jones \(1947\)/.test(MONAS_SOURCE));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const s = makeMockSocket('Scholar'); connHandler(s);
  say(s, { type: 'join', name: 'Scholar', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'dee_a'; h.accounts.dee_a = {};
  say(s, { type: 'real_shelf' });
  const sh = s.lastOfType('real_shelf');
  check('the shelf sends the board\'s lattice and lore', sh && sh.monas && sh.monas.lattice && sh.monas.built === false);
  say(s, { type: 'construct_monas', elements: MONAD.slice(0, 5) });
  check('half a Monad is turned back with what\'s missing', /Still to draw/.test((s.lastOfType('monas_result') || {}).problem || '') && !h.accounts.dee_a.monas);
  say(s, { type: 'construct_monas', elements: MONAD });
  const r = s.lastOfType('monas_result');
  check(`the whole Monad: built, the book read, +${MONAS_XP} XP once`, r && r.ok && r.xp === MONAS_XP && !!h.accounts.dee_a.monas && h.accounts.dee_a.booksRead.includes('monas'));
  say(s, { type: 'construct_monas', elements: MONAD });
  check('…and again, for the pleasure of it, with no more XP', s.lastOfType('monas_result').ok && s.lastOfType('monas_result').xp === 0);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
