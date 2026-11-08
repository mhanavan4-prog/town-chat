// Barnaby Bright, St Barnabas's Day (Ray, 1678; Spenser, 1595; Chambers,
// 1864; Hone, quoting Plot; the St Mary at Hill accounts): Ellen Dawe comes on
// the Commonplace Book's own day (11 June, and the 12th), with a practical half
// on sun and heat (NHS); and the Charm Book. The old calendar is put right:
// St Barnabas fell at the solstice itself, not "near the old midsummer".
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-barnaby-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { BARNABY_RITES } = require('../data/barnabyBright.js');
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

const R = BARNABY_RITES.barnaby_bright;
check('Barnaby Bright: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Ray\'s proverb, 1678; Chambers\'s solstice "before the change of style"; Spenser\'s "Barnaby the bright"', /"Barnaby bright, the longest day and the shortest night," Ray printed/.test(R.lore) && /"Before the change of style, the 11th of June was the day of the summer solstice"/.test(R.lore) && /"This day the sunne is in his chiefest hight, \/ With Barnaby the bright"/.test(R.lore) && /Ray/.test(R.source) && /Spenser/.test(R.source));
check('…Plot\'s rake for hay-harvest, as Hone gives him; the rose and woodruff garlands of St Mary at Hill; 1752 and after', /"a rake on the 11th of June, St\. Barnabas'-day, importing that then it is hay-harvest"/.test(R.lore) && /"ffor Rose-garlondis and wodrove-garlondis on Saynt Barnebes day, xj d"/.test(R.lore) && /In 1752 eleven days were dropped/.test(R.lore) && !/lavender/.test(R.lore) && /St Mary at Hill/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'barnaby_bright');
check('the Commonplace Book\'s Barnaby Bright, put right: the solstice itself, not near the old midsummer; the rake and the garlands; Chambers and Ray cited', cal && cal.month === 6 && cal.day === 11 && /fell at the summer solstice itself/.test(cal.text) && !/near the old midsummer/.test(cal.text) && /rake for hay-harvest/.test(cal.text) && /Ray/.test(cal.source) && /Book of Days/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'barnaby_bright');
check('Ellen Dawe, from the hay meadows, dated by it, for two days', c && /hay meadows/.test(c.caller) && c.when && c.when.calendar === 'barnaby_bright' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'barnaby_bright');
check('the practical half: shade 11 to 3; clothes, hat, sunglasses; factor 30, 4-star UVA, every two hours; never burn; babies out of the sun', /Then the practical half/.test(c.resolution) && /keep to the shade between 11am and 3pm/.test(c.resolution) && /cover up with clothes, a hat and sunglasses/.test(c.resolution) && /at least factor 30, with at least 4-star UVA protection, put on well and again every two hours/.test(c.resolution) && /Never burn, and keep babies under 6 months out of direct sun/.test(c.resolution));
check('…heat exhaustion: a cool place, clothes off, water, cool skin and fanning; better in 30 minutes, or 999', /move them to a cool place, take off what clothing you can, give them plenty of water, and spray or sponge them with cool water and fan them/.test(c.resolution) && /within 30 minutes; if they don't, ring 999/.test(c.resolution) && /NHS/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Ellen'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Ellen', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'ellen'; h.accounts.ellen = {}; h.playerProgress.ellen = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('barnaby_bright');
  const days = [Date.UTC(2027, 5, 11, 12), Date.UTC(2027, 5, 12, 12)].map(offered);
  check('on St Barnabas\'s Day and the 12th she comes first', days.every(leads), days);
  const outside = [Date.UTC(2027, 5, 10, 12), Date.UTC(2027, 5, 13, 12), Date.UTC(2027, 5, 24, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('barnaby_bright') && o.length === 3), outside);
  at(Date.UTC(2027, 5, 11, 12), () => {
    h.accounts.ellen.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.ellen, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'barnaby_bright');
  check('…and writes the Barnaby Bright into The Turning Year, dated 11 June', e && e.met && /· St Barnabas's Day$/.test(e.title) && e.date === '11 June' && ch.entries.findIndex((x) => x.id === 'barnaby_bright') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
