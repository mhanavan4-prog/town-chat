// Helston Furry Day ("Durgan", The Gentleman's Magazine, 1790, as Bell quotes
// it; Hone's correspondent, 1827; Gilbert, 1838): Kitto Pascoe comes on Furry
// Day as the Commonplace Book reckons it (8 May, or the Saturday before when
// the 8th is a Sunday or Monday), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-furry-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { FURRY_RITES } = require('../data/furryDay.js');
const { CALLERS } = require('../data/callers.js');
const { OLD_CALENDAR, entryDate } = require('../data/oldCalendar.js');
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

const R = FURRY_RITES.furry_day;
check('the Furry: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Durgan, 1790: Helstone, the Furry Day, the garlands; the drums and the song of the Summer and the May', /"At Helstone, a genteel and populous borough town in Cornwall"/.test(R.lore) && /"is called the Furry Day, supposed Flora's Day"/.test(R.lore) && /"rather from the garlands commonly worn on that day"/.test(R.lore) && /"some troublesome rogues go round the streets with drums, or other noisy instruments"/.test(R.lore) && /to bring home 'the Summer and the May, O!'/.test(R.lore) && /p\. 520/.test(R.source) && /Knowlson/.test(R.source));
check('…Hone\'s correspondent, 1827: the river leap and "fade into the country"', /"set astride on a pole, and hurried on men's shoulders to the river, where he is sentenced to leap over a wide place"/.test(R.lore) && /"fade into the country, \(fade being an old English word for go,\) and, about the middle of the day, return with flowers and oak branches in their hats and caps\."/.test(R.lore) && /Hone's correspondent \(1827\)/.test(R.lore) && /vol\. II \(1827\), 8 May, col\. 648/.test(R.source));
check('…the name from Cornish fer, Flora a learned guess; the Hal-an-Tow from 1802, its pageant a revival; the lilies modern', /"supposed by Mr\. Polwhele to have been derived from the old Cornish word fer, a fair or jubilee"/.test(R.lore) && /Flora is a learned guess/.test(R.lore) && /"utter absurdity"/.test(R.lore) && /from 1802 on/.test(R.lore) && /revival of the 1930s/.test(R.lore) && /lily of the valley worn today is modern custom/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'helston_furry');
const ds = [2026, 2027, 2028, 2033].map((y) => entryDate(cal, y).join('/'));
check('the Commonplace Book\'s Furry Day: the river leap, the lilies and pageant as later, Durgan quoted; 8 May or the Saturday before', cal && /leap the river/.test(cal.text) && /the lily of the valley and the Hal-an-Tow pageant as kept now are later/.test(cal.text) && cal.quote === "to bring home 'the Summer and the May, O!'" && cal.moves === '8 May, or the Saturday before' && ds.join() === '5/8,5/8,5/6,5/7', ds);
const c = CALLERS.find((x) => x.id === 'furry_day');
check('Kitto Pascoe, dated by it, for two days', c && c.when && c.when.calendar === 'helston_furry' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'furry_day');
check('the practical half: lily of the valley poisonous, gloves; water before you\'re thirsty, out of the sun eleven to three; faint and clammy: cool, feet up, water, half an hour, 999; a wristband number; no river leaping', /poisonous if eaten/.test(c.resolution) && /wear gloves/.test(c.resolution) && /even before you're thirsty/.test(c.resolution) && /between eleven and three/.test(c.resolution) && /feet up/.test(c.resolution) && /within half an hour, and if not, ring 999/.test(c.resolution) && /a wristband is best/.test(c.resolution) && /a narrow place can still be deep/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Kitto'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Kitto', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'kitto'; h.accounts.kitto = {}; h.playerProgress.kitto = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('furry_day');
  const days = [Date.UTC(2027, 4, 8, 12), Date.UTC(2027, 4, 9, 12), Date.UTC(2028, 4, 6, 12)].map(offered);
  check('on Furry Day (Saturday 8 May 2027; Saturday 6 May 2028) and the day after he comes first', days.every(leads), days);
  const outside = [Date.UTC(2027, 4, 7, 12), Date.UTC(2027, 4, 10, 12), Date.UTC(2028, 4, 8, 12)].map(offered);
  check('on other days, 8 May 2028 (a Monday) among them, he never comes', outside.every((o) => !o.includes('furry_day') && o.length === 3), outside);
  at(Date.UTC(2027, 4, 8, 12), () => {
    h.accounts.kitto.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.kitto, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'furry_day');
  check('…and writes the Furry into The Turning Year, dated as it moves', e && e.met && /· Helston$/.test(e.title) && e.date === '8 May, or the Saturday before' && ch.entries.findIndex((x) => x.id === 'furry_day') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
