// Mothering Sunday, Mid-Lent Sunday: servants home to their mothers with a
// simnel (Hone, 1826; Herrick, 1648; Symonds, 1644; Chambers), a caller dated
// by the Commonplace Book's own entry, which moves with Easter, first at the
// door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-mothering-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { MOTHERING_RITES } = require('../data/mothering.js');
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

const R = MOTHERING_RITES.simnel;
check('going a-mothering: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Hone (1826): servants and apprentices, furmity and a blessing, and the mother church', /"It is still a custom on Mid-Lent Sunday in many parts of England, for servants and apprentices to carry cakes or some nice eatables or trinkets, as presents to their parents"/.test(R.lore) && /"to visit their mother for a meal of furmity, or to receive cakes from her with her blessing\. This is called going a mothering\."/.test(R.lore) && /"going to the mother-church on Mid-Lent Sunday, to make offerings at the high altar"/.test(R.lore) && /Hone, The Every-Day Book, vol\. I \(1826\), 13 March/.test(R.source));
check('…Herrick\'s Ceremonie in Glocester, in the 1648 spelling', /"I'Le to thee a Simnell bring, \/ 'Gainst thou go'st a mothering"/.test(R.lore) && /Ceremonie in Glocester/.test(R.lore) && /Herrick, Hesperides \(1648\), p\. 278/.test(R.source));
check('…Symonds at Worcester in 1644, the boiled-then-baked simnels, and Simon and Nell as an 1838 tale', /1644/.test(R.lore) && /"They call it the Mothering-day\."/.test(R.lore) && /"tied up in a cloth, and boiled for several hours, after which they are brushed over with egg, and then baked"/.test(R.lore) && /first printed in 1838/.test(R.lore));
check('…Constance Penswick Smith from 1913; and no violets', /Penswick Smith/.test(R.lore) && /1913/.test(R.lore) && !/violet/i.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'mothering_sunday');
const c = CALLERS.find((x) => x.id === 'mothering_sunday_simnel');
check('Nan Elcock, dated by the old calendar\'s Mothering Sunday (Easter less 21 days), for two days', c && c.when && c.when.calendar === 'mothering_sunday' && c.when.days === 2 && cal && c.steps[0].rite === 'simnel');
const days = [2027, 2028].map((y) => { const [m, d] = entryDate(cal, y); return `${y}-${m}-${d}`; });
check('…which falls on 7 March 2027 and 26 March 2028', JSON.stringify(days) === JSON.stringify(['2027-3-7', '2028-3-26']), days);
check('the practical half: a servant\'s scarce day off (no unsourced hours); and the day is hard for some, so take nothing for granted; Cruse', /A servant's day off was a rare thing/.test(c.resolution) && !/sixteen hours/.test(c.resolution) && /0808 808 1677/.test(c.resolution) && /let them have their days/.test(c.resolution) && /whose mother has died/.test(c.resolution) && /mothers whose children have died/.test(c.resolution) && /never easy with theirs/.test(c.resolution) && /no shame/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Nan'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Nan', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'nan'; h.accounts.nan = {}; h.playerProgress.nan = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const on = [Date.UTC(2027, 2, 7, 12), Date.UTC(2027, 2, 8, 12), Date.UTC(2028, 2, 26, 12)].map(offered);
  const season = at(Date.UTC(2027, 2, 7, 12), () => h.calendarPublicState().season.key);
  // On some Mothering Sundays another dated caller comes too (Lady Day, data/ladyDay.js): the dated callers first.
  const datedN = (o) => o.filter((id) => !!(CALLERS.find((x) => x.id === id) || {}).when).length;
  check('on Mothering Sunday she comes first (with any other caller of the day), a caller of the season after her', on.every((o) => o.length === 3 && o.slice(0, datedN(o)).includes('mothering_sunday_simnel')) && CALLERS.find((x) => x.id === on[0][datedN(on[0])]).season === season, [season, on]);
  const outside = [Date.UTC(2027, 2, 6, 12), Date.UTC(2027, 2, 9, 12), Date.UTC(2028, 2, 7, 12)].map(offered);
  check('on other days she never comes (not on 7 March 2028)', outside.every((o) => !o.includes('mothering_sunday_simnel') && o.length === 3), outside);
  at(Date.UTC(2027, 2, 7, 12), () => {
    h.accounts.nan.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.nan, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'simnel');
  check('…and writes Going a-Mothering into The Turning Year', e && e.met && /· Mothering Sunday$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'simnel') >= 12);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
