// "Myth or record?" — the Real Shelf's quiz (data/mythOrRecord.js): ten
// claims, five myths and five on the record, each answered from what the game
// already says elsewhere; the server scores a run and keeps the best.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-myth-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { MYTH_QUIZ: Q } = require('../data/mythOrRecord.js');
const { MEMORIAL } = require('../data/memorial.js');
const { WHEEL_PROVENANCE } = require('../data/seasons.js');
const { REAL_BOOKS } = require('../data/realBooks.js');
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
const q = (id) => Q.find((x) => x.id === id);

check('ten claims, unique ids, five myths and five on the record', Q.length === 10 && new Set(Q.map((x) => x.id)).size === 10 && Q.filter((x) => x.answer === 'myth').length === 5 && Q.filter((x) => x.answer === 'record').length === 5);
check('each has a claim, a verdict and a source', Q.every((x) => x.claim && x.verdict && x.source && /^(myth|record)$/.test(x.answer)));
check('myths and records alternate, so the answer can\'t be guessed from the order alone', Q.every((x, i) => i === 0 || x.answer !== Q[i - 1].answer));
check('the numbers agree with the memorial: forty to sixty thousand, "nine million" a 1784 guess', /forty to sixty thousand/.test(q('nine_million').verdict) && /forty to sixty thousand/.test(MEMORIAL.text) && /1784/.test(q('nine_million').verdict) && /1784/.test(MEMORIAL.text));
check('…hanged in England, strangled then burned in Scotland, as the memorial says', /hanged/.test(q('burned_in_england').verdict) && /strangled at the stake and then burned/.test(q('burned_in_england').verdict) && /strangled at the stake and then burned/.test(MEMORIAL.text));
check('…midwives, and Scotland\'s apology of 2022, and Islandmagee 1711, likewise', /neither healers nor midwives/.test(q('midwives').verdict) && /few were healers or midwives/.test(MEMORIAL.text) && /2022/.test(q('scotland_apology').verdict) && /31 March 1711/.test(q('islandmagee').verdict) && /31 March 1711/.test(MEMORIAL.text));
check('the Wheel agrees with the Wheel\'s own provenance line (20th century, 1950s, 1970s)', /20th-century/.test(q('ancient_wheel').verdict) && /20th-century/.test(WHEEL_PROVENANCE.line) && /1970s/.test(WHEEL_PROVENANCE.line));
check('the Malleus agrees with its Real Shelf entry (no authority from the Inquisition)', /gave it no authority/.test(q('malleus_approved').verdict) && /gave it no authority/.test(REAL_BOOKS.find((b) => b.id === 'malleus').fact));

const MAIN = fs.readFileSync(path.join(__dirname, '../client/main.js'), 'utf8');
check('the shelf draws the quiz, escaping every claim, verdict and source', /function mythQuizHtml\(m\)/.test(MAIN) && /esc\(q\.claim\)/.test(MAIN) && /esc\(q\.verdict\)/.test(MAIN) && /esc\(q\.source\)/.test(MAIN) && /type: 'myth_quiz_done'/.test(MAIN));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const join = (tag, acct) => {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    if (acct) { p.accountKey = acct; h.accounts[acct] = {}; h.playerProgress[acct] = { level: 1, xp: 0 }; }
    return { s, p };
  };
  const a = join('Scholar', 'scholar');
  a.s.emit('message', JSON.stringify({ type: 'real_shelf' }));
  const shelf = a.s.lastOfType('real_shelf');
  check('the shelf sends the quiz, not yet tried', shelf && shelf.myth && shelf.myth.items.length === 10 && shelf.myth.best === null && shelf.myth.intro);
  const all = Object.fromEntries(Q.map((x) => [x.id, x.answer]));
  a.s.emit('message', JSON.stringify({ type: 'myth_quiz_done', answers: all }));
  const r1 = a.s.lastOfType('myth_quiz_result');
  check('all right: 10 of 10, and that is the best', r1 && r1.score === 10 && r1.of === 10 && r1.best === 10 && h.accounts.scholar.mythBest === 10);
  const half = Object.fromEntries(Q.map((x, i) => [x.id, i < 5 ? x.answer : 'nonsense']));
  a.s.emit('message', JSON.stringify({ type: 'myth_quiz_done', answers: half }));
  const r2 = a.s.lastOfType('myth_quiz_result');
  check('a worse run is scored but the best stays', r2 && r2.score === 5 && r2.best === 10);
  a.s.emit('message', JSON.stringify({ type: 'myth_quiz_done', answers: 'junk' }));
  check('junk answers score nothing and break nothing', a.s.lastOfType('myth_quiz_result').score === 0 && h.accounts.scholar.mythBest === 10);
  a.s.emit('message', JSON.stringify({ type: 'real_shelf' }));
  check('the shelf remembers the best', a.s.lastOfType('real_shelf').myth.best === 10);
  const g = join('Passer');
  g.s.emit('message', JSON.stringify({ type: 'myth_quiz_done', answers: all }));
  const rg = g.s.lastOfType('myth_quiz_result');
  check('a guest can take it; nothing is kept', rg && rg.score === 10 && rg.best === null);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
