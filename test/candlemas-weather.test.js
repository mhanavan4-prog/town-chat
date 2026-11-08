// Candlemas weather (Hone, 2 February, with the almanacs' rhyme and Ray's
// hind; Chambers, 1864; Swainson, 1873; Cranmer's letter as Heylyn prints it;
// Hansard, 1990): Mary Teasdale comes on the Commonplace Book's own day,
// 2 February, for the one day, with a practical half on pregnancy and the
// lambing (NHS; UKHSA; Public Health Wales); and the Charm Book. The old
// calendar is put right: the rhyme is the almanacs', and the order is dated.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-candle-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CANDLEMAS_WEATHER_RITES } = require('../data/candlemasWeather.js');
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

const R = CANDLEMAS_WEATHER_RITES.candlemas_weather;
check('Candlemas Weather: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the almanacs\' rhyme, whole, as Hone gives it; Ray\'s hind; Swainson\'s shepherd; the Scots half o\' winter', /"Other almanacs prophesy to the like purport,"/.test(R.lore) && /"If Candle-mas day be fair and bright, \/ Winter will have another flight; \/ But if Candlemas-day be clouds and rain, \/ Winter is gone, and will not come again\."/.test(R.lore) && /"The hind had as lief see his wife on the bier, \/ As that Candlemas-day should be pleasant and clear"/.test(R.lore) && /"had rather see his wife on the bier"/.test(R.lore) && /"If Candlemass day be dry and fair, \/ The half o' winter's to come and mair/.test(R.lore) && /Swainson/.test(R.source));
check('…the order in council, Edward VI\'s second year, and the Council\'s words of January 1548; Scotland\'s quarter day; no German badger', /"Candlemas candle-carrying remained in England till its abolition by an order in council, in the second year of king Edward VI"/.test(R.lore) && /"that no candles shall be borne upon Candlemas-day"/.test(R.lore) && /quarter days/.test(R.lore) && !/badger|wolf/.test(R.lore) && /Heylyn/.test(R.source) && /Hansard/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'candlemas');
check('the Commonplace Book\'s Candlemas, put right: the almanacs\' rhyme, 1548, the Scottish quarter day', cal && cal.month === 2 && cal.day === 2 && /as the almanacs had it/.test(cal.text) && /stopped it in 1548/.test(cal.text) && /quarter day/.test(cal.text) && !/in procession/.test(cal.text) && /Almanac rhyme/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'candlemas_weather');
check('Mary Teasdale, from the fell farm, dated by it, for the one day', c && /fell farm/.test(c.caller) && c.when && c.when.calendar === 'candlemas' && c.when.days === 1 && c.steps.length === 1 && c.steps[0].rite === 'candlemas_weather');
check('the practical half: no lambing or milking ewes; no newborn or aborted lambs, no afterbirth; chlamydia and toxoplasma', /Then the practical half/.test(c.resolution) && /should not help to lamb or milk ewes, and should keep away from newborn lambs, from aborted lambs and from the afterbirth/.test(c.resolution) && /chlamydia and toxoplasma/.test(c.resolution) && /NHS/.test(c.source) && /UKHSA/.test(c.source));
check('…clothes and boots washed hot first; the lamber in protective clothing, soap and water, not gel; fever or flu to the doctor or midwife', /shouldn't handle clothes or boots that have been among the ewes until they've been washed on a hot cycle/.test(c.resolution) && /wash thoroughly with soap and water, because hand gel alone isn't enough/.test(c.resolution) && /fever or anything like flu after being near sheep, she should tell her doctor or midwife straight away/.test(c.resolution) && /Public Health Wales/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Mary'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Mary', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'mary'; h.accounts.mary = {}; h.playerProgress.mary = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('candlemas_weather');
  const days = [Date.UTC(2027, 1, 2, 12), Date.UTC(2031, 1, 2, 12)].map(offered);
  check('on Candlemas Day she comes among the day\'s dated callers (sharing with Candlemas Eve and St Brigid)', days.every(leads), days);
  const outside = [Date.UTC(2027, 1, 1, 12), Date.UTC(2027, 1, 3, 12), Date.UTC(2027, 8, 1, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('candlemas_weather') && o.length === 3), outside);
  at(Date.UTC(2027, 1, 2, 12), () => {
    h.accounts.mary.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.mary, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'candlemas_weather');
  check('…and writes the Candlemas Weather into The Turning Year, dated 2 February', e && e.met && /· Candlemas$/.test(e.title) && e.date === '2 February' && ch.entries.findIndex((x) => x.id === 'candlemas_weather') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
