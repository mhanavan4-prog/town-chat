// Allantide (Hunt, 1865, and Courtney, 1890, both read in the period texts):
// Wenna Trewhella comes on Allan-night, the Commonplace Book's own day (31
// October, and 1 November), at the door with the Manx Hop-tu-Naa boys, and the
// Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-allan-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { ALLAN_RITES } = require('../data/allantide.js');
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

const R = ALLAN_RITES.allantide;
check('the Allan apple: badged folk, three signs that fit the Board', R && R.tier === 'folk' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Hunt, 1865: St Ives, the children, the apple to hide beneath the pillow, the Allan Market', /"still observed, to a great extent, at St Ives"/.test(R.lore) && /the time-honoured Allan apple to hide beneath their pillows"/.test(R.lore) && /"is dignified by the term Allan Market\."/.test(R.lore) && /no\. 111, p\. 177/.test(R.source));
check('…Courtney, 1890: Penzance, one each for luck, the elder girls and their sweethearts, dying out', /"very large apples, known locally as "Allan" apples"/.test(R.lore) && /"one was given to each member of the family to be eaten for luck\. The elder girls put theirs, before they ate them, under their pillows, to dream of their sweethearts"/.test(R.lore) && /"practically dying out"/.test(R.lore) && /pp\. 2–3/.test(R.source));
check('…the Newlyn candle cross; no St Allen, no polished apples, no husbands', /"often get instead a taste of the candle\."/.test(R.lore) && /have no old source/.test(R.lore) && !/husband/.test(R.lore + R.how));
const cal = OLD_CALENDAR.find((e) => e.key === 'allantide');
check('the Commonplace Book\'s Allantide: no polish, sweethearts not husbands, Hunt quoted, badged folk', cal && cal.month === 10 && cal.day === 31 && !/polished/.test(cal.text) && /sweethearts/.test(cal.text) && !/husband/.test(cal.text) && cal.quote === 'the time-honoured Allan apple to hide beneath their pillows' && cal.tier === 'folk');
const c = CALLERS.find((x) => x.id === 'allantide');
check('Wenna Trewhella, dated by it, for two days', c && c.when && c.when.calendar === 'allantide' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'allantide');
check('the practical half: wash the apples; battery lights on the cross; costumes from flame, UKCA or CE, no lit pumpkins for little ones; the ducking tub watched and emptied, five centimetres', /Wash the apples under running water/.test(c.resolution) && /battery lights instead of candles/.test(c.resolution) && /UKCA or CE mark/.test(c.resolution) && /pumpkin with a lit candle/.test(c.resolution) && /empty it after/.test(c.resolution) && /five centimetres of water/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Wenna'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Wenna', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'wenna'; h.accounts.wenna = {}; h.playerProgress.wenna = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 9, 31, 12), Date.UTC(2027, 10, 1, 12)].map(offered);
  check('on Allan-night and the morning after she and the Hop-tu-Naa boys both come first', days.every((o) => o.length === 3 && o.slice(0, 2).sort().join() === 'allantide,hop_tu_naa_moots'), days);
  const outside = [Date.UTC(2027, 9, 30, 12), Date.UTC(2027, 10, 2, 12), Date.UTC(2027, 3, 30, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('allantide') && o.length === 3), outside);
  at(Date.UTC(2027, 9, 31, 12), () => {
    h.accounts.wenna.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.wenna, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'allantide');
  check('…and writes the Allan Apple into The Turning Year, dated 31 October', e && e.met && /· Allantide$/.test(e.title) && e.date === '31 October' && ch.entries.findIndex((x) => x.id === 'allantide') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
