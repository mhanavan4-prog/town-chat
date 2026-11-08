// The Lammas term (the Otterbourne ballad, Child 161C; the Scottish National
// Dictionary; the Removal Terms (Scotland) Act 1886 and the Term and Quarter
// Days (Scotland) Act 1990; Anderson, 1792; the St Andrews and Inverkeithing
// fairs): Jamie Lumsden comes on the Commonplace Book's own day (1 August, and
// the 2nd), with a practical half on a farm worker's terms and pay in Scotland
// (GOV.UK; the Agricultural Wages (Scotland) Order 2026); and the Charm Book.
// The old calendar is put right: Lammas is a quarter day still.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-lammasterm-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { LAMMAS_TERM_RITES } = require('../data/lammasTerm.js');
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

const R = LAMMAS_TERM_RITES.lammas_term;
check('Lammas Term: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the ballad\'s Lammas tide; the four term-days of 1690 and 1693; a money-term, not a flitting term; 1886\'s removal terms; 28 August since 1990', /"It fell about the Lammas tide, \/ When the muir-men win their hay"/.test(R.lore) && /"By Acts of 1690 and 1693 the Sc\. term-days are Candlemas \(2 Feb\.\), Whitsunday \(15 May\), Lammas \(1 Aug\.\) and Martinmas \(11 Nov\.\)"/.test(R.lore) && /money-term, for rents and school fees, not a flitting term/.test(R.lore) && /"the removal terms for house occupancy were fixed by statute as 28 May and 28 Nov"/.test(R.lore) && /since 1990 Lammas has meant 28 August/.test(R.lore) && /1886/.test(R.source) && /1990/.test(R.source));
check('…Anderson\'s Lammas towers, of sods; the St Andrews feeing (1937); Inverkeithing in the burgh records of 1652', /"agreed to build a tower in some conspicuous place, near the centre of their district, which was to serve as the place of their rendezvous on Lammas day"/.test(R.lore) && /"usually built of sods"/.test(R.lore) && /"the fair was principally for the country folks 'feeing'"/.test(R.lore) && /"appear in Burgh records of 1652"/.test(R.lore) && !/oldest medieval street fair/.test(R.lore) && /Anderson/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'lammas_term');
check('the Commonplace Book\'s Lammas, put right: a quarter day still, 28 August since 1990; hay-time, not "the end of the hay"; record', cal && cal.month === 8 && cal.day === 1 && /Lammas is a quarter day/.test(cal.text) && /28 August since 1990/.test(cal.text) && !/until 1886/.test(cal.text) && !/end of the hay/.test(cal.text) && cal.tier === 'record' && /Child 161C/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'lammas_term');
check('Jamie Lumsden, from Kingsbarns, dated by it, for two days', c && /Kingsbarns/.test(c.caller) && c.when && c.when.calendar === 'lammas_term' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'lammas_term');
check('the practical half: a written statement on the first day, a fuller one in two months; the Agricultural Wages Order, £12.71 at any age from April 2026', /Then the practical half/.test(c.resolution) && /written statement of the main terms of the job on the first day, and a fuller one within two months/.test(c.resolution) && /from 1 April 2026, £12\.71 an hour at any age/.test(c.resolution) && /Agricultural Wages \(Scotland\) Order/.test(c.source));
check('…overtime at time and a half after 8 hours or 48; the national rate for 18 to 20 lower, £10.85; payslips kept; the Board\'s address', /overtime is time and a half after 8 hours in a day or 48 in a week/.test(c.resolution) && /£10\.85/.test(c.resolution) && /Keep your payslips/.test(c.resolution) && /sawb@gov\.scot/.test(c.resolution) && /GOV\.UK/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Jamie'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Jamie', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'jamie'; h.accounts.jamie = {}; h.playerProgress.jamie = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('lammas_term');
  const days = [Date.UTC(2027, 7, 1, 12), Date.UTC(2027, 7, 2, 12)].map(offered);
  check('on Lammas and the 2nd he comes first', days.every(leads), days);
  const outside = [Date.UTC(2027, 6, 31, 12), Date.UTC(2027, 7, 3, 12), Date.UTC(2027, 7, 28, 12)].map(offered);
  check('on other days he never comes', outside.every((o) => !o.includes('lammas_term') && o.length === 3), outside);
  at(Date.UTC(2027, 7, 1, 12), () => {
    h.accounts.jamie.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.jamie, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'lammas_term');
  check('…and writes the Lammas Term into The Turning Year, dated 1 August', e && e.met && /· Lammas$/.test(e.title) && e.date === '1 August' && ch.entries.findIndex((x) => x.id === 'lammas_term') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
