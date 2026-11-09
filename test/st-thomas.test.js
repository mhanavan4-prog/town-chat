// St Thomas's Day: going a-gooding on the shortest day (Hone, from the
// Gentleman's Magazine, Ellis and Brand; Chambers, 1864; Ditchfield, 1896;
// Halliwell, 1849), a caller dated by the Commonplace Book's own entry (21
// December, and the 22nd), first at the door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-thomas-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { THOMAS_RITES } = require('../data/stThomas.js');
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

const R = THOMAS_RITES.gooding;
check('going a-gooding: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Hone: the women\'s gooding, palm and primroses; Ellis\'s Kent; Brand\'s Warwickshire corning', /"Going a gooding on St\. Thomas's day formerly prevailed in England\. Women begged money, and in return presented the donors with sprigs of palm and branches of primroses"/.test(R.lore) && /"still kept up in Kent, in the neighbourhood of Maidstone\."/.test(R.lore) && /"go with a bag to beg corn of the farmers, which they call going a corning\."/.test(R.lore) && /Hone, The Every-Day Book, vol\. I \(1826\), 21 December/.test(R.source));
check('…Chambers: Doleing and Mumping Day, the shilling a head, the Dole in the vestry, the shortest-day couplet', /"Doleing Day"/.test(R.lore) && /"Mumping \[begging\] Day"/.test(R.lore) && /"The clergyman is expected to give a shilling to each person"/.test(R.lore) && /'St\. Thomas's Dole\.'/.test(R.lore) && /"St Thomas gray, St\. Thomas gray, \/ The longest night and the shortest day\."/.test(R.lore) && /Chambers, The Book of Days \(1864\), 21 December/.test(R.source));
check('…Ditchfield: Thomasing in Cheshire, and the Bilston rhyme', /"going a-Thomasing"/.test(R.lore) && /"Well a day, well a day, \/ St\. Thomas goes too soon away; \/ Then your gooding we do pray, \/ For the good time will not stay\."/.test(R.lore) && /Ditchfield, Old English Customs Extant at the Present Time \(1896\), pp\. 25–26/.test(R.source));
check('…Halliwell\'s St Thomas\'s onion, peeled and wrapped (no red onion, no pins)', /St\. Thomas's onion/.test(R.lore) && /"Good St\. Thomas, do me right, \/ And let my true love come to-night"/.test(R.lore) && /Halliwell, Popular Rhymes and Nursery Tales \(1849\), p\. 224/.test(R.source) && !/red onion|\bpins\b/.test(R.lore));
check('…and not the modern "Christmas is coming" tie', !/geese|Christmas is coming/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'st_thomas');
check('the Commonplace Book\'s own entry says women went a-gooding, and the poor a-corning, as Hone has it', cal && /^Women went a-gooding/.test(cal.text) && /the poor took a bag/.test(cal.text));
const c = CALLERS.find((x) => x.id === 'st_thomas_gooding');
check('Widow Ann Bagshaw, dated by the old calendar\'s St Thomas, for two days', c && c.when && c.when.calendar === 'st_thomas' && c.when.days === 2 && cal.month === 12 && cal.day === 21 && c.steps[0].rite === 'gooding');
check('the practical half: give where nobody has to ask; check the register; not hurried at the door; tins for the food bank; the old folk in a cold spell', /Give where nobody has to ask/.test(c.resolution) && /Charity Commission's register/.test(c.resolution) && /never let a collector at the door hurry you/.test(c.resolution) && /tinned meat and fish/.test(c.resolution) && /not fresh food/.test(c.resolution) && /warm enough at night/.test(c.resolution) && /medicines/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Goody'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Goody', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'goody'; h.accounts.goody = {}; h.playerProgress.goody = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [21, 22].map((d) => offered(Date.UTC(2027, 11, d, 12)));
  check('on St Thomas\'s Day she comes first, a Yule caller after her', days.every((o) => o[0] === 'st_thomas_gooding' && o.length === 3 && CALLERS.find((x) => x.id === o[1]).season === 'yule'), days);
  const outside = [Date.UTC(2027, 11, 20, 12), Date.UTC(2027, 11, 23, 12), Date.UTC(2027, 6, 21, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('st_thomas_gooding') && o.length === 3), outside);
  at(Date.UTC(2027, 11, 21, 12), () => {
    h.accounts.goody.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.goody, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'gooding');
  check('…and writes Going a-Gooding into The Turning Year', e && e.met && /· St Thomas's Day$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'gooding') >= 12);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
