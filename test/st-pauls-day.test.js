// St Paul's Day weather (Willsford, Natures Secrets, 1658, p. 145; Hone,
// vol. I, quoting Bourne and Gay; Chambers, 1864, for the Latin): Ada Rowe
// comes on the Commonplace Book's own day (25 January, and the 26th), with a
// practical half on the cold and on hypothermia (UKHSA; NHS); and the Charm
// Book. The old calendar is put right: the rhyme is Willsford's.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-paul-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { PAUL_RITES } = require('../data/stPaulsDay.js');
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

const R = PAUL_RITES.st_pauls_day;
check('St Paul\'s Day: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Willsford, 1658: the prose and his "old Wives"; the whole eight lines, "Skie" and "that Kingdome" and all', /"observe the 25: day of January, celebrated for the conversion of St\. Paul; if fair and clear, plenty; if cloudy or misty, much cattle will die; if rain or snow fall that day, it presages a dearth; and if windy, wars, as old Wives do dream"/.test(R.lore) && /"If Saint Paul's day be fair and clear, \/ It does betide a happy year: \/ But if it chance to snow or rain \/ Then will be dear all kind of grain: \/ If clouds or mists do dark the Skie, \/ Great store of birds and beasts shall die: \/ And if the winds do fly aloft, \/ Then wars shall vex that Kingdome oft\."/.test(R.lore) && /Willsford, Natures Secrets \(1658\), p\. 145/.test(R.source));
check('…Chambers\'s monkish Latin, "tempora" read right; Bourne\'s "standing almanac"; Gay\'s "vulgar tales"', /"four monkish Latin verses, which are found very frequently in the manuscripts of the middle ages"/.test(R.lore) && /"Clara dies Pauli bona tempora denotat anni"/.test(R.lore) && /"why this day should therefore be a standing almanac to the world, rather than the day of any other saint"/.test(R.lore) && /"Let no such vulgar tales debase thy mind, \/ Nor Paul nor Swithin rule the clouds and wind\."/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'st_pauls_day');
check('the Commonplace Book\'s St Paul, put right: birds and beasts, Willsford\'s old Wives; the rhyme cited to Willsford', cal && cal.month === 1 && cal.day === 25 && /mist for dying birds and beasts/.test(cal.text) && /'old Wives do dream'/.test(cal.text) && cal.quote === "If Saint Paul's day be fair and clear, / It does betide a happy year" && /^T\. Willsford, Natures Secrets \(1658\)/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'st_pauls_day');
check('Ada Rowe, from the end cottage, dated by it, for two days', c && /end cottage/.test(c.caller) && c.when && c.when.calendar === 'st_pauls_day' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'st_pauls_day');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Ada'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Ada', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'ada'; h.accounts.ada = {}; h.playerProgress.ada = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('st_pauls_day');
  const days = [Date.UTC(2027, 0, 25, 12), Date.UTC(2027, 0, 26, 12)].map(offered);
  check('on St Paul\'s Day and the 26th she comes first', days.every(leads), days);
  const outside = [Date.UTC(2027, 0, 24, 12), Date.UTC(2027, 0, 27, 12), Date.UTC(2027, 6, 15, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('st_pauls_day') && o.length === 3), outside);
  at(Date.UTC(2027, 0, 25, 12), () => {
    h.accounts.ada.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.ada, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'st_pauls_day');
  check('…and writes the St Paul\'s Day into The Turning Year, dated 25 January', e && e.met && /· 25 January$/.test(e.title) && e.date === '25 January' && ch.entries.findIndex((x) => x.id === 'st_pauls_day') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
