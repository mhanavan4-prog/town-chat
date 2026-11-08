// The Year's Round: every caller who comes only on their own day, worked,
// earns Keeper of the Year's Round, once; and the Calendar page shows which
// old days you've kept (lib/yearsRound.js).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-yearsround-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { yearsRound, DATED } = require('../lib/yearsRound.js');
const { CALLERS } = require('../data/callers.js');
const { TITLES } = require('../data/titles.js');
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
    allOfType(t) { return this.sent.filter((m) => m.type === t); },
  };
}

check('the round is every dated caller, and only those', DATED.length === CALLERS.filter((c) => c.when).length && DATED.length >= 20 && DATED.every((id) => CALLERS.find((c) => c.id === id).when));
check('nothing worked: none kept', yearsRound({}).kept.length === 0 && !yearsRound(undefined).done);
const some = yearsRound({ plough_boys: 1, wren_boys: 2, tell_the_bees: 5 });
check('everyday callers don\'t count; dated ones do', some.kept.length === 2 && some.kept.includes('plough_boys') && !some.kept.includes('tell_the_bees') && !some.done);
check('all of them: done', yearsRound(Object.fromEntries(DATED.map((id) => [id, 1]))).done);
check('the title is in the catalogue', TITLES.years_round && TITLES.years_round.name === "Keeper of the Year's Round");
check('the Calendar page shows the round and ticks the kept days', /The Year's Round: \$\{kept\.size\} of \$\{cal\.round\.total\} old days kept/.test(BOOK) && /kept\.has\(d\.key\) \? ' ✓'/.test(BOOK));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Almanac'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Almanac', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'roundkeeper'; h.accounts.roundkeeper = {}; h.playerProgress.roundkeeper = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  // Every dated caller but Margery Dutton (All Souls', a rite and nothing to hand over) already worked.
  const st = at(Date.UTC(2027, 10, 2, 12), () => h.callers.stateOf(p));
  st.byId = Object.fromEntries(DATED.filter((id) => id !== 'all_souls_souling').map((id) => [id, 1]));
  s.emit('message', JSON.stringify({ type: 'charm_book_state' }));
  const before = s.lastOfType('charm_book_state');
  check('the Calendar has the round: all but one kept', before.calendar.round && before.calendar.round.total === DATED.length && before.calendar.round.kept.length === DATED.length - 1 && !before.calendar.round.kept.includes('all_souls_souling'));
  // Work her on All Souls' Day: the soul cakes done, then finish.
  const finish = () => at(Date.UTC(2027, 10, 2, 12), () => {
    st.active = { id: 'all_souls_souling', done: { 0: 'The heap on the board goes down cake by cake.' } };
    s.emit('message', JSON.stringify({ type: 'caller_finish' }));
  });
  finish();
  const res = s.lastOfType('caller_result');
  const prog = h.playerProgress.roundkeeper;
  check('working the last dated caller grants Keeper of the Year\'s Round', res && res.id === 'all_souls_souling' && (prog.riteTitles || []).includes('years_round'), prog.riteTitles);
  check('…with a toast on screen, and the titles sent', s.allOfType('toast').some((t) => t.always && /Keeper of the Year's Round/.test(t.message)) && s.lastOfType('titles_state'));
  const toasts = s.allOfType('toast').length;
  finish();
  check('…and only once', s.allOfType('toast').filter((t) => /Keeper of the Year's Round/.test(t.message)).length === 1 && (prog.riteTitles || []).filter((x) => x === 'years_round').length === 1, toasts);
  s.emit('message', JSON.stringify({ type: 'charm_book_state' }));
  check('the Calendar now has every old day kept', s.lastOfType('charm_book_state').calendar.round.kept.length === DATED.length);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
