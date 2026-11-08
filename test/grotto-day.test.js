// Grotto Day, Old St James's, 5 August: London children's shell grottoes with a
// candle, "Mind the grotto!" (Chambers, 1864; Hone; Notes and Queries, 1851;
// Douglas, 1916), a caller dated by the Commonplace Book's own entry, first at
// the door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-grotto-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { GROTTO_RITES } = require('../data/grotto.js');
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

const R = GROTTO_RITES.grotto;
check('mind the grotto: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Chambers: the shells from taverns and fish-shops, Old St James\'s Day, the candle, "Mind the grotto!"', /"which have been cast out from taverns and fish-shops,"/.test(R.lore) && /"By the time that old St\. James's Day \(the 5th of August\) has come about, they have these little fabrics in nice order, with a candle stuck in the top, to be lighted at night\."/.test(R.lore) && /"Mind the grotto!"/.test(R.lore) && /"a demand for a penny wherewith professedly to keep up the candle"/.test(R.lore) && /Chambers, The Book of Days \(1864\), 25 July/.test(R.source));
check('…the pilgrim\'s scallop and the oysters coming in; Hone\'s money saying', /"was a scallop shell worn on the cloak or hat"/.test(R.lore) && /Compostela/.test(R.lore) && /"whoever eats oysters on St\. James's day will never want money\."/.test(R.lore) && /Hone, The Every-Day Book, vol\. II \(1827\), 25 July/.test(R.source));
check('…"It is but once a year, sir!" (1851), Douglas in 1916, and Whitstable now; no unfound rhyme', /"It is but once a year, sir!"/.test(R.lore) && /Notes and Queries \(11 October 1851\), p\. 270/.test(R.source) && /"and say 'Remember the grotto'—meaning Pay up"/.test(R.lore) && /Whitstable/.test(R.lore) && !/Father's gone to sea/.test(R.lore));
const c = CALLERS.find((x) => x.id === 'grotto_day_shells');
check('Polly and Dick Sweeting, dated by the old calendar\'s Grotto Day, for two days', c && c.when && c.when.calendar === 'grotto_day' && c.when.days === 2 && OLD_CALENDAR.some((e) => e.key === 'grotto_day' && e.month === 8 && e.day === 5) && c.steps[0].rite === 'grotto');
check('the practical half: the R rule is about spawning and the law, not safety; raw oysters and norovirus, worse in winter; who should not eat them raw; cooked through is safe; a grown-up by the candle', /R in the month/.test(c.resolution) && /spawn in summer/.test(c.resolution) && /may not be sold/.test(c.resolution) && /doesn't keep you safe/.test(c.resolution) && /more in the cold months than the warm/.test(c.resolution) && /anyone with child/.test(c.resolution) && /cooked through, they're safe/.test(c.resolution) && /never left burning alone/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Polly'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Polly', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'polly'; h.accounts.polly = {}; h.playerProgress.polly = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [5, 6].map((d) => offered(Date.UTC(2027, 7, d, 12)));
  const season = at(Date.UTC(2027, 7, 5, 12), () => h.calendarPublicState().season.key);
  check('on Grotto Day they come first, a caller of the season after them', days.every((o) => o[0] === 'grotto_day_shells' && o.length === 3 && CALLERS.find((x) => x.id === o[1]).season === season), [season, days]);
  const outside = [Date.UTC(2027, 7, 4, 12), Date.UTC(2027, 7, 7, 12), Date.UTC(2027, 6, 25, 12)].map(offered);
  check('on other days they never come (not on new St James\'s, 25 July)', outside.every((o) => !o.includes('grotto_day_shells') && o.length === 3), outside);
  at(Date.UTC(2027, 7, 5, 12), () => {
    h.accounts.polly.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.polly, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'grotto');
  check('…and writes Mind the Grotto into The Turning Year', e && e.met && /· Grotto Day$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'grotto') >= 12);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
