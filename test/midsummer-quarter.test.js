// Midsummer quarter day (Hone's Every-Day Book, 1825, "Quarter-day";
// Gascoigne as Chambers gives him; Britannica, 1911; Stow, 1603): Sarah Pound
// comes on the Commonplace Book's own day, 24 June, for the one day, with a
// practical half on rent arrears and eviction in England after the Renters'
// Rights Act 2025 (Citizens Advice; Shelter; GOV.UK; the Protection from
// Eviction Act 1977); and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-quarter-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { QUARTER_RITES } = require('../data/midsummerQuarter.js');
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

const R = QUARTER_RITES.midsummer_quarter;
check('Quarter Day: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Britannica\'s quarter days; Gascoigne\'s fowl at Midsummer; Hone\'s quarter-day, "all must pay—that can!", and his plea to the landlord', /"the days on which it is usually contracted that rents should be paid, and houses or lands entered upon or quitted"/.test(R.lore) && /"bring some fowl at Midsummer, a dish of fish in Lent, \/ At Christmas a capon, at Michaelmas a goose"/.test(R.lore) && /"This is quarter-day!—what a variety of thought and feeling it calls up in the minds of thousands in this great metropolis"/.test(R.lore) && /"some may quit, some may remain; all must pay—that can! Alas, that there should be some unable!"/.test(R.lore) && /"Landlord! ponder o\[n\] these consequences ere you distrain for rent, and let your heart, rather than the law, be the guide of your conduct\."/.test(R.lore) && /Quarter-day/.test(R.source));
check('…Stow\'s bonfires the night before; no accounts settled', /"aswell of good amitie amongest neighbours" as "to purge the infection of the ayre"/.test(R.lore) && !/accounts were settled/.test(R.lore) && /Stow/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'midsummer_quarter');
check('the Commonplace Book\'s quarter day, put right: rent due and houses entered or quitted, no accounts; Hone quoted; Britannica cited', cal && cal.month === 6 && cal.day === 24 && /the quarter's rent fell due and houses were entered or quitted/.test(cal.text) && !/accounts were settled/.test(cal.text) && cal.quote === 'all must pay—that can! Alas, that there should be some unable!' && /Britannica/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'midsummer_quarter');
check('Sarah Pound, from Mint Street, dated by it, for the one day', c && /Mint Street/.test(c.caller) && c.when && c.when.calendar === 'midsummer_quarter' && c.when.days === 1 && c.steps.length === 1 && c.steps[0].rite === 'midsummer_quarter');
check('the practical half: the landlord early, a plan you can afford; Universal Credit or Housing Benefit, a council Housing Payment; Breathing Space, 60 days', /Then the practical half/.test(c.resolution) && /Speak to your landlord as soon as you can, and offer a plan to clear the arrears that you can truly afford/.test(c.resolution) && /Universal Credit or Housing Benefit, and ask the council for a Housing Payment, which you don't pay back/.test(c.resolution) && /Breathing Space: 60 days in which the arrears can't be chased or charged, though the rent itself must still be paid/.test(c.resolution) && /Citizens Advice/.test(c.source));
check('…since 1 May 2026 no eviction without a reason, a court order and bailiffs; three months\' arrears, four weeks\' notice; illegal eviction a crime; Shelter\'s line', /Since 1 May 2026 a landlord in England can't evict without a reason: they need a valid notice, a court order, and court bailiffs/.test(c.resolution) && /at least three months' rent, with four weeks' notice/.test(c.resolution) && /illegal eviction, a criminal offence: ring the police/.test(c.resolution) && /0808 800 4444, Monday to Friday, 8am to 5pm/.test(c.resolution) && /Protection from Eviction Act 1977/.test(c.source) && /Renters' Rights Act 2025/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Sarah'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Sarah', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'sarah'; h.accounts.sarah = {}; h.playerProgress.sarah = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('midsummer_quarter');
  const days = [Date.UTC(2027, 5, 24, 12), Date.UTC(2031, 5, 24, 12)].map(offered);
  check('on Midsummer Day she comes among the day\'s dated callers (with the Midsummer Men)', days.every(leads), days);
  const outside = [Date.UTC(2027, 5, 23, 12), Date.UTC(2027, 5, 25, 12), Date.UTC(2027, 8, 29, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('midsummer_quarter') && o.length === 3), outside);
  at(Date.UTC(2027, 5, 24, 12), () => {
    h.accounts.sarah.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.sarah, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'midsummer_quarter');
  check('…and writes the Quarter Day into The Turning Year, dated 24 June', e && e.met && /· Midsummer$/.test(e.title) && e.date === '24 June' && ch.entries.findIndex((x) => x.id === 'midsummer_quarter') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
