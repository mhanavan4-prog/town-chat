// Holy Rood Day, 14 September: nutting, and the Devil out nutting too (Hone,
// after Brand; Poor Robin, 1709; Notes and Queries, 1872; Folkard, 1884), a
// caller dated by the Commonplace Book's own entry, first at the door, and the
// Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-rood-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { ROOD_RITES } = require('../data/holyRood.js');
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

const R = ROOD_RITES.nutting;
check('going a-nutting: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Grim the Collier of Croydon, via Brand and Hone; and the Eton manuscript, the day Hone\'s guess', /"This day, they say, is called Holy-rood day, \/ And all the youth are now a nutting gone"/.test(R.lore) && /Grim the Collier of Croydon/.test(R.lore) && /"to go out and gather nuts"/.test(R.lore) && /"on the fruitfulness of autumn, and the deadly cold of the coming winter"/.test(R.lore) && /Hone guessed this one/.test(R.lore) && /Hone, The Every-Day Book, vol\. I \(1826\), 14 September/.test(R.source));
check('…the Devil a-nutting: Poor Robin (1709), Bury St Edmunds (1872), and Folkard\'s Sussex', /"The devil, as the common people say, \/ Doth go a nutting on Holy-rood day"/.test(R.lore) && /"for fear he should meet the devil"/.test(R.lore) && /"As black as the De'il's nutting bag"/.test(R.lore) && /"and sometimes appears to nutters in friendly guise, and holds down the branches for them to strip"/.test(R.lore) && /Folkard, Plant Lore, Legends, and Lyrics \(1884\)/.test(R.source) && /Notes and Queries, 4th ser\., vol\. IX \(24 February 1872\)/.test(R.source));
check('…the nut year and the babies, and the Exaltation of the Cross', /"a good Nut year always bringing an abundance of babies"/.test(R.lore) && /Exaltation of the Holy Cross/.test(R.lore));
check('…and nothing unfound: no Devil on the 21st, no girl-meets-Devil saying', !/21st|21 September/.test(R.lore) && !/girl who goes nutting/i.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'holy_rood');
check('the Commonplace Book\'s own entry says the Eton day was perhaps this one, as Hone does', cal && cal.month === 9 && cal.day === 14 && /perhaps this one/.test(cal.text));
const c = CALLERS.find((x) => x.id === 'holy_rood_nutting');
check('Kit Lambourne, dated by the old calendar\'s Holy Rood Day, for two days', c && c.when && c.when.calendar === 'holy_rood' && c.when.days === 2 && c.steps[0].rite === 'nutting');
check('the practical half: ripe when the husk pulls back; leave plenty; the dormouse sign and the law; wild nuts no theft unless sold; allergy', /papery husk is pulling back/.test(c.resolution) && /September and October/.test(c.resolution) && /Take no more than you'll eat/.test(c.resolution) && /tooth marks slanting round it on the outside/.test(c.resolution) && /protected by law/.test(c.resolution) && /People's Trust for Endangered Species/.test(c.resolution) && /picking them to sell can be/.test(c.resolution) && /allergic/.test(c.resolution) && /injector/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Kit'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Kit', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'kit'; h.accounts.kit = {}; h.playerProgress.kit = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [14, 15].map((d) => offered(Date.UTC(2027, 8, d, 12)));
  const season = at(Date.UTC(2027, 8, 14, 12), () => h.calendarPublicState().season.key);
  check('on Holy Rood Day she comes first, a caller of the season after her', days.every((o) => o[0] === 'holy_rood_nutting' && o.length === 3 && CALLERS.find((x) => x.id === o[1]).season === season), [season, days]);
  const outside = [Date.UTC(2027, 8, 13, 12), Date.UTC(2027, 8, 16, 12), Date.UTC(2027, 2, 14, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('holy_rood_nutting') && o.length === 3), outside);
  at(Date.UTC(2027, 8, 14, 12), () => {
    h.accounts.kit.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.kit, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'nutting');
  check('…and writes Going a-Nutting into The Turning Year', e && e.met && /· Holy Rood Day$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'nutting') >= 12);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
