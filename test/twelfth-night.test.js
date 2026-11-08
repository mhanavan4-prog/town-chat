// Twelfth Night: the Twelfth Cake, the bean king and the pea queen (Herrick,
// 1648; Fosbroke in Hone, 1826; Pepys, 1669; the Baddeley Cake), a caller
// dated by the Commonplace Book's own Bean King entry (6 January, and the
// 7th), first at the door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-twelfth-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { TWELFTH_RITES } = require('../data/twelfthNight.js');
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

const R = TWELFTH_RITES.twelfth_cake;
check('the bean king: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Herrick: the cake full of plums, the bean king, the pea queen, and lamb\'s wool', /"Now, now the mirth comes \/ With the cake full of plums, \/ Where bean's the king of the sport here"/.test(R.lore) && /"The pea also \/ Must revel, as queen"/.test(R.lore) && /"gentle lamb's wool"/.test(R.lore) && /Herrick, Hesperides \(1648\), ed\. A\. W\. Pollard \(1891\)/.test(R.source));
check('…Fosbroke in Hone, "so as to determine them by the slices"', /"the cake was full of plums, with a bean in it for the king, and a pea for the queen, so as to determine them by the slices\."/.test(R.lore) && /Hone, The Every-Day Book, vol\. I \(1826\), 6 January/.test(R.source));
check('…Pepys in 1669: titles from a hat, and he was the Queene', /"a new fashion, to prevent spoiling the cake"/.test(R.lore) && /"did put so many titles into a hat, and so drew cuts; and I was the Queene"/.test(R.lore) && /Pepys, Diary, 6 January 1668\/9/.test(R.source));
check('…Hone\'s London: the characters, and the boys nailing coat-tails', /"a pleasant verse beneath"/.test(R.lore) && /"dexterously nail the coat-tails of spectators, who venture near enough, to the bottoms of the window frames"/.test(R.lore));
check('…the Baddeley Cake, still cut at Drury Lane; and the greenery rule called modern', /Baddeley/.test(R.lore) && /"a twelfth Cake or Cakes and Wine and Punch"/.test(R.lore) && /Drury Lane Theatrical Fund/.test(R.source) && /Candlemas Eve/.test(R.lore) && /"a modern invention"/.test(R.lore));
const c = CALLERS.find((x) => x.id === 'twelfth_night_cake');
check('Mrs Fenn of the Bell, dated by the old calendar\'s Bean King, for two days', c && c.when && c.when.calendar === 'twelfth_night' && c.when.days === 2 && OLD_CALENDAR.some((e) => e.key === 'twelfth_night' && e.month === 1 && e.day === 6) && c.steps[0].rite === 'twelfth_cake');
check('the practical half: the bean can choke a child; tell before cutting; under fives get a hat instead (as Pepys did); no eating out of sight; Herrick\'s parting', /stop a child's throat/.test(c.resolution) && /Tell everyone there's a bean and a pea in it before you cut/.test(c.resolution) && /under five/.test(c.resolution) && /out of a hat/.test(c.resolution) && /"to prevent spoiling the cake"/.test(c.resolution) && /no child eats out of sight/.test(c.resolution) && /"As free from offence \/ As when ye innocent met here\."/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Fenn'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Fenn', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'fenn'; h.accounts.fenn = {}; h.playerProgress.fenn = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [6, 7].map((d) => offered(Date.UTC(2027, 0, d, 12)));
  check('on Twelfth Night she comes first, a Yule caller after her', days.every((o) => o[0] === 'twelfth_night_cake' && o.length === 3 && CALLERS.find((x) => x.id === o[1]).season === 'yule'), days);
  const outside = [Date.UTC(2027, 0, 5, 12), Date.UTC(2027, 0, 8, 12), Date.UTC(2027, 6, 6, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('twelfth_night_cake') && o.length === 3), outside);
  at(Date.UTC(2027, 0, 6, 12), () => {
    h.accounts.fenn.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.fenn, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'yule');
  const e = ch.entries.find((x) => x.id === 'twelfth_cake');
  check('…and writes The Bean King into Yuletide', e && e.met && /· Twelfth Night$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'twelfth_cake') >= 3 && /bean king crowned on Twelfth Night/.test(ch.intro));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
