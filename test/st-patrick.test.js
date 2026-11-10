// St Patrick's Day (Dinely, 1681, and Threlkeld, 1726, second-hand; Hone,
// 1827, read in the 1827 text; the National Museum of Ireland): Owen Keogh
// comes on the Commonplace Book's own day (17 March, and the 18th), and the
// Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-patrick-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { PATRICK_RITES } = require('../data/stPatrick.js');
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

const R = PATRICK_RITES.st_patrick;
check('drowning the shamrock: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Dinely, 1681: crosses in the hats, the vulgar\'s shamrock, eaten for sweet breath', /"ye Irish of all stations and condicions were crosses in their hatts, some of pinns, some of green ribbon, and the vulgar superstitiously wear shamroges, 3 leav'd grass, which they likewise eat \(they say\) to cause a sweet breath\."/.test(R.lore) && /Kilkenny Archaeological Society \(1856–57\)/.test(R.source));
check('…Threlkeld, 1726: the Trinity a current tradition, and the excess in liquor', /"a current tradition, that by this Three Leafed Grass, he emblematically set forth to them the Mystery of the Holy Trinity\. However that be, when they wet their Seamar-oge, they often commit excess in liquor"/.test(R.lore) && /Threlkeld/.test(R.source));
check('…Hone, 1827: the Patrick\'s pot, the children\'s crosses, drowned in the last glass; the shoulder later; the plant unsettled', /"a 'Patrick's pot,' or quantum of beer; but, of late years, whiskey is the beverage most esteemed"/.test(R.lore) && /"children have 'Patrick's crosses' pinned to their sleeves"/.test(R.lore) && /"also on Sheelah's day" \(the 18th\), should "on the latter night, be drowned in the last glass"/.test(R.lore) && /comes from later accounts/.test(R.lore) && /lesser clover was named most often/.test(R.lore) && /cols\. 386–89/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'st_patrick');
check('the Commonplace Book\'s St Patrick: Dinely for the shamrock, the drowning dated later; Dinely quoted', cal && cal.month === 3 && cal.day === 17 && /by 1827 the shamrock was "drowned"/.test(cal.text) && /later it was thrown over the shoulder/.test(cal.text) && cal.quote === "the vulgar superstitiously wear shamroges, 3 leav'd grass" && /Hone/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'st_patrick');
check('Owen Keogh, dated by it, for two days', c && c.when && c.when.calendar === 'st_patrick' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'st_patrick');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Owen'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Owen', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'owen'; h.accounts.owen = {}; h.playerProgress.owen = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('st_patrick');
  // 2028: Easter 16 April, so Mothering Sunday is 26 March and Carling Sunday 2 April; 17–18 March are clear.
  const days = [Date.UTC(2028, 2, 17, 12), Date.UTC(2028, 2, 18, 12)].map(offered);
  check('on St Patrick\'s Day and the 18th he comes first', days.every(leads) && days.every((o) => o[0] === 'st_patrick'), days);
  const outside = [Date.UTC(2028, 2, 16, 12), Date.UTC(2028, 2, 19, 12), Date.UTC(2028, 8, 17, 12)].map(offered);
  check('on other days he never comes', outside.every((o) => !o.includes('st_patrick') && o.length === 3), outside);
  at(Date.UTC(2028, 2, 17, 12), () => {
    h.accounts.owen.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.owen, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'st_patrick');
  check('…and writes Drowning the Shamrock into The Turning Year, dated 17 March', e && e.met && /· St Patrick's Day$/.test(e.title) && e.date === '17 March' && ch.entries.findIndex((x) => x.id === 'st_patrick') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
