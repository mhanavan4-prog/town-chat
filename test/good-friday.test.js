// The Good Friday bun: bread kept the year through as a cure and against fire
// (Chambers, 1864; Hone; Poor Robin, 1733), a caller dated by Easter through
// the Commonplace Book's own entry, first at the door, and the Charm Book; the
// practical half is the water, not the bun.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-goodfriday-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { GOOD_FRIDAY_RITES } = require('../data/goodFriday.js');
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

const R = GOOD_FRIDAY_RITES.cross_bun;
check('the Good Friday bun: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Chambers: kept "all through the ensuing year", grated in water "particularly for diarrhea"', /"all through the ensuing year"/.test(R.lore) && /"a few gratings of it in water would prove a specific for any ailment, but particularly for diarrhea"/.test(R.lore) && /Chambers, The Book of Days \(1864\), Good Friday/.test(R.source));
check('…"not grow mouldy" (Poor Robin, 1733), and Hone\'s bun against fire', /"not grow mouldy like the common bread"/.test(R.lore) && /Poor Robin's Almanack \(1733\)/.test(R.source) && /"for luck"/.test(R.lore) && /"preserves the house from fire"/.test(R.lore));
check('the Pitt Rivers bun of 1976, and the Widow\'s Son at Bow', /"Grated & mixed with a hot drink to cure colds"/.test(R.lore) && /1981\.11\.2/.test(R.source) && /Widow's Son in Bow/.test(R.lore) && /1065801/.test(R.source));
const c = CALLERS.find((x) => x.id === 'good_friday_bun');
check('Ann Tilley, dated by the old calendar\'s Good Friday (Easter less two days), for two days', c && c.when && c.when.calendar === 'good_friday_bun' && c.when.days === 2 && OLD_CALENDAR.some((e) => e.key === 'good_friday_bun' && e.rule) && c.steps[0].rite === 'cross_bun');
check('the practical half: the child is drying out; small sips, the salts, the doctor if he wets less; the water does the good', /drying out/.test(c.resolution) && /Small sips of water/.test(c.resolution) && /wetting less/.test(c.resolution) && /doctor today/.test(c.resolution) && /It's the water that does the good/.test(c.resolution) && /NHS/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Bun'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Bun', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'bun'; h.accounts.bun = {}; h.playerProgress.bun = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  // "First" counts any place among the day's dated callers (26 March 2027 is Lady Day's second day too).
  const first = (y, m, d) => { const o = offered(Date.UTC(y, m - 1, d, 12)); const n = o.filter((id) => !!(CALLERS.find((x) => x.id === id) || {}).when).length; return o.slice(0, n).includes('good_friday_bun'); };
  // Easter 2026 is 5 April, 2027 28 March, 2028 16 April.
  check('she comes first on Good Friday and the day after, as Easter moves: 3 April 2026, 26 March 2027, 14 April 2028', first(2026, 4, 3) && first(2026, 4, 4) && !first(2026, 4, 2) && !first(2026, 4, 5) && first(2027, 3, 26) && first(2028, 4, 14));
  const outside = [Date.UTC(2027, 3, 3, 12), Date.UTC(2027, 8, 26, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('good_friday_bun') && o.length === 3), outside);
  at(Date.UTC(2027, 2, 26, 12), () => {
    h.accounts.bun.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.bun, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'cross_bun');
  check('…and writes the Good Friday Bun into The Turning Year', e && e.met && /· Good Friday$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'cross_bun') >= 12);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
