// The Michaelmas goose (Gascoigne, 1573, read in the 1573 text; the
// Britannica, 1860; Poor Robin, 1695; The Mirror, 1832; Notes and Queries,
// 1853, on the Armada tale): Widow Pask comes on the Commonplace Book's own
// day (29 September, and the 30th), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-goose-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { GOOSE_RITES } = require('../data/michaelmasGoose.js');
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

const R = GOOSE_RITES.michaelmas_goose;
check('the Michaelmas goose: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Gascoigne, 1573, in his spelling: "at Mighelmasse a goose"', /"some fowle at Midsommer, & a dish of Fish in Lent, \/ At Christmasse a capon, at Mighelmasse a goose"/.test(R.lore) && /A Hundreth Sundrie Flowres \(1573\), p\. 368/.test(R.source) && !/Michaelmasse/.test(R.lore));
check('…the stubble geese (1860), Poor Robin (1695), and the money saying (1832)', /"stubble geese are in the highest perfection"/.test(R.lore) && /"Geese now in their prime season are, \/ Which, if well roasted, are good fare"/.test(R.lore) && /"if you eat goose on Michaelmas Day, you will never want money all the year round"/.test(R.lore) && /The Mirror of Literature, no\. 568/.test(R.source));
check('…the Armada tale shown false, with its reasons; no British Apollo', /cannot be true/.test(R.lore) && /fifteen years older/.test(R.lore) && /20 August 1588/.test(R.lore) && /"no foundation for the tradition"/.test(R.lore) && !/British Apollo/.test(R.lore));
check('…and Ireland\'s gale day and Harvest of the Geese', /gale day/.test(R.lore) && /"The Harvest of the Geese"/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'michaelmas_goose');
check('the Commonplace Book\'s Michaelmas now has Gascoigne behind it, badged record', cal && cal.month === 9 && cal.day === 29 && cal.tier === 'record' && cal.quote === 'At Christmasse a capon, at Mighelmasse a goose' && /Gascoigne/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'michaelmas_goose');
check('Widow Pask, dated by it, for two days', c && c.when && c.when.calendar === 'michaelmas_goose' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'michaelmas_goose');
check('the practical half: steaming hot, clear juices, no pink; no washing; thawed in the fridge; the hot fat and the burn; no fat down the sink', /steaming hot right through/.test(c.resolution) && /juices should run clear with no pink/.test(c.resolution) && /Don't wash the bird/.test(c.resolution) && /thaw it in the fridge, at least a day for every two kilos/.test(c.resolution) && /pierce the thickest part of the leg/.test(c.resolution) && /cool running water for twenty minutes/.test(c.resolution) && /never pour it down the sink/.test(c.resolution) && /Food Standards Agency/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Pask'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Pask', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'pask'; h.accounts.pask = {}; h.playerProgress.pask = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 8, 29, 12), Date.UTC(2027, 8, 30, 12)].map(offered);
  check('on Michaelmas and the 30th she comes first', days.every((o) => o[0] === 'michaelmas_goose' && o.length === 3), days);
  const outside = [Date.UTC(2027, 8, 28, 12), Date.UTC(2027, 9, 1, 12), Date.UTC(2027, 2, 29, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('michaelmas_goose') && o.length === 3), outside);
  at(Date.UTC(2027, 8, 29, 12), () => {
    h.accounts.pask.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.pask, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'michaelmas_goose');
  check('…and writes the Michaelmas Goose into The Turning Year, dated 29 September', e && e.met && /· Michaelmas$/.test(e.title) && e.date === '29 September' && ch.entries.findIndex((x) => x.id === 'michaelmas_goose') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
