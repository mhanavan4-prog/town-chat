// Martinmas week: St Martin's blood (Mooney, 1889, quoting Lady Wilde), a
// caller who comes only 9–13 November, first at the door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-martinmas-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { MARTINMAS_RITES, MARTINMAS_WHEN } = require('../data/martinmas.js');
const { CALLERS } = require('../data/callers.js');
const { OLD_CALENDAR } = require('../data/oldCalendar.js');
const { buildCharmBook } = require('../lib/charmBook.js');
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

const R = MARTINMAS_RITES.martin_blood;
check('St Martin\'s blood: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Lady Wilde\'s words via Mooney (1889): the goose or black cock, the blood on the floor and threshold', /"a goose is killed, or a black cock, and the blood is sprinkled over the floor and on the threshold"/.test(R.lore) && /Mooney, "The Holiday Customs of Ireland"/.test(R.source) && /Lady Wilde/.test(R.source));
check('…and "no wheel should turn, or anything go round, on this day"', /"no wheel should turn, or anything go round, on this day"/.test(R.lore) && /nothing turns on a wheel/.test(R.how));
check('the mart and the hiring fairs named as the season\'s', /mart/.test(R.lore) && /hiring fairs/.test(R.lore));
check('Martinmas week is 9–13 November, and the old calendar has Martinmas on the 11th', MARTINMAS_WHEN.month === 11 && MARTINMAS_WHEN.from === 9 && MARTINMAS_WHEN.to === 13 && OLD_CALENDAR.some((e) => e.key === 'martinmas' && e.month === 11 && e.day === 11));
const c = CALLERS.find((x) => x.id === 'martinmas_cock');
check('a Martinmas caller: salt for the meat, then the rite', c && c.when && c.steps[0].item === 'salt' && c.steps[1].rite === 'martin_blood');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Martin'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Martin', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'martin'; h.accounts.martin = {}; h.playerProgress.martin = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [9, 10, 11, 12, 13].map((d) => offered(Date.UTC(2026, 10, d, 12)));
  check('in Martinmas week she comes every day, first at the door', days.every((o) => o[0] === 'martinmas_cock'), days);
  check('…with three callers in all (Samhain\'s season caller and one more)', days.every((o) => o.length === 3));
  const outside = [Date.UTC(2026, 10, 8, 12), Date.UTC(2026, 10, 14, 12), Date.UTC(2026, 6, 11, 12), Date.UTC(2027, 1, 3, 12)].map(offered);
  check('outside the week she never comes', outside.every((o) => !o.includes('martinmas_cock') && o.length === 3), outside);
  // Work it through the real handler.
  at(Date.UTC(2026, 10, 11, 12), () => {
    h.accounts.martin.callers.active = { id: c.id, done: { 0: 'salt' } };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[1];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.martin, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'martin_blood');
  check('…and writes St Martin\'s Blood into The Turning Year, after the festivals', e && e.met && /· Martinmas$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'martin_blood') >= 12);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
