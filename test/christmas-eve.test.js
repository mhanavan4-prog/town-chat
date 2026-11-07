// Christmas Eve: the oxen kneel at midnight and the bees hum in their hives
// (Brand via Hone; Hunt, 1865; Ditchfield, 1896; the Gentleman's Magazine,
// 1753; Hardy, 1915), a caller dated by the Commonplace Book's own entry (24
// December, and the 25th), first at the door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-xmaseve-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CHRISTMAS_EVE_RITES } = require('../data/christmasEve.js');
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

const R = CHRISTMAS_EVE_RITES.midnight_oxen;
check('the oxen kneel: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Brand\'s Devonshire notion, and Old Christmas Eve after the change', /"at twelve o'clock at night on Christmas-eve, the oxen in their stalls are always found on their knees, as in an attitude of devotion"/.test(R.lore) && /only on Old Christmas Eve/.test(R.lore) && /Brand, Observations on Popular Antiquities, ed\. H\. Ellis \(1813\), quoted in W\. Hone/.test(R.source));
check('…the Launceston countryman of 1790, in Brand\'s spelling, and Brand\'s own doubt', /Launceston/.test(R.lore) && /1790/.test(R.lore) && /"a cruel moan like christian creatures"/.test(R.lore) && /prints of the Nativity/.test(R.lore));
check('…Hunt at St Germans; the Yorkshire bees hum (Ditchfield), and nobody says sing', /St Germans/.test(R.lore) && /Hunt, Popular Romances of the West of England \(1865\)/.test(R.source) && /"watching the beehives on the new and old Christmas Eve"/.test(R.lore) && /"the humming noise which they suppose the bees will make"/.test(R.lore) && /Ditchfield, Old English Customs Extant at the Present Time \(1896\), p\. 52/.test(R.source) && !/\bsing\b|\bsang\b/.test(R.lore + R.outcomes.join(' ')));
check('…Quainton, 1753: the thorn, the two thousand, and the ministers giving way', /"Above two thousand people came here this night with lanthorns and candles"/.test(R.lore) && /"Dec\. 25th, N\.S\. could not be the right Christmas Day"/.test(R.lore) && /"the old Christmas Day should be kept holy as before"/.test(R.lore) && /Gentleman's Magazine \(January 1753\), in W\. C\. Hazlitt, Faith and Folklore \(1905\)/.test(R.source));
check('…and Hardy, only in lines the 1915 and 1917 printings share', /"Christmas Eve, and twelve of the clock\. \/ 'Now they are all on their knees,'"/.test(R.lore) && /"Hoping it might be so\."/.test(R.lore) && !/weave|believe|coomb|comb/.test(R.lore) && /Hardy, "The Oxen" \(1915\)/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'oxen_kneel');
check('the Commonplace Book\'s own entry has the bees humming, and cites who says so', cal && cal.month === 12 && cal.day === 24 && /bees to hum/.test(cal.text) && !/sing/.test(cal.text) && /Ditchfield \(1896\)/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'christmas_eve_oxen');
check('Old Jacob Penhale, dated by the old calendar\'s Christmas Eve, for two days', c && c.when && c.when.calendar === 'oxen_kneel' && c.when.days === 2 && c.steps[0].rite === 'midnight_oxen');
check('the practical half: more fodder in a frost, unfrozen water, hives left shut and hefted, fondant if light, entrances cleared, mouse guards', /extra fodder/.test(c.resolution) && /break the ice on the trough/.test(c.resolution) && /leave the hives shut/.test(c.resolution) && /Lift the back of each/.test(c.resolution) && /fondant over the cluster/.test(c.resolution) && /bent wire/.test(c.resolution) && /mouse guards/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Penhale'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Penhale', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'penhale'; h.accounts.penhale = {}; h.playerProgress.penhale = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [24, 25].map((d) => offered(Date.UTC(2027, 11, d, 12)));
  check('on Christmas Eve he comes first, a Yule caller after him', days.every((o) => o[0] === 'christmas_eve_oxen' && o.length === 3 && CALLERS.find((x) => x.id === o[1]).season === 'yule'), days);
  const outside = [Date.UTC(2027, 11, 23, 12), Date.UTC(2027, 11, 26, 12), Date.UTC(2028, 0, 5, 12)].map(offered);
  check('on other days he never comes (not even on Old Christmas Eve)', outside.every((o) => !o.includes('christmas_eve_oxen') && o.length === 3), outside);
  at(Date.UTC(2027, 11, 24, 12), () => {
    h.accounts.penhale.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.penhale, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'yule');
  const e = ch.entries.find((x) => x.id === 'midnight_oxen');
  check('…and writes The Oxen Kneel into Yuletide, before Wren Day', e && e.met && /· Christmas Eve$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'midnight_oxen') === ch.entries.findIndex((x) => x.id === 'wren_hunt') - 1 && /oxen watched at midnight on Christmas Eve/.test(ch.intro));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
