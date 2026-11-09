// Bartholomew Fair (Morley, 1859, read in the 1892 edition; Webb, 1921;
// Jonson, 1614; Pepys, 1668; Wordsworth, 1850): Nan Hobbs comes on the
// Commonplace Book's own day (24 August, and the 25th), with a practical half
// on pickpockets, reporting a theft, and a child lost in a crowd (City of
// London Police; the Met; Notting Hill Carnival; RBKC); and the Charm Book.
// The old calendar is put right on the end of the fair and the move to
// 3 September.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-bart-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { BARTHOLOMEW_RITES } = require('../data/bartholomewFair.js');
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

const R = BARTHOLOMEW_RITES.bartholomew_fair;
check('Bartholomew Fair: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the charter as Morley gives it: the firm peace, the feast, the three days; Webb\'s cloth trade and Cloth Fair', /"my firm peace to all persons coming to and returning from The Fair"/.test(R.lore) && /"at the Feast of St\. Bartholomew"/.test(R.lore) && /"on those three days, to wit, the eve of the feast, the feast itself, and the day following"/.test(R.lore) && /"the great annual market for the woollen and cloth trade of the country"/.test(R.lore) && /Cloth Fair/.test(R.lore) && /Webb/.test(R.source));
check('…Ursla\'s pigs, the cutpurse ballad and its partner; Pepys\'s mare and his pig; Wordsworth\'s din', /"who would weare out their youth, and prime thus, in roasting of pigges, that had any cooler vocation\?"/.test(R.lore) && /"Youth, youth, thou hadst better bin staru'd by thy Nurse, \/ Then liue to be hanged for cutting a purse"/.test(R.lore) && /his partner cuts the purses/.test(R.lore) && /"the mare that tells money"/.test(R.lore) && /"did eat a pig, and was pretty merry"/.test(R.lore) && /"anarchy and din, \/ Barbarian and infernal"/.test(R.lore) && /Pepys/.test(R.source) && /Wordsworth/.test(R.source));
check('…3 September from 1753; last proclaimed 1853, last held 1855', /opened on 3 September, from 1753/.test(R.lore) && /"Bartholomew Fair was proclaimed for the last time in the year 1855" \(Morley\)/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'bartholomew_fair');
check('the Commonplace Book\'s fair, put right: Henry I to Rahere, 3 September from 1753, 1855; the charter quoted', cal && cal.month === 8 && cal.day === 24 && /Henry I to Rahere's priory in 1133/.test(cal.text) && /From 1753 it opened on 3 September/.test(cal.text) && /it was proclaimed for the last time in 1855/.test(cal.text) && !/suppressed in 1855/.test(cal.text) && cal.quote === 'I grant also my firm peace to all persons coming to and returning from The Fair' && /Webb/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'bartholomew_fair');
check('Nan Hobbs, from Cow Lane, dated by it, for two days', c && /Cow Lane/.test(c.caller) && c.when && c.when.calendar === 'bartholomew_fair' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'bartholomew_fair');
check('the practical half: 999 if the thief is about, 101 or online, shout; the bank at once; valuables close, distraction, the zipped bag', /Then the practical half/.test(c.resolution) && /If the thief is still about, or anyone is in danger, ring 999; otherwise report it on 101 or online, and shout out to warn others/.test(c.resolution) && /ring your bank straight away/.test(c.resolution) && /Keep your wallet and valuables close/.test(c.resolution) && /a zipped bag doesn't mean you're totally safe/.test(c.resolution) && /City of London Police/.test(c.source));
check('…a meeting point, a photo of the children, a steward or a police officer', /agree a meeting point in case you're separated/.test(c.resolution) && /take a photo of the children as you leave home/.test(c.resolution) && /find a steward or a police officer at once/.test(c.resolution) && /Notting Hill Carnival/.test(c.source));

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
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('bartholomew_fair');
  const days = [Date.UTC(2027, 7, 24, 12), Date.UTC(2027, 7, 25, 12)].map(offered);
  check('on St Bartholomew\'s Day and the 25th she comes first', days.every(leads), days);
  const outside = [Date.UTC(2027, 7, 23, 12), Date.UTC(2027, 7, 26, 12), Date.UTC(2027, 8, 3, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('bartholomew_fair') && o.length === 3), outside);
  at(Date.UTC(2027, 7, 24, 12), () => {
    h.accounts.nan.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.nan, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'bartholomew_fair');
  check('…and writes the Bartholomew Fair into The Turning Year, dated 24 August', e && e.met && /· St Bartholomew's Day$/.test(e.title) && e.date === '24 August' && ch.entries.findIndex((x) => x.id === 'bartholomew_fair') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
