// Plough Monday: the ploughboys and the plough witches (Hone, 1826; Nottingham
// Guardian, 1886), a caller dated by the Commonplace Book's own calendar (the
// first Monday after Twelfth Day, which moves), first at the door, and the
// Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-plough-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { PLOUGH_RITES } = require('../data/ploughMonday.js');
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

const R = PLOUGH_RITES.plough_monday;
check('drawing the plough: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Hone\'s Plough Monday: the white shirts, the procession, Bessy and the Fool with his box', /"the first Monday after Twelfth-day"/.test(R.lore) && /"stripped to their clean white shirts"/.test(R.lore) && /"in procession to the doors of the villagers and townspeople"/.test(R.lore) && /"attired in skins, with a depending tail"/.test(R.lore) && /"carries a box to collect money"/.test(R.lore) && /Hone, The Every-Day Book \(1826\), 7 January/.test(R.source));
check('"plough witches", from the Nottingham Guardian of 1886, and the blacked faces', /"plough witches" \(Nottingham Guardian, 1886\)/.test(R.lore) && /Blacking the face was the commonest disguise/.test(R.lore) && /Nottingham Guardian \(13 January 1886\)/.test(R.source) && /Millington/.test(R.source));
check('the plough-light and the feast, and the Straw Bear revived in 1980', /"Plough-light"/.test(R.lore) && /"on Plough Monday they had a feast"/.test(R.lore) && /revived in 1980/.test(R.lore) && /Straw Bear/.test(R.source));
const pm = OLD_CALENDAR.find((e) => e.key === 'plough_monday');
const c = CALLERS.find((x) => x.id === 'plough_boys');
check('the ploughboys are dated by the old calendar\'s Plough Monday, for two days', pm && c && c.when && c.when.calendar === 'plough_monday' && c.when.days === 2);
check('…a loaf for the feast (Hone: "on Plough Monday they had a feast"), then the plough round the parish', c.steps[0].item === 'hearth_loaf' && c.steps[1].rite === 'plough_monday');
check('the practical half: ask, don\'t take; plough nobody\'s step; the poor box for the plough-light', /Ask, don't take/.test(c.resolution) && /plough nobody's step/.test(c.resolution) && /broken ankle/.test(c.resolution) && /poor box/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Plough'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Plough', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'plough'; h.accounts.plough = {}; h.playerProgress.plough = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  // First at the door, or second after another dated caller on a shared day (old Hogmanay).
  const { CALLERS: ALL } = require('../data/callers.js');
  const first = (y, m, d) => { const o = offered(Date.UTC(y, m - 1, d, 12)); const k = o.indexOf('plough_boys'); return k >= 0 && o.slice(0, k).every((id) => (ALL.find((c) => c.id === id) || {}).when); };
  // Twelfth Day 2027 is a Wednesday (Plough Monday the 11th); 2026 a Tuesday (the 12th);
  // 2025 itself a Monday, so Plough Monday is the week after (the 13th).
  check('they come first on Plough Monday and the day after: 11–12 January 2027', first(2027, 1, 11) && first(2027, 1, 12) && !first(2027, 1, 10) && !first(2027, 1, 13));
  check('…12 January 2026', first(2026, 1, 12) && !first(2026, 1, 11));
  check('…and 13 January 2025, when Twelfth Day was itself a Monday', first(2025, 1, 13) && !first(2025, 1, 6));
  const outside = [Date.UTC(2027, 6, 11, 12), Date.UTC(2027, 0, 20, 12)].map(offered);
  check('on other days they never come', outside.every((o) => !o.includes('plough_boys') && o.length === 3), outside);
  at(Date.UTC(2027, 0, 11, 12), () => {
    h.accounts.plough.callers.active = { id: c.id, done: { 0: 'loaf' } };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[1];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.plough, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'plough_monday');
  // Only fixed January days before 11 January (St Distaff's, the 7th) come before it.
  const ix = ch.entries.findIndex((x) => x.id === 'plough_monday');
  check('…and writes Drawing the Plough into The Turning Year, among the first of the dated days', e && e.met && /· Plough Monday$/.test(e.title) && ix >= 12 && ch.entries.slice(12, ix).every((x) => /^\d+ January$/.test(x.date || '') && parseInt(x.date, 10) < 11), ch.entries.slice(12, ix + 1).map((x) => [x.id, x.date]));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
