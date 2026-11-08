// The Fifth of November (the Act of 1606 and its repeal, 1859; Chamberlain,
// 1605; The Times, 1790; Hone, 1826; Chambers, 1864): Ned and Polly Sparrow
// come on the Commonplace Book's own day (5 November, and the 6th), and the
// Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-fifth-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { FIFTH_RITES } = require('../data/fifthNovember.js');
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

const R = FIFTH_RITES.fifth_november;
check('remember, remember: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the Act of 1606: prayers in every cathedral and parish church, no bonfires; repealed 1859', /"in every cathedral and parish church"/.test(R.lore) && /"always upon the fifth day of November say morning prayer, and give unto Almighty God thanks for this most happy deliverance"/.test(R.lore) && /repeal in 1859/.test(R.lore) && /said nothing of bonfires/.test(R.lore) && !/in all Churches/.test(R.lore));
check('…Chamberlain\'s bonfires of 1605; the Pope burned; The Times of 1790', /"great ringing and as great store of bonfires as ever I thincke was seene"/.test(R.lore) && /the Pope who was burned/.test(R.lore) && /"begging for money for Guy Faux"/.test(R.lore));
check('…Hone\'s straw Guy, lantern and matches, and his cry without "the"', /"is easily done with straw"/.test(R.lore) && /"neither was not, nor is, a Guy, without a dark lantern in one hand, and a spread bunch of matches in the other"/.test(R.lore) && /'pray remember Guy! please to remember Guy\.'/.test(R.lore) && /col\. 1430/.test(R.source));
check('…Chambers\'s cries and rhyme; a penny for the Guy called later', /"'Please to remember Guy!' or 'Please to remember the bonfire!'"/.test(R.lore) && /"Remember, remember! \/ The fifth of November, \/ The Gunpowder treason and plot"/.test(R.lore) && /"A penny for the Guy" came later still/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'guy_fawkes');
check('the Commonplace Book\'s Fifth: no pennies, every parish church, no bonfires in the Act, Hone too', cal && cal.month === 11 && cal.day === 5 && !/pennies/.test(cal.text) && /every parish church, but no bonfires/.test(cal.text) && /Hone/.test(cal.source) && cal.quote === 'Please to remember the bonfire!');
const c = CALLERS.find((x) => x.id === 'fifth_november');
check('Ned and Polly Sparrow, dated by it, for two days', c && c.when && c.when.calendar === 'guy_fawkes' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'fifth_november');
check('the practical half: hedgehogs, build on the day or move it; one side; away from sheds; no petrol; children back; water by', /hedgehogs/.test(c.resolution) && /build a bonfire on the day you light it, or move the whole pile/.test(c.resolution) && /light it from one side only/.test(c.resolution) && /away from sheds, fences and trees/.test(c.resolution) && /never use petrol or paraffin/.test(c.resolution) && /bucket of water or a hose/.test(c.resolution));
check('…fireworks: under eighteen, not in the street, eleven and midnight on the Fifth; arm\'s length, never go back; burns under cool water twenty minutes, no butter, cling film', /nobody under eighteen may buy them/.test(c.resolution) && /never set off or thrown in the street/.test(c.resolution) && /on the Fifth it's midnight/.test(c.resolution) && /never go back to one that's been lit/.test(c.resolution) && /cool running water for twenty minutes/.test(c.resolution) && /no butter or cream/.test(c.resolution) && /cling film over it loosely/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Polly'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Polly', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'polly'; h.accounts.polly = {}; h.playerProgress.polly = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 10, 5, 12), Date.UTC(2027, 10, 6, 12)].map(offered);
  check('on the Fifth and the 6th they come first', days.every((o) => o[0] === 'fifth_november' && o.length === 3), days);
  const outside = [Date.UTC(2027, 10, 4, 12), Date.UTC(2027, 10, 7, 12), Date.UTC(2027, 4, 5, 12)].map(offered);
  check('on other days they never come', outside.every((o) => !o.includes('fifth_november') && o.length === 3), outside);
  at(Date.UTC(2027, 10, 5, 12), () => {
    h.accounts.polly.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.polly, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'fifth_november');
  check('…and writes Remember, Remember into The Turning Year, dated 5 November', e && e.met && /· The Fifth of November$/.test(e.title) && e.date === '5 November' && ch.entries.findIndex((x) => x.id === 'fifth_november') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
