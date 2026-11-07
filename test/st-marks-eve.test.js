// St Mark's Eve: the church-porch watch (Hone, 1827; Morris, 1892; Chambers,
// 1864), a caller dated by the Commonplace Book's own entry (24 April, and the
// 25th), first at the door, and the Charm Book; the practical half is what a
// cold porch at midnight does to the eye, and what a name can do.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-stmark-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { MARK_RITES } = require('../data/stMarksEve.js');
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

const R = MARK_RITES.porch_watch;
check('the porch watch: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Hone\'s Yorkshire clergyman: the porch, eleven till one, thrice, the ghosts of the year\'s dead', /"sit and watch in the church porch"/.test(R.lore) && /"from eleven o'clock at night till one in the morning"/.test(R.lore) && /"for this must be done thrice"/.test(R.lore) && /"the ghosts of all those who … are to die the next year, pass by into the church\."/.test(R.lore) && /Hone, The Every-Day Book, vol\. II \(1827\), 25 April/.test(R.source));
check('…and the deaths from fear, in his words', /"Many are said to have actually died by their imaginary fears on the occasion\."/.test(R.lore));
check('Morris on the watcher who falls asleep; the Burton story of 1631; the ash-riddling (Chambers)', /fell asleep would die within the year himself \(Morris, Yorkshire Folk-Talk, 1892\)/.test(R.lore) && /1631/.test(R.lore) && /"exceedingly ill, by reason of the affrightment"/.test(R.lore) && /riddled the hearth ashes/.test(R.lore) && /Chambers, The Book of Days \(1864\), 25 April/.test(R.source));
check('Keats\'s poem called unfinished', /Keats began a poem on the eve in 1819 and never finished it/.test(R.lore));
const c = CALLERS.find((x) => x.id === 'st_marks_watch');
check('Sam Dawes, dated by the old calendar\'s St Mark\'s Eve, for two days', c && c.when && c.when.calendar === 'st_marks_eve' && c.when.days === 2 && OLD_CALENDAR.some((e) => e.key === 'st_marks_eve' && e.month === 4 && e.day === 24) && c.steps[0].rite === 'porch_watch');
check('the practical half: the eye in the dark, cold and half-sleep, fright; warm, a lantern, turns', /corners of your eyes see movement that isn't there/.test(c.resolution) && /dream with your eyes half open/.test(c.resolution) && /lantern/.test(c.resolution) && /take turns/.test(c.resolution));
check('…and never tell anyone they were among the dead', /never tell anyone they were among the dead/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Porch'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Porch', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'porch'; h.accounts.porch = {}; h.playerProgress.porch = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const first = (y, m, d) => offered(Date.UTC(y, m - 1, d, 12))[0] === 'st_marks_watch';
  check('he comes first on 24 and 25 April, and not the days either side', first(2027, 4, 24) && first(2027, 4, 25) && !first(2027, 4, 23) && !first(2027, 4, 26));
  const outside = [Date.UTC(2027, 9, 24, 12), Date.UTC(2027, 0, 24, 12)].map(offered);
  check('on other days he never comes', outside.every((o) => !o.includes('st_marks_watch') && o.length === 3), outside);
  at(Date.UTC(2027, 3, 24, 12), () => {
    h.accounts.porch.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.porch, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'porch_watch');
  check('…and writes the Porch Watch into The Turning Year, after Plough Monday', e && e.met && /· St Mark's Eve$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'porch_watch') === 14);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
