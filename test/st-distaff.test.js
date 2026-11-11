// St Distaff's Day (Herrick, 1648, read in the 1648 text; Hone, 1826;
// Chambers, 1864; Hervey, 1836): Maud Pyke comes on the morrow after Twelfth
// Day, the Commonplace Book's own day (7 January, and the 8th), and the Charm
// Book, whose Turning Year now says it runs from New Year's morning to
// Childermas.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-distaff-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { DISTAFF_RITES } = require('../data/stDistaff.js');
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

const R = DISTAFF_RITES.st_distaff;
check('St Distaff\'s Day: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Herrick, 1648, in his spelling: "Twelth", the plough, the flax and tow, "pailes", good-night', /"Saint Distaffs day, or the morrow after Twelth day" \(1648\)/.test(R.lore) && /"Partly worke and partly play \/ Ye must on S\. Distaffs day: \/ From the Plough soone free your teame;/.test(R.lore) && /Burne the flax, and fire the tow: \/ Scorch their plackets, but beware \/ That ye singe no maiden-haire\. \/ Bring in pailes of water then, \/ Let the Maides bewash the men\./.test(R.lore) && /Then bid Christmas sport good-night\."/.test(R.lore) && /Hesperides \(1648\), p\. 374/.test(R.source));
check('…the rock, Hone\'s hedge, Chambers\'s jocular name, Hervey\'s doubt; it rests on one poem', /"in honour of the rock, which is a distaff held in the hand"/.test(R.lore) && /"It seems that the burning of the flax and tow belonging to the women, was the men's diversion in the evening of the first day of labour after the twelve days of Christmas"/.test(R.lore) && /"jocularly"/.test(R.lore) && /"if there are any remains"/.test(R.lore) && /rests, in the end, on the one poem/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'st_distaff');
check('the Commonplace Book\'s St Distaff: Rock Day, in Herrick\'s poem, with his line', cal && cal.month === 1 && cal.day === 7 && /Rock Day/.test(cal.text) && /in Herrick's poem/.test(cal.text) && cal.quote === 'Burne the flax, and fire the tow' && /Herrick/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'st_distaff');
check('Maud Pyke, dated by it, for two days', c && c.when && c.when.calendar === 'st_distaff' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'st_distaff');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Maud'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Maud', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'maud'; h.accounts.maud = {}; h.playerProgress.maud = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  // In 2027 Plough Monday is 11 January; the Twelfth Night caller's two days run into the 7th.
  const days = [Date.UTC(2027, 0, 7, 12), Date.UTC(2027, 0, 8, 12)].map(offered);
  const leads = (o) => { const n = o.filter(dated).length; return o.length === 3 && o.slice(0, n).includes('st_distaff'); };
  check('on the 7th and 8th she comes first (with the Twelfth Night caller on the 7th)', days.every(leads) && days[1][0] === 'st_distaff', days);
  // In 2030 Plough Monday falls on 7 January: Herrick's two together.
  const both = offered(Date.UTC(2030, 0, 7, 12));
  check('…and when Plough Monday is the 7th, she and the ploughboys both come first', both.includes('st_distaff') && both.includes('plough_boys') && both.slice(0, both.filter(dated).length).every(dated), both);
  const outside = [Date.UTC(2027, 0, 6, 12), Date.UTC(2027, 0, 9, 12), Date.UTC(2027, 6, 7, 12)].map(offered);
  check('on other days, Twelfth Day among them, she never comes', outside.every((o) => !o.includes('st_distaff') && o.length === 3), outside);
  at(Date.UTC(2027, 0, 7, 12), () => {
    h.accounts.maud.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const book = buildCharmBook({ acct: h.accounts.maud, prog: {}, seasonKey: null });
  const ch = book.chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'st_distaff');
  const order = ch.entries.map((x) => x.id);
  check('…and writes St Distaff\'s Day into The Turning Year, dated 7 January, before Plough Monday', e && e.met && /· 7 January$/.test(e.title) && e.date === '7 January' && order.indexOf('st_distaff') < order.indexOf('plough_monday') && order.indexOf('st_distaff') >= 12, e);
  check('the Turning Year\'s introduction now runs from New Year\'s morning to Hogmanay', /from New Year's morning to Hogmanay/.test(ch.intro) && !/from Plough Monday to St Thomas's/.test(ch.intro), ch.intro);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
