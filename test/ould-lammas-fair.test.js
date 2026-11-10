// The Ould Lammas Fair, Ballycastle (O'Laverty, 1887; the Ordnance Survey
// Memoir, 1831; Lewis, 1837; the Coleraine Chronicle as Boyd collects it):
// Dan McCurdy comes on the Commonplace Book's own day, the last Tuesday in
// August, and the day after, with a practical half on buying a pony (DAERA;
// the British Horse Society; World Horse Welfare); and the Charm Book. The old
// calendar is put right: the 1606 charter was for a Tuesday market.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-lammas-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { LAMMAS_FAIR_RITES } = require('../data/ouldLammasFair.js');
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

const R = LAMMAS_FAIR_RITES.ould_lammas_fair;
check('the Ould Lammas Fair: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the charter as O\'Laverty gives it, a Tuesday market; the six fairs of 1831; Lewis\'s ponies and pedlery', /"obtained by charter the right of holding a Tuesday's market at 'Dunanynie'"/.test(R.lore) && /nobody has printed the charter itself/.test(R.lore) && /"six annual fairs"/.test(R.lore) && /"last Tuesday in May, July, August, October and November"/.test(R.lore) && /"Raghery ponies, horses, cattle, sheep, pigs, linen yarn, and pedlery"/.test(R.lore) && /O'Laverty/.test(R.source) && /Lewis/.test(R.source));
check('…the Donnybrook of the North, the shelties and Rathlin sheep; dulse and yellowman; MacAuley\'s song, by 1925, its words not given', /"This Donnybrook of the North"/.test(R.lore) && /"a large number of small 'shelties', a vast number of sheep from Rathlin and a pretty good show of black cattle"/.test(R.lore) && /"dried and eaten uncooked, by the maritime Irish and Scots"/.test(R.lore) && /"a traditional Ulster honeycomb"/.test(R.lore) && /John Henry MacAuley/.test(R.lore) && /by 1925/.test(R.lore) && !/Mary Ann/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'ould_lammas_fair');
check('the Commonplace Book\'s fair, put right: a Tuesday market in 1606, the fair\'s day found in 1831, over four hundred years; record, and it moves', cal && /A Tuesday market chartered to Sir Randal MacDonnell in 1606/.test(cal.text) && /by 1831 the fair fell on the last Tuesday in August/.test(cal.text) && /Over four hundred years/.test(cal.text) && !/nearly four hundred/.test(cal.text) && cal.quote === 'last Tuesday in May, July, August, October and November' && cal.moves === 'the last Tuesday in August' && cal.tier === 'record' && /Ordnance Survey Memoir/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'ould_lammas_fair');
check('Dan McCurdy, from Rathlin, dated by it, for two days', c && /Rathlin/.test(c.caller) && c.when && c.when.calendar === 'ould_lammas_fair' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'ould_lammas_fair');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Dan'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Dan', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'dan'; h.accounts.dan = {}; h.playerProgress.dan = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('ould_lammas_fair');
  const days = [Date.UTC(2027, 7, 31, 12), Date.UTC(2027, 8, 1, 12), Date.UTC(2037, 7, 25, 12)].map(offered);
  check('on the last Tuesday in August and the day after he comes first (sharing with Bartholomew Fair when it falls on the 25th)', days.every(leads), days);
  const outside = [Date.UTC(2027, 7, 30, 12), Date.UTC(2027, 8, 2, 12), Date.UTC(2027, 7, 24, 12)].map(offered);
  check('on other days he never comes', outside.every((o) => !o.includes('ould_lammas_fair') && o.length === 3), outside);
  at(Date.UTC(2027, 7, 31, 12), () => {
    h.accounts.dan.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.dan, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'ould_lammas_fair');
  check('…and writes the Ould Lammas Fair into The Turning Year, dated as it moves', e && e.met && /· Ballycastle$/.test(e.title) && e.date === 'the last Tuesday in August' && ch.entries.findIndex((x) => x.id === 'ould_lammas_fair') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
