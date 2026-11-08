// The Dog Days (Hesiod; Pliny; Vaughan, 1612; Achelley, 1572; Hone, 1826;
// Brewer, 1895): Sukey Hale comes when they begin, the Commonplace Book's own
// day (3 July, and the 4th), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-dogdays-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { DOG_RITES } = require('../data/dogDays.js');
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

const R = DOG_RITES.dog_days;
check('the Dog Days: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Hesiod\'s Sirius; Pliny on the sun kindled and dogs rabid, in Bostock and Riley\'s words', /"Sirius parches head and knees and the skin is dry through heat\."/.test(R.lore) && /"Who is there that does not know that the vapour of the sun is kindled by the rising of the Dog-star\?"/.test(R.lore) && /"dogs, during the whole of this period, are peculiarly disposed to become rabid"/.test(R.lore) && /"Canine madness is fatal to man during the heat of Sirius\."/.test(R.lore) && !/lesser dog-star/.test(R.lore));
check('…Vaughan, 1612, on physic and wounds; Brewer\'s dates and phrase; the 1572 almanac\'s other days', /"It is dangerous taking of Physicke, and specially in the Dog dayes\. To heale wounds is very difficult and perillous"/.test(R.lore) && /"July 3rd to August 11th"/.test(R.lore) && /"the dog-days bore the combined heat of the dog-star and the sun"/.test(R.lore) && /10 July to 20 August in 1572/.test(R.lore));
check('…Butler, by Hone: a palpable mistake, the star rising at the end of August; the Cambridge muzzles; Brady\'s "groundless"', /"a palpable mistake, since the heliacal rising of this star does not now take place, at least in our latitude, till near the latter end of August\."/.test(R.lore) && /Cambridge in 1824/.test(R.lore) && /"groundless"/.test(R.lore) && /3 July/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'dog_days');
check('the Commonplace Book\'s Dog Days: the later almanacs\' dates, the star now rising at the end of August; Brewer and Hone', cal && cal.month === 7 && cal.day === 3 && /in the later almanacs/.test(cal.text) && /end of August/.test(cal.text) && /Hone/.test(cal.source) && cal.quote === 'the combined heat of the dog-star and the sun');
const c = CALLERS.find((x) => x.id === 'dog_days');
check('Sukey Hale, dated by it, for two days', c && c.when && c.when.calendar === 'dog_days' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'dog_days');
check('the practical half: never in a closed vehicle, 22 to 47 within the hour, 999; the back of the hand five seconds; eleven to three; the NHS four steps, half an hour, 999; the doctor\'s medicine', /Never leave a dog, a child or anyone in a closed vehicle/.test(c.resolution) && /22 degrees a car can reach 47 within the hour/.test(c.resolution) && /if you see a dog in distress in a hot car, ring 999/.test(c.resolution) && /back of your hand on the pavement for five seconds/.test(c.resolution) && /between eleven and three/.test(c.resolution) && /within half an hour, and if they don't/.test(c.resolution) && /take what the doctor gave you/.test(c.resolution) && !/seven seconds/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Sukey'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Sukey', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'sukey'; h.accounts.sukey = {}; h.playerProgress.sukey = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('dog_days');
  // In 2027 the Rush-bearing Saturday is 3 July: both come first.
  const days = [Date.UTC(2027, 6, 3, 12), Date.UTC(2027, 6, 4, 12), Date.UTC(2028, 6, 3, 12)].map(offered);
  check('on the first of the Dog Days and the 4th she comes first (with the rush-bearers when they share it)', days.every(leads), days);
  const outside = [Date.UTC(2027, 6, 2, 12), Date.UTC(2027, 6, 5, 12), Date.UTC(2027, 7, 11, 12)].map(offered);
  check('on other days, the last of the Dog Days among them, she never comes', outside.every((o) => !o.includes('dog_days') && o.length === 3), outside);
  at(Date.UTC(2028, 6, 3, 12), () => {
    h.accounts.sukey.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.sukey, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'dog_days');
  check('…and writes the Dog Days into The Turning Year, dated 3 July', e && e.met && /· 3 July$/.test(e.title) && e.date === '3 July' && ch.entries.findIndex((x) => x.id === 'dog_days') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
