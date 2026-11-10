// St Lucy's Day, the year's midnight (Donne, printed 1633, and Ray, 1678, both
// read in the 1633 and 1678 texts; Hone; the Swedish Institute on Lucia):
// Thomasin Gale comes on the Commonplace Book's own day (13 December, and the
// 14th), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-lucy-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { LUCY_RITES } = require('../data/stLucy.js');
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

const R = LUCY_RITES.st_lucy;
check('Lucy light: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Donne, 1633, in his spelling: the title, the opening, the close', /"Nocturnall upon S\. Lucies day, Being the shortest day" \(printed 1633\)/.test(R.lore) && /"Tis the yeares midnight, and it is the dayes, \/ Lucies, who scarce seaven houres herself unmaskes, \/ The Sunne is spent"/.test(R.lore) && /"Both the yeares, and the dayes deep midnight is\."/.test(R.lore) && /Poems \(1633\), pp\. 187–88/.test(R.source));
check('…Ray\'s pair of proverbs, 1678', /"Barnaby bright, the longest day and the shortest night"/.test(R.lore) && /"Lucy light, the shortest day and the longest night\."/.test(R.lore) && /Proverbs \(1678\), pp\. 51–52/.test(R.source) && !/Lucy light, Lucy light/.test(R.lore));
check('…the old solstice and its slip; no English custom (Hone); Lucia as Swedish, 1764 and 1927', /"Prior to the adoption of the Gregorian calendar in the sixteenth century, St\. Lucy's Day fell on the winter solstice"/.test(R.lore) && /slipped a day or two/.test(R.lore) && /England wrote down no custom of its own/.test(R.lore) && /"gave away all her fortune to the poor"/.test(R.lore) && /Sweden's/.test(R.lore) && /1764/.test(R.lore) && /1927/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'st_lucy');
check('the Commonplace Book\'s St Lucy: reckoned the shortest day, with Ray\'s proverb', cal && cal.month === 12 && cal.day === 13 && /reckoned the shortest day/.test(cal.text) && /Lucy light, the shortest day and the longest night/.test(cal.text) && /Ray/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'st_lucy');
check('Thomasin Gale, dated by it, for two days', c && c.when && c.when.calendar === 'st_lucy' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'st_lucy');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Thomasin'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Thomasin', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'thomasin'; h.accounts.thomasin = {}; h.playerProgress.thomasin = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 11, 13, 12), Date.UTC(2027, 11, 14, 12)].map(offered);
  check('on St Lucy\'s Day and the 14th she comes first', days.every((o) => o[0] === 'st_lucy' && o.length === 3), days);
  const outside = [Date.UTC(2027, 11, 12, 12), Date.UTC(2027, 11, 15, 12), Date.UTC(2027, 11, 21, 12)].map(offered);
  check('on other days, St Thomas\'s among them, she never comes', outside.every((o) => !o.includes('st_lucy') && o.length === 3), outside);
  at(Date.UTC(2027, 11, 13, 12), () => {
    h.accounts.thomasin.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.thomasin, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'st_lucy');
  check('…and writes Lucy Light into The Turning Year, dated 13 December', e && e.met && /· St Lucy's Day$/.test(e.title) && e.date === '13 December' && ch.entries.findIndex((x) => x.id === 'st_lucy') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
