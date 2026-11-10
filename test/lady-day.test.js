// Lady Day (the Calendar Act of 1750; Pollard, 1940; Hone, 1827; Hardy's Tess,
// 1891): Will Durbin, carter, comes on the Commonplace Book's own day (25
// March, and the 26th), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-ladyday-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { LADY_RITES } = require('../data/ladyDay.js');
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

const R = LADY_RITES.lady_day;
check('Lady Day flitting: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Hone\'s quarter day; the Act of 1750 in its words; the twelfth century, not 1155', /"is only remembered as the first quarter-day in the year, and is therefore only kept by tenants who truly pay rent to their landlords\."/.test(R.lore) && /"the legal supputation of the year of our Lord in England, according to which the year beginneth on the twenty-fifth day of March"/.test(R.lore) && /"begin to be reckoned from the first day of every such month of January"/.test(R.lore) && /twelfth century/.test(R.lore) && !/1155/.test(R.lore));
check('…Pollard: hardly anyone called it New Year\'s Day; the Exchequer\'s year to 5 April, tax from 6 April', /"failed to find a single instance of that day being actually described as New Year's day\."/.test(R.lore) && /"the exchequer was firm in its resistance to the loss of eleven days' revenue; its financial year was prolonged to 5 April, and we still pay income tax on a year which runs from 6 April\."/.test(R.lore) && /Pollard/.test(R.source));
check('…Old Lady Day the sixth of April after 1800, Hardy\'s moving day and wet Lady-Day', /after 1800 on the sixth of April/.test(R.lore) && /"the agricultural world was in a fever of mobility such as only occurs at that particular date of the year"/.test(R.lore) && /"A wet Lady-Day was a spectre which removing families never forgot; damp furniture, damp bedding, damp clothing"/.test(R.lore) && /Tess/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'lady_day');
check('the Commonplace Book\'s Lady Day: no 1155, the legal year not New Year\'s Day, the tax year begins on the 6th; the Act quoted', cal && cal.month === 3 && cal.day === 25 && !/1155/.test(cal.text) && /legal year/.test(cal.text) && /hardly anyone called it New Year's Day/.test(cal.text) && /tax year still begins on the 6th/.test(cal.text) && !/Old Lady Day \(5 April\)/.test(cal.text) && cal.quote === 'the year beginneth on the twenty-fifth day of March' && /Pollard/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'lady_day');
check('Will Durbin, dated by it, for two days', c && c.when && c.when.calendar === 'lady_day' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'lady_day');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Will'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Will', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'will'; h.accounts.will = {}; h.playerProgress.will = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('lady_day');
  // 2028: Easter 16 April, so Lady Day is clear of Good Friday, Mothering and Carling Sundays.
  const days = [Date.UTC(2028, 2, 25, 12), Date.UTC(2028, 2, 26, 12)].map(offered);
  check('on Lady Day and the 26th he comes first', days.every(leads), days);
  const outside = [Date.UTC(2028, 2, 24, 12), Date.UTC(2028, 2, 27, 12), Date.UTC(2028, 3, 6, 12)].map(offered);
  check('on other days, Old Lady Day among them, he never comes', outside.every((o) => !o.includes('lady_day') && o.length === 3), outside);
  at(Date.UTC(2028, 2, 25, 12), () => {
    h.accounts.will.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.will, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'lady_day');
  const order = ch.entries.map((x) => x.id);
  check('…and writes Lady Day Flitting into The Turning Year, dated 25 March, before the Borrowing Days', e && e.met && /· Lady Day$/.test(e.title) && e.date === '25 March' && order.indexOf('lady_day') < order.indexOf('borrowed_days') && order.indexOf('lady_day') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
