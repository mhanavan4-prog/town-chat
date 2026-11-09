// May Eve, rowan and primroses for the milk (Moore, 1891, with Mona's Herald,
// 1837; Lady Wilde, 1887; Chambers, 1826): Bridget Fahy comes on the
// Commonplace Book's own day (30 April, and May Day), at the door with Mrs
// Hayward's girls on the 1st, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-mayeve-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { MAY_EVE_RITES } = require('../data/mayEve.js');
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

const R = MAY_EVE_RITES.may_eve_rowan;
check('rowan and primroses: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Moore, 1891: primroses on the threshold, rowan crosses without a knife over house and cow-house; no fire given; and the Manx kept it on 11 May', /"green leaves or boughs and sumark, or primrose flowers, were strewn on the threshold, and branches of the cuirn, or mountain-ash, were made into small crosses without the aid of a knife, which was on no account to be used, and stuck over the doors of the dwelling-houses and cow-houses"/.test(R.lore) && /"no one would give fire"/.test(R.lore) && /11 May/.test(R.lore) && /Folk-Lore of the Isle of Man \(1891\)/.test(R.source));
check('…the milk charm, the gorse of 1837, and Moore\'s own caveat; no "crosh cuirn"', /"One of the most efficacious charms to prevent milk being bewitched\."/.test(R.lore) && /"have, from time immemorial, burned all the whin \(gorse\) bushes in the Island"/.test(R.lore) && /"probably of Christian origin, and, therefore, comparatively speaking of recent date\."/.test(R.lore) && !/crosh/i.test(R.lore + R.how));
check('…Lady Wilde, 1887: the milk stolen, nothing given out, primroses, rowan on the pail and churn', /"make great efforts to steal the milk on May morning"/.test(R.lore) && /"no one will allow milk, or fire, or salt, to be carried away from the house on that day"/.test(R.lore) && /"The best preventative is to scatter primroses on the threshold"/.test(R.lore) && /"cut and peel some branches of the mountain ash, and bind the twigs round the milk pails and the churn"/.test(R.lore));
check('…and the Dumfriesshire rhyme as Chambers has it, "Put", 1826', /"Rowan-tree, and red thread, Put the witches to their speed!"/.test(R.lore) && /Popular Rhymes of Scotland \(1826\), p\. 277/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'may_eve');
check('the Commonplace Book\'s May Eve, 30 April, noting Man\'s Old May Eve', cal && cal.month === 4 && cal.day === 30 && /Old May Eve, 11 May/.test(cal.text));
const c = CALLERS.find((x) => x.id === 'may_eve_rowan');
check('Bridget Fahy, dated by it, on the eve only', c && c.when && c.when.calendar === 'may_eve' && c.when.days === 1 && c.steps.length === 1 && c.steps[0].rite === 'may_eve_rowan');
check('the practical half: the owner\'s leave; raw rowan berries not to be eaten; kingcup leaves poisonous, gloves; no gorse burned, out of season in England and banned in Ireland', /the owner's leave/.test(c.resolution) && /raw, they're not to be eaten/.test(c.resolution) && /wear gloves and wash your hands after, for the leaves are poisonous/.test(c.resolution) && /burn no gorse/.test(c.resolution) && /in England after mid-April/.test(c.resolution) && /in Ireland from the first of March to the end of August/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Bridget'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Bridget', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'bridget'; h.accounts.bridget = {}; h.playerProgress.bridget = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const eve = offered(Date.UTC(2027, 3, 30, 12));
  check('on 30 April she comes first', eve[0] === 'may_eve_rowan' && eve.length === 3, eve);
  // May Day is the garland girls' (data/mayGarland.js), and some years Rogation's too.
  const day = offered(Date.UTC(2027, 4, 1, 12));
  check('on May Day she leaves the door to the garland girls', day[0] === 'may_garland' && !day.includes('may_eve_rowan') && day.length === 3, day);
  const outside = [Date.UTC(2027, 3, 29, 12), Date.UTC(2027, 4, 2, 12), Date.UTC(2027, 4, 11, 12), Date.UTC(2027, 9, 30, 12)].map(offered);
  check('on other days, Old May Eve among them, she never comes', outside.every((o) => !o.includes('may_eve_rowan') && o.length === 3), outside);
  at(Date.UTC(2027, 3, 30, 12), () => {
    h.accounts.bridget.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.bridget, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'may_eve_rowan');
  const order = ch.entries.map((x) => x.id);
  check('…and writes Rowan and Primroses into The Turning Year, dated 30 April, before the May garland', e && e.met && /· May Eve$/.test(e.title) && e.date === '30 April' && order.indexOf('may_eve_rowan') < order.indexOf('may_garland') && order.indexOf('may_eve_rowan') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
