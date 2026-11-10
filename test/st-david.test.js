// St David's Day (Henry V in the First Folio, 1623; Pepys, 1667; Porter, 1632,
// and Poor Robin, 1757, as Hone gives them; the Welsh Life of David, c. 1350):
// Gwen Pritchard comes on the Commonplace Book's own day (1 March, and the
// 2nd), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-david-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { DAVID_RITES } = require('../data/stDavid.js');
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

const R = DAVID_RITES.st_david;
check('the leek: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the First Folio\'s Fluellen and Gower on the leek', /"did good seruice in a Garden where Leekes did grow, wearing Leekes in their Monmouth caps, which your Maiesty know to this houre is an honourable badge of the seruice"/.test(R.lore) && /"an ancient Tradition began vppon an honourable respect, and worne as a memorable Trophee of predeceased valor"/.test(R.lore) && /First Folio \(1623\)/.test(R.source));
check('…Porter, 1632; the Saxon battle doubted by Hone', /"the greatest part of his solemnitie consisteth in wearing of a greene leeke"/.test(R.lore) && /"he lays no ground for this positive statement\."/.test(R.lore));
check('…Pepys in Mark Lane, 1667, and his "oddest sights"; Poor Robin\'s hanged Taff, not burnt', /"the picture of a man dressed like a Welchman, hanging by the neck upon one of the poles that stand out at the top of one of the merchants' houses"/.test(R.lore) && /"one of the oddest sights I have seen a good while"/.test(R.lore) && /"hang poor Taff… All stuffed with hay"/.test(R.lore) && !/burnt/.test(R.lore));
check('…the Welsh Life\'s little things, c. 1350; the daffodil as Lloyd George\'s, 1911', /"do the little things that you have seen me do and heard about"/.test(R.lore) && /"gwnewch y petheu bychain"/.test(R.lore) && /about 1350/.test(R.lore) && /used it in the ceremonies for the investiture of 1911/.test(R.lore) && !/Rhygyfarch/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'st_david');
check('the Commonplace Book\'s St David: Mark Lane and "oddest sights"; Pepys quoted, with Shakespeare and Hone', cal && cal.month === 3 && cal.day === 1 && /Mark Lane/.test(cal.text) && /oddest sights/.test(cal.text) && cal.quote === 'the picture of a man dressed like a Welchman, hanging by the neck' && /Henry V/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'st_david');
check('Gwen Pritchard, dated by it, for two days', c && c.when && c.when.calendar === 'st_david' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'st_david');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Gwen'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Gwen', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'gwen'; h.accounts.gwen = {}; h.playerProgress.gwen = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('st_david');
  const days = [Date.UTC(2027, 2, 1, 12), Date.UTC(2027, 2, 2, 12)].map(offered);
  check('on St David\'s Day and the 2nd she comes first', days.every(leads), days);
  const outside = [Date.UTC(2027, 1, 28, 12), Date.UTC(2027, 2, 3, 12), Date.UTC(2027, 8, 1, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('st_david') && o.length === 3), outside);
  at(Date.UTC(2027, 2, 1, 12), () => {
    h.accounts.gwen.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.gwen, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'st_david');
  check('…and writes the Leek into The Turning Year, dated 1 March', e && e.met && /· St David's Day$/.test(e.title) && e.date === '1 March' && ch.entries.findIndex((x) => x.id === 'st_david') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
