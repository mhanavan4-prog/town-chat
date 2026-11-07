// Shrove Tuesday: the Pancake Bell, football, cock-throwing told as the cruelty
// it was, and children a-shrovin' (Hone, 1826; Taylor, 1620; Chambers, 1864),
// a caller dated by the Commonplace Book's own entry, which moves with
// Easter, first at the door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-shrove-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { SHROVE_RITES } = require('../data/shroveTuesday.js');
const { CALLERS } = require('../data/callers.js');
const { OLD_CALENDAR, entryDate } = require('../data/oldCalendar.js');
const { nextWindow } = require('../lib/callers.js');
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

const R = SHROVE_RITES.shroving;
check('a-shrovin\': badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the Pancake Bell: "Confession Tuesday", and the bell\'s London name (Gentleman\'s Magazine, 1790, in Hone)', /"means Confession Tuesday"/.test(R.lore) && /"obtains in and about London the name of Pancake-bell"/.test(R.lore) && /Hone, The Every-Day Book \(1826\), 15 February/.test(R.source));
check('…Taylor\'s Jack-a-Lent, in the 1630 spelling as Knowlson gives it', /"then there is a bell rung, cal'd the Pancake-bell, the sound whereof makes thousands of people distracted, and forgetful either of manners or humanitie"/.test(R.lore) && /Taylor, Jack-a-Lent \(1620\), in T\. S\. Knowlson/.test(R.source));
check('…football in Hone, and Ashbourne still played', /"was, and remains, a game on Shrove Tuesday, in various parts of England"/.test(R.lore) && /Ashbourne/.test(R.lore) && /1667/.test(R.lore));
check('…cock-throwing told as cruelty, and how it was put down, without claiming the 1835 Act named it', /cruel sport/.test(R.lore) && /"Battering with massive weapons a cock tied to a stake"/.test(R.lore) && /Leeds in 1783/.test(R.lore) && /"there is not a country gentleman now who would not discourage the shocking usage"/.test(R.lore) && !/1835/.test(R.lore));
check('…Lent crocking (Chambers), and Olney\'s 1445 as tradition only', /"Lent Crocking"/.test(R.lore) && /tradition says since 1445/.test(R.lore) && !/When Jack went to plough/.test(R.lore));
const c = CALLERS.find((x) => x.id === 'shrove_tuesday_shroving');
check('Will and Lizzie Dyer, dated by the old calendar\'s Shrove Tuesday (Easter less 47 days), for two days', c && c.when && c.when.calendar === 'shrove_tuesday' && c.when.days === 2 && c.steps[0].rite === 'shroving');
check('the practical half follows the fire brigade: never leave the pan, children back, don\'t move it, never water, heat off only if safe, get out, shut the door, send for help; and no throwing at animals', /Never leave the pan while the heat's on/.test(c.resolution) && /children and the dog back/.test(c.resolution) && /don't try to carry the pan out/.test(c.resolution) && /never throw water on it/.test(c.resolution) && /fireball/.test(c.resolution) && /only if you safely can/.test(c.resolution) && /shut the door behind you/.test(c.resolution) && /fire brigade/.test(c.resolution) && /nobody throws a thing at an animal/.test(c.resolution));

// The day moves with Easter.
const shrove = OLD_CALENDAR.find((e) => e.key === 'shrove_tuesday');
const days = [2027, 2028, 2029].map((y) => { const [m, d] = entryDate(shrove, y); return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; });
check('Shrove Tuesday falls on 9 February 2027, 29 February 2028 and 13 February 2029', JSON.stringify(days) === JSON.stringify(['2027-02-09', '2028-02-29', '2029-02-13']), days);
const w = nextWindow(c.when, Date.UTC(2028, 0, 1));
check('…and the caller\'s window moves with it', w.start === Date.UTC(2028, 1, 29) && w.end === Date.UTC(2028, 2, 2));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Shrover'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Shrover', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'shrover'; h.accounts.shrover = {}; h.playerProgress.shrover = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const on = [Date.UTC(2027, 1, 9, 12), Date.UTC(2027, 1, 10, 12), Date.UTC(2028, 1, 29, 12)].map(offered);
  const season = at(Date.UTC(2027, 1, 9, 12), () => h.calendarPublicState().season.key);
  check('on Shrove Tuesday they come first, a caller of the season after them', on.every((o) => o[0] === 'shrove_tuesday_shroving' && o.length === 3) && CALLERS.find((x) => x.id === on[0][1]).season === season, [season, on]);
  const outside = [Date.UTC(2027, 1, 8, 12), Date.UTC(2027, 1, 11, 12), Date.UTC(2028, 1, 9, 12)].map(offered);
  check('on other days they never come (not on 9 February 2028)', outside.every((o) => !o.includes('shrove_tuesday_shroving') && o.length === 3), outside);
  at(Date.UTC(2027, 1, 9, 12), () => {
    h.accounts.shrover.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.shrover, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'shroving');
  check('…and writes A-Shrovin\' into The Turning Year, after Going a-Gooding', e && e.met && /· Shrove Tuesday$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'shroving') === ch.entries.findIndex((x) => x.id === 'gooding') + 1);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
