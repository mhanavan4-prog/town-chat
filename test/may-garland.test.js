// The May garland (Frazer, 1922, on Saffron Walden and Debden; Folk-Lore,
// 1893, on Cambridge; Hone on the sweeps and milkmaids; The Spectator, 1902,
// on may blossom indoors): Mrs Hayward and her girls come on the Commonplace
// Book's own day, May Day (and the 2nd), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-maygarland-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { MAY_RITES } = require('../data/mayGarland.js');
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

const R = MAY_RITES.may_garland;
check('the May garland: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Frazer\'s Essex garlands: the doll in white, the crossed hoops', /"on the first of May little girls go about in parties from door to door… carrying garlands; a doll dressed in white is usually placed in the middle of each garland"/.test(R.lore) && /"The garlands are generally in the form of hoops intersecting each other at right angles"/.test(R.lore) && /Frazer, The Golden Bough \(1922\)/.test(R.source));
check('…Cambridge in 1893, and Simpson and Roud on how common it was', /"carry a female doll, hung in the midst of a hoop, which is wreathed with flowers"/.test(R.lore) && /Folk-Lore 4 \(1893\)/.test(R.source) && /"the most widespread and best known May Day activity in the 19th and early 20th centuries"/.test(R.lore) && /"Commentators assume she represented the Virgin Mary\."/.test(R.lore));
check('…Hone\'s sweeps and milkmaids; may blossom kept outside (1902); and no unsourced garland rhyme', /"garland is a large cone of holly and ivy framed upon hoops"/.test(R.lore) && /"a pyramidical frame, covered with damask"/.test(R.lore) && /"brings death with it into the house"/.test(R.lore) && /The Spectator \(18 January 1902\)/.test(R.source) && !/ladies and gentlemen/i.test(R.lore + R.how));
const cal = OLD_CALENDAR.find((e) => e.key === 'going_a_maying');
check('the Commonplace Book\'s May Day, 1 May', cal && cal.month === 5 && cal.day === 1);
const c = CALLERS.find((x) => x.id === 'may_garland');
check('Mrs Hayward and her girls, dated by it, for two days', c && c.when && c.when.calendar === 'going_a_maying' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'may_garland');
check('the practical half: pick, never dig; one in twenty (no unconfirmed "if in doubt"); the bluebell bulbs; the harmful flowers and hands washed; their mother along, and only houses they know', /never dig them up: uprooting a wild plant is against the law/.test(c.resolution) && /one flower in twenty/.test(c.resolution) && !/if in doubt/.test(c.resolution) && /bluebells' bulbs/.test(c.resolution) && /Lily of the valley is poisonous if eaten/.test(c.resolution) && /wash their hands/.test(c.resolution) && /their mother goes with them/.test(c.resolution) && /only to houses they know/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Ellen'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Ellen', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'ellen'; h.accounts.ellen = {}; h.playerProgress.ellen = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 4, 1, 12), Date.UTC(2027, 4, 2, 12)].map(offered);
  // Bridget Fahy's May Eve (data/mayEve.js) runs into May Day, so on the 1st
  // both dated callers come first.
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  check('on May Day and the 2nd they come first (with any other caller of the day)', days.every((o) => { const n = o.findIndex((id) => !dated(id)); return o.length === 3 && o.indexOf('may_garland') >= 0 && (n < 0 || o.indexOf('may_garland') < n); }), days);
  const outside = [Date.UTC(2027, 3, 30, 12), Date.UTC(2027, 4, 3, 12), Date.UTC(2027, 10, 1, 12)].map(offered);
  check('on other days they never come', outside.every((o) => !o.includes('may_garland') && o.length === 3), outside);
  at(Date.UTC(2027, 4, 1, 12), () => {
    h.accounts.ellen.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.ellen, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'may_garland');
  check('…and writes the May Garland into The Turning Year, dated 1 May', e && e.met && /· May Day$/.test(e.title) && e.date === '1 May' && ch.entries.findIndex((x) => x.id === 'may_garland') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
