// Calennig: New Year's Day in Wales, children round the doors until noon with
// an apple on three sticks, for a gift of food or money (T. M. Owen;
// Museum Wales), a caller dated New Year's Day, first at the door, and the
// Charm Book's Yuletide.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-calennig-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CALENNIG_RITES, CALENNIG_WHEN } = require('../data/calennig.js');
const { CALLERS } = require('../data/callers.js');
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

const R = CALENNIG_RITES.calennig;
check('calennig: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Owen: "early in the day and continued until noon"', /"the collecting of calennig began early in the day and continued until noon"/.test(R.lore) && /Owen, Welsh Folk Customs \(1959\)/.test(R.source));
check('…the apple of 1819 and Museum Wales\'s three sticks, box and hazelnuts; a gift or food or money', /"an apple stuck full of corn, variously coloured and decorated with a sprig of some evergreen"/.test(R.lore) && /"three short skewers"/.test(R.lore) && /"a decorated apple, pierced with three sticks and adorned with a sprig of box and hazelnuts"/.test(R.lore) && /"received a gift or food or money for their troubles"/.test(R.lore) && !/bread and cheese or a new coin/.test(R.lore) && /Museum Wales, "New Year Traditions: Collecting Calennig" \(2014\)/.test(R.source));
check('…the Gwaun Valley\'s Hen Galan on 13 January (Visit Pembrokeshire); the unfound song and OED citation left out; calan from calendae', !/Deffrwch Benteulu/.test(R.lore + R.source) && /Hen Galan, the old New Year of the old calendar, on 13 January/.test(R.lore) && /Visit Pembrokeshire, "Celebrating Hen Galan"/.test(R.source) && !/Oxford English Dictionary/.test(R.source) && /calendae/.test(R.lore));
check('…and nothing unfound: no hot pennies, no "Ac i bawb" rhyme', !/hot penn|Ac i bawb/i.test(R.lore + R.how + R.outcomes.join(' ')));
const c = CALLERS.find((x) => x.id === 'calennig_children');
check('Gwenno and Dai Prosser, on New Year\'s Day (and the 2nd)', c && c.when === CALENNIG_WHEN && CALENNIG_WHEN.month === 1 && CALENNIG_WHEN.from === 1 && CALENNIG_WHEN.to === 2 && c.steps[0].rite === 'calennig');
check('the practical half: daylight, pairs, known roads and doors; blunt short sticks; the verse asks for bread and cheese', /in daylight, in pairs or more/.test(c.resolution) && /only to doors they know/.test(c.resolution) && /blunt the points/.test(c.resolution) && /listen to the verse: it asks for bread and cheese/.test(c.resolution) && !/always as welcome as a coin/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Gwenno'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Gwenno', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'gwenno'; h.accounts.gwenno = {}; h.playerProgress.gwenno = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [1, 2].map((d) => offered(Date.UTC(2027, 0, d, 12)));
  // Isobel Rennie's Cream of the Well (data/creamOfTheWell.js) is the same morning: both dated callers first, a Yule caller after.
  const datedN = (o) => o.filter((id) => !!(CALLERS.find((x) => x.id === id) || {}).when).length;
  check('on New Year\'s Day they come first (with any other caller of the day), a Yule caller after them', days.every((o) => o.length === 3 && o.slice(0, datedN(o)).includes('calennig_children') && CALLERS.find((x) => x.id === o[datedN(o)]).season === 'yule'), days);
  const outside = [Date.UTC(2026, 11, 31, 12), Date.UTC(2027, 0, 3, 12), Date.UTC(2027, 6, 1, 12)].map(offered);
  check('on other days they never come', outside.every((o) => !o.includes('calennig_children') && o.length === 3), outside);
  at(Date.UTC(2027, 0, 1, 12), () => {
    h.accounts.gwenno.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.gwenno, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'yule');
  const e = ch.entries.find((x) => x.id === 'calennig');
  check('…and writes Calennig into Yuletide, between Wren Day and Twelfth Night', e && e.met && /· New Year's Day$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'calennig') === ch.entries.findIndex((x) => x.id === 'wren_hunt') + 1 && ch.entries.findIndex((x) => x.id === 'twelfth_cake') === ch.entries.findIndex((x) => x.id === 'calennig') + 1);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
