// "Coming to the door": the dated callers (Martinmas, the wren boys, Plough
// Monday, St Agnes' Eve) come only on their own days, so the Charm Book's
// Where next says who is coming and when (lib/callers.js datedComing,
// lib/whereNext.js).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-coming-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { datedComing, nextWindow } = require('../lib/callers.js');
const { whereNext } = require('../lib/whereNext.js');
const { buildCharmBook } = require('../lib/charmBook.js');
const { CALLERS } = require('../data/callers.js');
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

const NOV7 = Date.UTC(2026, 10, 7, 18);
const c1 = datedComing(NOV7);
const ids = c1.map((x) => x.id);
const daysOf = (id) => (c1.find((x) => x.id === id) || {}).inDays;
check('on 7 November, first Martinmas in 2 days; the wren boys in 49, Plough Monday in 65, St Agnes\' Eve in 74; soonest first', c1[0].id === 'martinmas_cock' && c1[0].inDays === 2 && daysOf('wren_boys') === 49 && daysOf('plough_boys') === 65 && daysOf('st_agnes_eve') === 74 && c1.every((x, i) => !i || c1[i - 1].inDays <= x.inDays), c1.map((x) => [x.id, x.inDays]));
check('each with the name of its day', c1.find((x) => x.id === 'martinmas_cock').label === 'Martinmas week' && c1.find((x) => x.id === 'wren_boys').label === "St Stephen's Day" && c1.find((x) => x.id === 'plough_boys').label === 'Plough Monday' && c1.find((x) => x.id === 'st_agnes_eve').label === "St Agnes' Eve");
check('every dated caller is counted', CALLERS.filter((c) => c.when).every((c) => ids.includes(c.id) || datedComing(NOV7, 400).some((x) => x.id === c.id)));
const nov10 = datedComing(Date.UTC(2026, 10, 10, 12)).map((x) => x.id);
check('a caller whose day is here is at the door, not coming', !nov10.includes('martinmas_cock') && nov10[0] === ids[1], nov10);
const nov14 = datedComing(Date.UTC(2026, 10, 14, 12), 400);
check('once the window has closed it is next year\'s', nov14.find((x) => x.id === 'martinmas_cock').inDays === 360, nov14.find((x) => x.id === 'martinmas_cock'));
const w = nextWindow({ calendar: 'plough_monday', days: 2 }, Date.UTC(2027, 0, 12, 18));
check('a moving day\'s window is still open on its second day', w && w.start === Date.UTC(2027, 0, 11) && w.end === Date.UTC(2027, 0, 13));
// With a short horizon (the dated days are now close together all year): 1
// July has nothing within 5 days, so it gives just the next one.
const spring = datedComing(Date.UTC(2026, 6, 1, 12), 5);
check('nothing beyond the horizon, but when none is that near, still the next one', datedComing(NOV7).every((x) => x.inDays <= 120) && spring.length === 1 && spring[0].id === datedComing(Date.UTC(2026, 6, 1, 12), 400)[0].id && spring[0].inDays > 5, spring);

// Where next.
const book = buildCharmBook({ acct: {}, prog: {}, seasonKey: null });
const items = whereNext({ book, offeredIds: [], coming: c1, now: NOV7 });
const it = items.find((x) => x.key === 'coming');
const callerOf = (id) => CALLERS.find((c) => c.id === id);
const lineFor = (x) => `${callerOf(x.id).icon} ${x.label}: ${callerOf(x.id).caller}, in ${x.inDays} days.`;
check('Where next has "Coming to the door", the three soonest', it && it.title === 'Coming to the door' && it.lines.length === 4 && /^🐓 Martinmas week: Bridget Cullinan, in 2 days\.$/.test(it.lines[0]) && it.lines[1] === lineFor(c1[1]) && it.lines[2] === lineFor(c1[2]), it && it.lines);
check('…saying they come only on their own days', /They come only on their own days/.test(it.lines[3]));
const metBook = buildCharmBook({ acct: { ritesDone: ['martin_blood'], callers: { byId: { martinmas_cock: 1 } } }, prog: {}, seasonKey: null });
const it2 = whereNext({ book: metBook, offeredIds: [], coming: c1, now: NOV7 }).find((x) => x.key === 'coming');
check('…leaving out one that would write nothing new', it2 && !it2.lines.some((l) => /Bridget/.test(l)) && it2.lines[0] === lineFor(c1[1]), it2 && it2.lines);
check('…and nothing when there is nothing coming', !whereNext({ book, offeredIds: [], coming: [], now: NOV7 }).some((x) => x.key === 'coming'));
const tomorrow = whereNext({ book, offeredIds: [], coming: [{ id: 'wren_boys', label: "St Stephen's Day", inDays: 1 }], now: NOV7 }).find((x) => x.key === 'coming');
check('…"tomorrow" for one a day off', /, tomorrow\.$/.test(tomorrow.lines[0]));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const join = (tag, acct) => {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    if (acct) { p.accountKey = acct; h.accounts[acct] = {}; h.playerProgress[acct] = { level: 1, xp: 0 }; }
    s.emit('message', JSON.stringify({ type: 'charm_book_state' }));
    return s.lastOfType('charm_book_state');
  };
  const signed = join('Almanac', 'almanac');
  check('a signed-in book gets "Coming to the door" from the server', signed && signed.whereNext.some((x) => x.key === 'coming'));
  const guest = join('Passer');
  check('a guest, who can\'t take callers, doesn\'t', guest && !guest.whereNext.some((x) => x.key === 'coming'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
