// Childermas, the unluckiest day (Melton, 1620; the Paston Letters, 1461, and
// Gairdner's correction; The Spectator, 1711; Gregory, 1649; Chambers;
// Danaher): Joss Wardle the carrier comes on the Commonplace Book's own day
// (28 December, and the 29th), the Year's Round now runs to it, and the Charm
// Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-childermas-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CHILDERMAS_RITES } = require('../data/childermas.js');
const { CALLERS } = require('../data/callers.js');
const { OLD_CALENDAR } = require('../data/oldCalendar.js');
const { TITLES } = require('../data/titles.js');
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

const R = CHILDERMAS_RITES.childermas;
check('keeping Childermas: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Melton, 1620: no new suit, no nails pared, nothing begun', /"That it is not good to put on a new sute, pare ones nailes, or begin any thing on a Childermas day\."/.test(R.lore) && /Astrologaster \(1620\), p\. 46/.test(R.source));
check('…the weekday unlucky all the year after (Gairdner); Addison\'s old lady and her Thursday', /"used to be considered ominous or unlucky during the whole ensuing year"/.test(R.lore) && /"you shall not begin upon Childermas-day"/.test(R.lore) && /Spectator, no\. 7 \(8 March 1711\)/.test(R.source));
check('…the Paston rumour about Edward IV, and that it was only a rumour', /"for cause Childermesse day fal on the Sunday, the Coronacion shall on the Moneday"/.test(R.lore) && /It was only a rumour/.test(R.lore) && /crowned on the Sunday after all/.test(R.lore) && /letter 460/.test(R.source));
check('…Gregory\'s whipping, in his words and without "in bed"; Chambers; Danaher', /"to whip up the children upon Innocent's daie morning, that the memorie of this Murther might stick the closer"/.test(R.lore) && !/in bed/.test(R.lore) && /"about the most unlucky through-out the year"/.test(R.lore) && /"if 28th of December fell upon Monday all Mondays were unlucky"/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'childermas');
check('the Commonplace Book\'s Childermas no longer says the coronation was put off', cal && cal.month === 12 && cal.day === 28 && /only the pageants waited/.test(cal.text) && /a rumour/.test(cal.text));
const c = CALLERS.find((x) => x.id === 'childermas_carrier');
check('Joss Wardle the carrier, dated by it, for two days', c && c.when && c.when.calendar === 'childermas' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'childermas');
check('the practical half: the weather first; tell someone the road; what to carry; ten times as far to stop; and the king\'s tale is wrong', /if ice or snow is coming, don't go unless you must/.test(c.resolution) && /Tell someone at the far end which road you're taking/.test(c.resolution) && /a lamp, warm clothes and boots, a shovel, food and something hot to drink/.test(c.resolution) && /ten times as far to stop/.test(c.resolution) && /crowned on the Sunday after all/.test(c.resolution) && /Highway Code/.test(c.source));
check('the Year\'s Round now runs from New Year\'s morning to Childermas', /from New Year's morning to Childermas/.test(TITLES.years_round.desc));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Joss'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Joss', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'joss'; h.accounts.joss = {}; h.playerProgress.joss = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 11, 28, 12), Date.UTC(2027, 11, 29, 12)].map(offered);
  check('on Childermas and the 29th he comes first', days.every((o) => o[0] === 'childermas_carrier' && o.length === 3), days);
  const outside = [Date.UTC(2027, 11, 27, 12), Date.UTC(2027, 11, 30, 12), Date.UTC(2027, 5, 28, 12)].map(offered);
  check('on other days he never comes', outside.every((o) => !o.includes('childermas_carrier') && o.length === 3), outside);
  at(Date.UTC(2027, 11, 28, 12), () => {
    h.accounts.joss.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.joss, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'childermas');
  check('…and writes Keeping Childermas into The Turning Year, dated 28 December, the last of the dated days', e && e.met && /· Childermas$/.test(e.title) && e.date === '28 December' && ch.entries.filter((x) => x.date).pop().id === 'childermas', e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
