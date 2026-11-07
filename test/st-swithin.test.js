// St Swithin's Day, 15 July: forty days of rain (Chambers, 1864; Hone;
// Jonson, 1599), what the records say (Chambers's Greenwich years; the Met
// Office; the RMetS), a caller dated by the Commonplace Book's own entry,
// first at the door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-swithin-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { SWITHIN_RITES } = require('../data/stSwithin.js');
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

const R = SWITHIN_RITES.swithin_sky;
check('reading the sky: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the rhyme in Chambers\'s words ("nae mair")', /"St Swithin's Day, if thou dost rain, \/ For forty days it will remain: \/ St\. Swithin's Day, if thou be fair, \/ For forty days 'twill rain nae mair"/.test(R.lore) && /Chambers, The Book of Days \(1864\), 15 July/.test(R.source));
check('…the burial outside (legend), the translation of 15 July 971 (record), and the forty days\' rain with "no authority whatever"', /"where his corpse might receive the eaves-droppings from the roof, and his grave be trodden by the feet of the passers-by"/.test(R.lore) && /15 July 971/.test(R.lore) && /"rests on no authority whatever"/.test(R.lore) && /"a cutting from an old newspaper"/.test(R.lore) && /862 or 863/.test(R.lore));
check('…Jonson\'s almanac in 1599, quoted as printed', /"St\. Swithin's, the 15 day, variable weather, for the most part rain"/.test(R.lore) && /"it should rain forty days after, now, more or less, it was a rule held"/.test(R.lore) && /Jonson, Every Man Out of His Humour \(1599\), I\.1/.test(R.source));
check('…Chambers\'s Greenwich years, the Met Office, and the RMetS\'s glimmer of sense', /"the greatest number of rainy days, after St\. Swithin's Day, had taken place when the 15th of July was dry\."/.test(R.lore) && /"since records began there has been no occurrence of rainfall for such a prolonged period of time\."/.test(R.lore) && /"the tiniest glimmer of sense"/.test(R.lore) && /jet stream/.test(R.lore));
const c = CALLERS.find((x) => x.id === 'st_swithin_hay');
check('Josiah Mead, dated by the old calendar\'s St Swithin, for two days', c && c.when && c.when.calendar === 'st_swithin' && c.when.days === 2 && OLD_CALENDAR.some((e) => e.key === 'st_swithin' && e.month === 7 && e.day === 15) && c.steps[0].rite === 'swithin_sky');
check('the practical half: red sky from the west; mackerel sky and mares\' tails; swallows tell now, not tomorrow; no forty days; blight, and two weeks before lifting; make hay', /weather comes from the west/.test(c.resolution) && /mackerel sky and mares' tails/.test(c.resolution) && /don't foretell tomorrow/.test(c.resolution) && /forty days of rain has never happened/.test(c.resolution) && /blight/.test(c.resolution) && /wait two weeks before you lift them/.test(c.resolution) && /"make hay while sun doth shine"/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Mead'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Mead', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'mead'; h.accounts.mead = {}; h.playerProgress.mead = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [15, 16].map((d) => offered(Date.UTC(2027, 6, d, 12)));
  const season = at(Date.UTC(2027, 6, 15, 12), () => h.calendarPublicState().season.key);
  check('on St Swithin\'s Day he comes first, a caller of the season after him', days.every((o) => o[0] === 'st_swithin_hay' && o.length === 3 && CALLERS.find((x) => x.id === o[1]).season === season), [season, days]);
  const outside = [Date.UTC(2027, 6, 14, 12), Date.UTC(2027, 6, 17, 12), Date.UTC(2027, 0, 15, 12)].map(offered);
  check('on other days he never comes', outside.every((o) => !o.includes('st_swithin_hay') && o.length === 3), outside);
  at(Date.UTC(2027, 6, 15, 12), () => {
    h.accounts.mead.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.mead, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'swithin_sky');
  check('…and writes Reading the Sky into The Turning Year, after St John\'s Eve', e && e.met && /· St Swithin's Day$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'swithin_sky') === ch.entries.findIndex((x) => x.id === 'fern_seed') + 1);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
