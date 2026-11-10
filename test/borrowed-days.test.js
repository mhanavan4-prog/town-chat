// The Borrowing Days (the Complaynt of Scotland, 1549; Scott, 1818; Brewer,
// 1895): Jean Elliot comes in the last three days of March, the Commonplace
// Book's own days (29–31 March), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-borrowed-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { BORROWED_RITES } = require('../data/borrowedDays.js');
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

const R = BORROWED_RITES.borrowed_days;
check('the Borrowing Days: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the Complaynt, 1549: "of marche"; Scott\'s reason, 1818', /"The borial blastis of the thre borouing dais of marche\."/.test(R.lore) && /"as they are remarked to be unusually stormy, it is feigned that March had borrowed them from April, to extend the sphere of his rougher sway\."/.test(R.lore) && !/dais of Aprile/.test(R.lore));
check('…Brewer\'s rhyme whole, and the hoggs come hirpling hame alive', /"March said to Aperill, I see 3 hoggs upon a hill;/.test(R.lore) && /The first o' them wus wind and weet, The second o' them wus snaw and sleet,/.test(R.lore) && /It froze the birds' nebs to the trees\./.test(R.lore) && /The 3 silly hoggs came hirpling hame\."/.test(R.lore) && /So the sheep lived/.test(R.lore) && /"Borrowed days of March"/.test(R.source));
check('…old style, Ramsay 1728; the Irish brindled cow; the Met Office on March snow', /old style/.test(R.lore) && /"Upon a Borrowing-day"/.test(R.lore) && /Laethanta na Bó Riabhaí/.test(R.lore) && /"marginally more likely"/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'borrowed_days');
check('the Commonplace Book\'s Borrowed Days: the hoggs come home; the Complaynt and Brewer\'s right entry', cal && cal.month === 3 && cal.day === 29 && /the hoggs came limping home/.test(cal.text) && /Complaynt of Scotland \(1549\)/.test(cal.source) && /"Borrowed days of March"/.test(cal.source) && cal.quote === "The first o' them wus wind and weet");
const c = CALLERS.find((x) => x.id === 'borrowed_days');
check('Jean Elliot, dated by it, for all three days', c && c.when && c.when.calendar === 'borrowed_days' && c.when.days === 3 && c.steps.length === 1 && c.steps[0].rite === 'borrowed_days');
check('the practical half: shelter; 39 to 40, under 37; dry, glucose before warming for a weak lamb (the vet shows you), then a box at 37; colostrum 50 and 200 per kilo; layers, 18 degrees, older and frail neighbours', /give them shelter/.test(c.resolution) && /39 to 40 degrees; under 37/.test(c.resolution) && /Dry it first\. A lamb more than five hours old that is under 37 degrees and can't hold its head up needs a glucose injection before it is warmed/.test(c.resolution) && /Then warm it in a box kept at 37 degrees/.test(c.resolution) && /50 millilitres for every kilo/.test(c.resolution) && /200 millilitres a kilo by the time it's a day old/.test(c.resolution) && /for a vet to show you/.test(c.resolution) && /18 degrees/.test(c.resolution) && /look in on older and frail neighbours/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Jean'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Jean', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'jean'; h.accounts.jean = {}; h.playerProgress.jean = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('borrowed_days');
  // 2028: Easter is 16 April, so 29–31 March are clear of Good Friday; Carling Sunday is 2 April.
  const days = [29, 30, 31].map((d) => offered(Date.UTC(2028, 2, d, 12)));
  check('on each of the three days she comes first', days.every(leads), days);
  const outside = [Date.UTC(2028, 2, 28, 12), Date.UTC(2028, 3, 1, 12), Date.UTC(2028, 8, 29, 12)].map(offered);
  check('on other days, the first of April among them, she never comes', outside.every((o) => !o.includes('borrowed_days') && o.length === 3), outside);
  at(Date.UTC(2028, 2, 30, 12), () => {
    h.accounts.jean.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.jean, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'borrowed_days');
  check('…and writes the Borrowing Days into The Turning Year, dated 29 March', e && e.met && /· 29–31 March$/.test(e.title) && e.date === '29 March' && ch.entries.findIndex((x) => x.id === 'borrowed_days') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
