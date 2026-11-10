// Puck Fair (the patent of 1613, as quoted; Lewis's Topographical Dictionary,
// 1837; the press on the goat since 2022): Nora Foley, the Queen of Puck,
// comes at the Gathering, the Commonplace Book's own day (10 August, and the
// 11th), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-puck-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { PUCK_RITES } = require('../data/puckFair.js');
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

const R = PUCK_RITES.puck_fair;
check('King Puck: badged folk, three signs that fit the Board', R && R.tier === 'folk' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the patent of 1613 as quoted, a Lammas fair; the goat first in Lewis, 1837', /patent of 1613 to Jenkin Conway the younger/.test(R.lore) && /"fair on Lammas day and 2 days after"/.test(R.lore) && /"the former is called Puck Fair, at which unbroken Kerry ponies, goats, &c\., are sold, and a male goat is sometimes ornamented and paraded about the fair\."/.test(R.lore) && /Topographical Dictionary of Ireland \(1837\)/.test(R.source));
check('…the crowning reported from the 1840s; Cromwell and O\'Connell told late; Lughnasa a theory', /1840s/.test(R.lore) && /told late/.test(R.lore) && /Cromwell/.test(R.lore) && /1808/.test(R.lore) && /a theory, not a record/.test(R.lore));
check('…the Gathering, the fair day, the Scattering; the Queen of Puck; on the stand only briefly since 2023, a vet watching', /the Gathering, the fair day and the Scattering/.test(R.lore) && /Queen of Puck/.test(R.lore) && /Since 2023/.test(R.lore) && /a vet/.test(R.lore) && !/Puck's Fair Day/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'puck_fair');
check('the Commonplace Book\'s Puck Fair: no longer three days on the stand; 1613 and 1837; Lewis quoted', cal && cal.month === 8 && cal.day === 10 && /since 2023 only for a while at either end/.test(cal.text) && !/set over the town for a three-day fair/.test(cal.text) && cal.quote === 'a male goat is sometimes ornamented and paraded about the fair' && /Lewis/.test(cal.source) && cal.tier === 'folk');
const c = CALLERS.find((x) => x.id === 'puck_fair');
check('Nora Foley, the Queen of Puck, dated by it, for two days', c && c.when && c.when.calendar === 'puck_fair' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'puck_fair');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Nora'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Nora', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'nora'; h.accounts.nora = {}; h.playerProgress.nora = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 7, 10, 12), Date.UTC(2027, 7, 11, 12)].map(offered);
  check('at the Gathering and on the fair day she comes first', days.every((o) => o[0] === 'puck_fair' && o.length === 3), days);
  const outside = [Date.UTC(2027, 7, 9, 12), Date.UTC(2027, 7, 12, 12), Date.UTC(2027, 7, 1, 12)].map(offered);
  check('on other days, Lammas itself among them, she never comes', outside.every((o) => !o.includes('puck_fair') && o.length === 3), outside);
  at(Date.UTC(2027, 7, 10, 12), () => {
    h.accounts.nora.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.nora, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'puck_fair');
  check('…and writes King Puck into The Turning Year, dated 10 August', e && e.met && /· Puck Fair$/.test(e.title) && e.date === '10 August' && ch.entries.findIndex((x) => x.id === 'puck_fair') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
