// Rogationtide: beating the bounds (the Injunctions of 1559; Herbert, 1652;
// Hone, 1826; Chambers, 1864), a caller dated by the Commonplace Book's own
// entry, which moves with Easter, first at the door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-rogation-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { ROGATION_RITES } = require('../data/rogation.js');
const { CALLERS } = require('../data/callers.js');
const { OLD_CALENDAR, entryDate } = require('../data/oldCalendar.js');
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

const R = ROGATION_RITES.beat_bounds;
check('beating the bounds: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the Injunctions of 1559: kept "once in the year", and the curse, with its comma', /"once in the year at the time accustomed"/.test(R.lore) && /"Cursed be he, which translateth the bounds and doles of his neighbour\."/.test(R.lore) && /Injunctions of 1559, XVIII–XIX/.test(R.source));
check('…Herbert\'s "4 manifest advantages", in his words', /"4 manifest advantages"/.test(R.lore) && /"justice in the Preservation of bounds"/.test(R.lore) && /"Charity in loving walking, and neighbourly accompanying one another, with reconciling of differences at that time, if there be any"/.test(R.lore) && /Herbert, A Priest to the Temple \(1652\), ch\. XXXV/.test(R.source));
check('…Hone\'s peeled willow wands, and Chambers\'s bumping and the river', /"to the different parish boundaries; which boundaries the boys strike with peeled willow wands that they bear in their hands, and this is called 'beating the bounds'"/.test(R.lore) && /"'bumped'"/.test(R.lore) && /"boys were thrown into it at customary places"/.test(R.lore) && /Chambers, The Book of Days \(1864\), 2 May/.test(R.source));
check('…the Tower and Oxford still at it; and no unread Turnworth or Dee', /Tower of London/.test(R.lore) && /North Gate/.test(R.lore) && !/Turnworth|Dee\b/.test(R.lore + R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'beating_bounds');
check('the Commonplace Book\'s own entry now cites Hone and Chambers, not the unread registers', cal && /Hone/.test(cal.source) && /Chambers/.test(cal.source) && !/Turnworth|Dee/.test(cal.source) && !/birch/.test(cal.text));
const c = CALLERS.find((x) => x.id === 'rogation_bounds');
check('Thomas Ridley, the parish clerk, dated by the old calendar\'s Rogationtide, for two days', c && c.when && c.when.calendar === 'beating_bounds' && c.when.days === 2 && c.steps[0].rite === 'beat_bounds');
const days = [2027, 2028].map((y) => { const [m, d] = entryDate(cal, y); return `${y}-${m}-${d}`; });
check('…Rogation Monday: 3 May 2027 and 22 May 2028', JSON.stringify(days) === JSON.stringify(['2027-5-3', '2028-5-22']), days);
check('the practical half: write it down; the definitive map; the 2031 cut-off, promised repeal; general boundaries; the Registry won\'t settle it', /write it down/.test(c.resolution) && /definitive map/.test(c.resolution) && /1 January 2031/.test(c.resolution) && /said it will repeal/.test(c.resolution) && /general line of a boundary/.test(c.resolution) && /won't settle a quarrel/.test(c.resolution) && /put what you agree in writing/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Clerk'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Clerk', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'clerk'; h.accounts.clerk = {}; h.playerProgress.clerk = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const on = [Date.UTC(2027, 4, 3, 12), Date.UTC(2027, 4, 4, 12), Date.UTC(2028, 4, 22, 12)].map(offered);
  const season = at(Date.UTC(2027, 4, 3, 12), () => h.calendarPublicState().season.key);
  check('in Rogation week he comes first, a caller of the season after him', on.every((o) => o[0] === 'rogation_bounds' && o.length === 3) && CALLERS.find((x) => x.id === on[0][1]).season === season, [season, on]);
  const outside = [Date.UTC(2027, 4, 2, 12), Date.UTC(2027, 4, 5, 12), Date.UTC(2028, 4, 3, 12)].map(offered);
  check('on other days he never comes (not on 3 May 2028)', outside.every((o) => !o.includes('rogation_bounds') && o.length === 3), outside);
  at(Date.UTC(2027, 4, 3, 12), () => {
    h.accounts.clerk.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.clerk, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'beat_bounds');
  check('…and writes Beating the Bounds into The Turning Year', e && e.met && /· Rogationtide$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'beat_bounds') >= 12);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
