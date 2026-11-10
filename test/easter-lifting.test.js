// Easter Lifting, Easter Monday and Tuesday (Hone, 1826, with Lysons, the
// Warwickshire letter and Loggan's Shrewsbury chair; the Gentleman's Magazine,
// 1784; Walsall, 1896): Nell Bradbury comes on the Commonplace Book's own day
// and the next, with a practical half on consent and assault (Sexual Offences
// Act 2003; CPS; Rape Crisis; Victim Support); and the Charm Book. The old
// calendar is put right: the contribution, Warwickshire's days, and Walsall.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-lift-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { LIFTING_RITES } = require('../data/easterLifting.js');
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

const R = LIFTING_RITES.lifting;
check('Easter Lifting: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('…and the third sign is a no taken for an answer; the how lifts only the willing', /shakes her head/.test(R.outcomes[2]) && /set the chair down/.test(R.outcomes[2]) && /a woman who is willing/.test(R.how) && /whoever says no is let be/.test(R.how));
check('Hone\'s counties, the contribution, three elevations, and Lysons\' roll without the unchecked year or sum', /"In Lancashire, Staffordshire, Warwickshire, and some other parts of England there prevails this custom of heaving or lifting at Easter-tide"/.test(R.lore) && /"from every one lifted or heaved they extort a contribution"/.test(R.lore) && /"the ceremony is incomplete without three distinct elevations\."/.test(R.lore) && /"for taking king Edward I\. in his bed at Easter"/.test(R.lore) && !/1290|fourteen pounds|£14/.test(R.lore));
check('…L. S. of Warwickshire, Loggan\'s chair at the Talbot, the dissenters, and Walsall 1896', /"on the former day it was customary for the men to heave and kiss the women, and on the latter for the women to retaliate upon the men"/.test(R.lore) && /compelled to pay sixpence for \\?'leave and license\\?' to depart"/.test(R.lore) && /"an armchair, lined with white, and decorated with ribbons and favours of different colours"/.test(R.lore) && /"it was the custom of the place on that morning\."/.test(R.lore) && /"a rude, indecent, and dangerous diversion"/.test(R.lore) && /"an absurd custom"/.test(R.lore) && /"if the complainant objected to being heaved it was at once an assault for the defendant to proceed"/.test(R.lore) && /Walsall Advertiser \(2 May 1896\)/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'lifting');
check('the Commonplace Book\'s Easter Lifting, put right: the contribution, Warwickshire\'s days, Walsall, and the day Hone wrote', cal && /each one paid a contribution/.test(cal.text) && /in Warwickshire the men lifted and kissed the women on Easter Monday/.test(cal.text) && /Walsall in 1896/.test(cal.text) && !/for a kiss\./.test(cal.text) && /5 April \(Easter Tuesday\)/.test(cal.source) && !/1825/.test(cal.source) && cal.quote === 'is incomplete without three distinct elevations');
const c = CALLERS.find((x) => x.id === 'lifting');
check('Nell Bradbury, from Walsall, dated by it, for two days; her sister plainly grown', c && /Walsall/.test(c.caller) && c.when && c.when.calendar === 'lifting' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'lifting' && /Lizzie's twenty/.test(c.plea));
check('the practical half: lifting someone who said no is assault, a forced kiss can be sexual assault; consent by choice, and taken back', /Then the practical half/.test(c.resolution) && /Lifting someone who has said no is assault, however old the custom/.test(c.resolution) && /a forced kiss or touch with it can be sexual assault/.test(c.resolution) && /agrees by choice, with the freedom and capacity to choose, and she can take it back at any moment/.test(c.resolution) && /Sexual Offences Act 2003, ss\. 3, 74/.test(c.source) && /CPS/.test(c.source));
check('…put her down, now (the unsourced feet-first advice dropped); 999 or 101; Rape Crisis and Victim Support, with the right numbers', /tell them plainly to put her down, now\./.test(c.resolution) && !/feet first/.test(c.resolution) && /Call 999 if she's in danger or it's still going on, and 101/.test(c.resolution) && /0808 500 2222, day and night, for anyone 16 or over/.test(c.resolution) && /08 08 16 89 111/.test(c.resolution) && /Rape Crisis/.test(c.source) && /Victim Support/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Nell'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Nell', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'nell'; h.accounts.nell = {}; h.playerProgress.nell = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('lifting');
    // Easter 2027 is 28 March, 2028 is 16 April: Monday and Tuesday after.
  const days = [Date.UTC(2027, 2, 29, 12), Date.UTC(2027, 2, 30, 12), Date.UTC(2028, 3, 17, 12), Date.UTC(2028, 3, 18, 12)].map(offered);
  check('on Easter Monday and Tuesday she comes among the day\'s own', days.every(leads), days);
  const outside = [Date.UTC(2027, 2, 28, 12), Date.UTC(2027, 2, 31, 12), Date.UTC(2028, 3, 19, 12), Date.UTC(2027, 7, 1, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('lifting') && o.length === 3), outside);
  at(Date.UTC(2027, 2, 29, 12), () => {
    h.accounts.nell.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.nell, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'lifting');
  check('…and writes the Easter Lifting into The Turning Year', e && e.met && /· Easter Monday$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'lifting') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
