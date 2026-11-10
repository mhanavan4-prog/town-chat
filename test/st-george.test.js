// St George's Day (Chambers, 1864; Mackie's Norfolk Annals, 1901; the Norfolk
// Record Office and the Gild's ordinances): Ned Thurlow comes on the
// Commonplace Book's own day, 23 April only, so as not to stand in St Mark's
// Eve's way, with a practical half from the NHS, the HSE and RBKC; and the
// Charm Book. The old calendar is put right: Snap walked on Guild Day in June.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-george-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { GEORGE_RITES } = require('../data/stGeorge.js');
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

const R = GEORGE_RITES.st_george;
check('the George and the Dragon: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the Gild: 1385, the charter of 1417, its George, the riding from 1420, the dragon kept in 1552', /founded in Norwich in 1385, with a royal charter in 1417/.test(R.lore) && /"honour as holy St\. George's day"/.test(R.lore) && /"their George"/.test(R.lore) && /"a rider dressed as George fought a man in dragon garb"/.test(R.lore) && /"but for pastime, the Dragon to come and show himself in other years"/.test(R.lore));
check('…Chambers: Snap\'s June day, not this one, the whifflers, the mock Snap, the blue coats of 1614', /"annually went in procession with the mayor and corporation on the Tuesday preceding the eve of St\. John the Baptist"/.test(R.lore) && /his day was not this one/.test(R.lore) && /"Guarded by four whifflers, armed with drawn swords"/.test(R.lore) && /"have more than once attempted to get up a mock Snap"/.test(R.lore) && /"So late as 1614, it was the custom for fashionable gentlemen to wear blue coats on St\. George's day\."/.test(R.lore));
check('…the Norfolk Annals for 1811 and the last Guild Day, 16 June 1835; no Margaret, no pennies, the rose disowned', /"old Snap displayed his glittering wings and gilt tail, and cleared the way for the civic procession to the Cathedral"/.test(R.lore) && /16 June 1835 "Guild Day was celebrated in Norwich for the last time… 'Snap,' too, made his final appearance"/.test(R.lore) && !/Margaret|penny|pennies|1408|1731/.test(R.lore) && /The red rose is in neither Chambers nor Hone/.test(R.lore) && /Norfolk Annals/.test(R.source) && /Record Office/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'st_george');
check('the Commonplace Book\'s St George, put right: Snap on Guild Day in June, the blue coats quoted', cal && cal.month === 4 && cal.day === 23 && /Guild Day in June until 1835/.test(cal.text) && !/went out with the mayor every year/.test(cal.text) && /blue coats/.test(cal.quote) && /Norfolk Annals/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'st_george');
check('Ned Thurlow, dated by it, for one day', c && c.when && c.when.calendar === 'st_george' && c.when.days === 1 && c.steps.length === 1 && c.steps[0].rite === 'st_george');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Ned'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Ned', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'ned'; h.accounts.ned = {}; h.playerProgress.ned = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('st_george');
  const days = [Date.UTC(2027, 3, 23, 12), Date.UTC(2038, 3, 23, 12)].map(offered);
  check('on St George\'s Day he comes first (sharing with Good Friday in 2038)', days.every(leads), days);
  const outside = [Date.UTC(2027, 3, 22, 12), Date.UTC(2027, 3, 24, 12), Date.UTC(2027, 8, 1, 12)].map(offered);
  check('on other days he never comes, and on the 24th St Mark\'s Eve has the door', outside.every((o) => !o.includes('st_george') && o.length === 3) && outside[1][0] === 'st_marks_watch', outside);
  at(Date.UTC(2027, 3, 23, 12), () => {
    h.accounts.ned.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.ned, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'st_george');
  check('…and writes the George and the Dragon into The Turning Year, dated 23 April', e && e.met && /· St George's Day$/.test(e.title) && e.date === '23 April' && ch.entries.findIndex((x) => x.id === 'st_george') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
