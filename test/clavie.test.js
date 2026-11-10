// The Burning of the Clavie, Burghead, old Hogmanay (the Banffshire Journal,
// in Chambers, 1864, and Mitchell, 1875; the Duffus Kirk Session, 1666), a
// caller dated by the Commonplace Book's own entry (11 January, and the 12th),
// at the door with the ploughboys when Plough Monday falls the same day, and
// the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-clavie-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CLAVIE_RITES } = require('../data/clavie.js');
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

const R = CLAVIE_RITES.clavie;
check('burning the clavie: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('old Hogmanay, 11 January (VisitScotland)', /"known as 'old Hogmanay'"/.test(R.lore) && /11 January/.test(R.lore));
check('the Banffshire Journal: the half barrel, the smith\'s nail, no hammer, the peat', /"the tar-barrel is sawn into two unequal parts; the smaller forms the groundwork of the Clavie"/.test(R.lore) && /"a long nail, made for the purpose, and furnished gratuitously by the village black-smith"/.test(R.lore) && /no hammer may drive the nail/.test(R.lore) && /"no sulphurous lucifer, no patent congreve dare approach within the sacred precincts of the Clavie"/.test(R.lore) && /Chambers, The Book of Days \(1864\), 31 December/.test(R.source) && /Mitchell, Proceedings of the Society of Antiquaries of Scotland 10 \(1872–74\), pp\. 656–57/.test(R.source));
check('…the Doorie\'s pillar and the lucky firebrands', /"a freestone pillar, very much resembling an ancient altar"/.test(R.lore) && /"a sure safeguard against all unlucky contingencies"/.test(R.lore));
check('…the Duffus Kirk Session of 1666, in its own words; and no unplaced 1704 "idolatrous"', /"sex skippers"/.test(R.lore) && /"burning their clavies upon Satturday last before new yeires even"/.test(R.lore) && !/1704|idolatrous/i.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'clavie');
check('the Commonplace Book has its own Clavie, 11 January', cal && cal.month === 1 && cal.day === 11 && /Burghead/.test(cal.text));
const c = CALLERS.find((x) => x.id === 'clavie_burghead');
check('Kirsty Main, dated by it, for two days', c && c.when && c.when.calendar === 'clavie' && c.when.days === 2 && c.steps[0].rite === 'clavie');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Kirsty'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Kirsty', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'kirsty'; h.accounts.kirsty = {}; h.playerProgress.kirsty = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const shared = offered(Date.UTC(2027, 0, 11, 12));
  check('11 January 2027 is Plough Monday too: both come, before anyone else', shared.slice(0, 2).sort().join() === 'clavie_burghead,plough_boys' && shared.length === 3, shared);
  const alone = offered(Date.UTC(2029, 0, 11, 12));
  check('in 2029 (Plough Monday the 8th) she comes first on her own', alone[0] === 'clavie_burghead' && !alone.includes('plough_boys') && alone.length === 3, alone);
  const outside = [Date.UTC(2029, 0, 10, 12), Date.UTC(2029, 0, 13, 12), Date.UTC(2029, 6, 11, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('clavie_burghead') && o.length === 3), outside);
  at(Date.UTC(2029, 0, 11, 12), () => {
    h.accounts.kirsty.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.kirsty, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'clavie');
  check('…and writes Burning the Clavie into The Turning Year, dated 11 January', e && e.met && /· Old Hogmanay$/.test(e.title) && e.date === '11 January' && ch.entries.findIndex((x) => x.id === 'clavie') >= 12);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
