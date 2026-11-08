// Carling Sunday (Turner, 1562; Brand and The Gentleman's Magazine, 1786, as
// Hone gives them; the Northumberland assizes, 1825): old Mrs Charlton
// comes on the second Sunday before Easter as the Commonplace Book reckons it,
// and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-carling-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CARLING_RITES } = require('../data/carlingSunday.js');
const { CALLERS } = require('../data/callers.js');
const { OLD_CALENDAR, entryDate } = require('../data/oldCalendar.js');
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

const R = CARLING_RITES.carling_sunday;
check('carlings: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Turner, 1562: "called in Northumberland Carlines"', /"The perched or burstled peasen which ar called in Northumberland Carlines\."/.test(R.lore) && /Turner, Herbal, pt II \(1562\)/.test(R.source));
check('…Brand\'s steeped peas, given away; the yeomanry of 1786; the assizes of 1825', /"after having been steeped a night in water"/.test(R.lore) && /"given away, eaten at a kind of entertainment on Carle Sunday, and are called Carlings"/.test(R.lore) && /"The yeomanry in general steep peas, and afterwards parch them, and eat them on the afternoon of that day"/.test(R.lore) && /"immense quantities of small peas, called carlings, fried in butter, pepper, and salt, on the second Sunday before Easter"/.test(R.lore));
check('…the Lent rhyme, Care Sunday, and the siege ship called out as unsourced', /"Tid, Mid, Misera, \/ Carling, Palm, Paste Egg day\."/.test(R.lore) && /Care Sunday/.test(R.lore) && /no old source has it/.test(R.lore) && !/batter/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'carling_sunday');
check('the Commonplace Book\'s Carling Sunday: steeped and fried, Hone behind it; two Sundays before Easter', cal && /steeped overnight and fried in butter/.test(cal.text) && cal.quote === 'peas, called carlings, fried in butter, pepper, and salt' && /20 March and 4 August/.test(cal.source) && entryDate(cal, 2027).join('/') === '3/14' && entryDate(cal, 2026).join('/') === '3/22');
const c = CALLERS.find((x) => x.id === 'carling_sunday');
check('old Mrs Charlton, dated by it, for two days', c && c.when && c.when.calendar === 'carling_sunday' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'carling_sunday');
check('the practical half: a long soak, cooked through; no kidney beans; no whole peas for the under-fives; never leave the fat, never water on it, out and 999', /long soak in cold water and cooking right through/.test(c.resolution) && /dried kidney beans/.test(c.resolution) && /mash them for the under-fives/.test(c.resolution) && /never leave hot fat alone/.test(c.resolution) && /never throw water on it/.test(c.resolution) && /ring 999/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Charlton'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Charlton', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'charlton'; h.accounts.charlton = {}; h.playerProgress.charlton = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 2, 14, 12), Date.UTC(2027, 2, 15, 12), Date.UTC(2028, 3, 2, 12)].map(offered);
  check('on Carling Sunday (14 March 2027, 2 April 2028) and the Monday she comes first', days.every((o) => o[0] === 'carling_sunday' && o.length === 3), days);
  const outside = [Date.UTC(2027, 2, 13, 12), Date.UTC(2027, 2, 16, 12), Date.UTC(2028, 2, 14, 12)].map(offered);
  check('on other days, last year\'s day among them, she never comes', outside.every((o) => !o.includes('carling_sunday') && o.length === 3), outside);
  at(Date.UTC(2027, 2, 14, 12), () => {
    h.accounts.charlton.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.charlton, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'carling_sunday');
  check('…and writes Carlings into The Turning Year, moving with Easter', e && e.met && /· Carling Sunday$/.test(e.title) && e.date === 'moves with Easter' && ch.entries.findIndex((x) => x.id === 'carling_sunday') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
