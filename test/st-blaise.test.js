// St Blaise's Day (Hone, 1826, read in the 1826 text: Butler, Ribadeneira,
// Aëtius's receipt, the note on Brand, the Golden Legend, the Bradford
// festival of 1825): Jonas Firth, woolcomber, comes on the Commonplace Book's
// own day (3 February, and the 4th), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-blaise-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { BLAISE_RITES } = require('../data/stBlaise.js');
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

const R = BLAISE_RITES.st_blaise;
check('Bishop Blaise: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Hone after Butler: throats, Ragusa, the woolcombers, the iron combs; the fishbone', /"venerated for the cure of sore throats; principal patron of Ragusa, titular patron of the wool-combers"/.test(R.lore) && /"tormented with iron combs, and martyred under Licinius, in 316"/.test(R.lore) && /"cured a youth who had a fish-bone stuck in his throat by praying"/.test(R.lore) && /cols\. 207–12/.test(R.source));
check('…the widow\'s candle in the old spelling; the note on Brand on toothache and cattle', /"every yere she sholde offre in his chirche a candell"/.test(R.lore) && /"It is observed in a note on Brand, that the candles offered to St\. Blase were said to be good for the tooth-ache, and for diseased cattle\."/.test(R.lore));
check('…the charm as Aëtius\'s receipt by way of Ribadeneira, not English, in Hone\'s words', /not English at all/.test(R.lore) && /Ribadeneira/.test(R.lore) && /Aëtius/.test(R.lore) && /"Receipt for a stoppage in the throat"/.test(R.lore) && /"Hold the diseased party by the throat, and pronounce these words:—BLASE, the martyr and servant of Jesus Christ, commands thee to pass up or down!"/.test(R.lore));
check('…the woolcombers alone in England; Bradford\'s septennial festival of 1825; the crossed candles Catholic and modern in English', /"no other trade or persons"/.test(R.lore) && /"The septennial festival, held in honour of bishop Blase, and of the invention of wool-combing attributed to that personage"/.test(R.lore) && /470 woolcombers/.test(R.lore) && /two candles held crossed/.test(R.lore) && !/blaze bonfire/i.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'st_blaise');
check('the Commonplace Book\'s St Blaise: the fishbone, "were said to be", an old physician\'s charm, Bradford; Hone\'s words kept', cal && cal.month === 2 && cal.day === 3 && /fishbone/.test(cal.text) && /were said to be good/.test(cal.text) && /old physician's charm/.test(cal.text) && /Bradford/.test(cal.text) && cal.quote === 'BLASE, the martyr and servant of Jesus Christ, commands thee to pass up or down!');
const c = CALLERS.find((x) => x.id === 'st_blaise');
check('Jonas Firth, woolcomber, dated by it, for two days', c && c.when && c.when.calendar === 'st_blaise' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'st_blaise');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Jonas'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Jonas', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'jonas'; h.accounts.jonas = {}; h.playerProgress.jonas = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 1, 3, 12), Date.UTC(2027, 1, 4, 12)].map(offered);
  check('on St Blaise\'s Day and the 4th he comes first', days.every((o) => o[0] === 'st_blaise' && o.length === 3), days);
  const outside = [Date.UTC(2027, 1, 2, 12), Date.UTC(2027, 1, 5, 12), Date.UTC(2027, 7, 3, 12)].map(offered);
  check('on other days, Candlemas among them, he never comes', outside.every((o) => !o.includes('st_blaise') && o.length === 3), outside);
  at(Date.UTC(2027, 1, 3, 12), () => {
    h.accounts.jonas.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.jonas, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'st_blaise');
  const order = ch.entries.map((x) => x.id);
  check('…and writes Bishop Blaise into The Turning Year, dated 3 February, after Candlemas Eve', e && e.met && /· St Blaise's Day$/.test(e.title) && e.date === '3 February' && order.indexOf('st_blaise') > order.indexOf('candlemas_green') && order.indexOf('st_blaise') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
