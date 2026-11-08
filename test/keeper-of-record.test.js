// Keeper of the Record: ten out of ten on every set of the Real Shelf's quiz
// earns the title, once, with a toast, and the quiz's done card says so.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-keeperrec-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { MYTH_SETS } = require('../data/mythOrRecord.js');
const { TITLES } = require('../data/titles.js');
const MAIN = fs.readFileSync(path.join(__dirname, '../client/main.js'), 'utf8');
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

check('the title is in the catalogue', TITLES.keeper_of_record && TITLES.keeper_of_record.name === 'Keeper of the Record');
check('the done card names it when it\'s won', /r && r\.title \? `<div class="mythFoot">🔍 Ten out of ten on every set: you are <b>\$\{esc\(r\.title\)\}<\/b>/.test(MAIN));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Sage'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Sage', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'sage'; h.accounts.sage = {}; h.playerProgress.sage = { level: 1, xp: 0 };
  const right = (set) => Object.fromEntries(set.items.map((q) => [q.id, q.answer]));
  const has = () => (h.playerProgress.sage.riteTitles || []).includes('keeper_of_record');
  // All but the last set perfect: no title yet.
  for (const set of MYTH_SETS.slice(0, -1)) s.emit('message', JSON.stringify({ type: 'myth_quiz_done', set: set.key, answers: right(set) }));
  check('ten out of ten on all but one set: not yet', !has() && !s.lastOfType('myth_quiz_result').title);
  const last = MYTH_SETS[MYTH_SETS.length - 1];
  const wrong = right(last); wrong[last.items[0].id] = last.items[0].answer === 'myth' ? 'record' : 'myth';
  s.emit('message', JSON.stringify({ type: 'myth_quiz_done', set: last.key, answers: wrong }));
  check('nine on the last: still not', !has());
  s.emit('message', JSON.stringify({ type: 'myth_quiz_done', set: last.key, answers: right(last) }));
  const r = s.lastOfType('myth_quiz_result');
  check('ten on every set: Keeper of the Record, named on the result', has() && r.title === 'Keeper of the Record');
  check('…with a toast on screen and the titles sent', s.sent.some((m) => m.type === 'toast' && m.always && /Keeper of the Record/.test(m.message)) && s.lastOfType('titles_state'));
  s.emit('message', JSON.stringify({ type: 'myth_quiz_done', set: last.key, answers: right(last) }));
  check('…and only once', !s.lastOfType('myth_quiz_result').title && h.playerProgress.sage.riteTitles.filter((x) => x === 'keeper_of_record').length === 1 && s.sent.filter((m) => m.type === 'toast' && /Keeper of the Record/.test(m.message)).length === 1);
  const g = makeMockSocket('Passer'); connHandler(g);
  g.emit('message', JSON.stringify({ type: 'join', name: 'Passer', charId: 0 }));
  for (const set of MYTH_SETS) g.emit('message', JSON.stringify({ type: 'myth_quiz_done', set: set.key, answers: right(set) }));
  check('a guest gets full marks but no title', !g.lastOfType('myth_quiz_result').title);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
