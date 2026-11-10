// The Abbots Bromley Horn Dance (Plot, 1686, read in the 1686 text; the
// parish on the date; Gandy on the round; Buckland on the antler's date):
// Arthur Bentley comes on Wakes Monday as the Commonplace Book reckons it
// (between 6 and 12 September), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-horns-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { HORN_RITES } = require('../data/hornDance.js');
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

const R = HORN_RITES.horn_dance;
check('the Horn Dance: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Plot, 1686: "within memory", at Christmas, the Hobby-horse dance', /"Abbots, or now rather Pagets Bromley, they had also within memory"/.test(R.lore) && /"on New-year, and Twelft-day"/.test(R.lore) && /"call'd the Hobby-horse dance"/.test(R.lore) && /ch\. X, §66, p\. 434/.test(R.source));
check('…the snapping bow, six reindeer heads white and red, the Hays; the pot for church and poor', /"made a snapping noise as he drew it to and fro, keeping time with the Musick"/.test(R.lore) && /"6 others, carrying on their shoulders as many Rain deers heads, 3 of them painted white, and 3 red"/.test(R.lore) && /"danced the Hays, and other Country dances"/.test(R.lore) && /"they not only repaired their Church but kept their poore too"/.test(R.lore));
check('…a Christmas dance and lapsed then; Wakes Monday now, ten miles; the antler 1065 ± 80; no pagan evidence', /a Christmas dance, and already lapsed/.test(R.lore) && /"around 10 miles"/.test(R.lore) && /1065, give or take eighty years/.test(R.lore) && /Scandinavia/.test(R.lore) && /"there is no concrete evidence"/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'horn_dance');
const ds = [2026, 2027, 2028, 2033].map((y) => entryDate(cal, y).join('/'));
check('the Commonplace Book\'s Horn Dance: Plot\'s Christmas dance "within memory"; Wakes Monday between 6 and 12 September', cal && /a Christmas hobby-horse dance, already only "within memory"/.test(cal.text) && cal.moves === 'Wakes Monday, early in September' && ds.join() === '9/7,9/6,9/11,9/12', ds);
const c = CALLERS.find((x) => x.id === 'horn_dance');
check('Arthur Bentley, dated by it, for two days', c && c.when && c.when.calendar === 'horn_dance' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'horn_dance');
check('the practical half: boots and socks; don\'t burst a blister; keep left in procession, look-outs in bright or reflective clothes; the load close, no twisting, no more than you can manage', /comfortable boots that fit/.test(c.resolution) && /don't burst it/.test(c.resolution) && /soft plaster/.test(c.resolution) && /keeps to the left/.test(c.resolution) && /front and back/.test(c.resolution) && /in bright clothes by day and reflective ones in the dark/.test(c.resolution) && /keep the load close in/.test(c.resolution) && /don't twist/.test(c.resolution) && /no more than you can easily manage/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Arthur'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Arthur', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'arthur'; h.accounts.arthur = {}; h.playerProgress.arthur = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 8, 6, 12), Date.UTC(2027, 8, 7, 12), Date.UTC(2028, 8, 11, 12)].map(offered);
  check('on Wakes Monday (6 September 2027, 11 September 2028) and the day after he comes first', days.every((o) => o[0] === 'horn_dance' && o.length === 3), days);
  const outside = [Date.UTC(2027, 8, 5, 12), Date.UTC(2027, 8, 8, 12), Date.UTC(2028, 8, 4, 12), Date.UTC(2027, 0, 6, 12)].map(offered);
  check('on other days, Twelfth Day among them, he never comes', outside.every((o) => !o.includes('horn_dance') && o.length === 3), outside);
  at(Date.UTC(2027, 8, 6, 12), () => {
    h.accounts.arthur.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.arthur, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'horn_dance');
  check('…and writes the Horn Dance into The Turning Year, dated Wakes Monday', e && e.met && /· Abbots Bromley$/.test(e.title) && e.date === 'Wakes Monday, early in September' && ch.entries.findIndex((x) => x.id === 'horn_dance') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
