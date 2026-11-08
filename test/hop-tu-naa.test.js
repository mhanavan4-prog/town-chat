// Hop-tu-Naa: Hollantide Eve on the Isle of Man (Moore, 1891; Culture
// Vannin; Miller, 2013), a caller dated by the Commonplace Book's own entry
// (31 October, and 1 November), first at the door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-hop-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { HOP_RITES } = require('../data/hopTuNaa.js');
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

const R = HOP_RITES.hop_tu_naa;
check('Hop-tu-Naa: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Moore (1891): the two dates, the first day of the Celtic year, the last night of the year', /"October 31st and November 11th are the present and past dates, in accordance with the change in the Calendar"/.test(R.lore) && /"the first day of the Celtic year"/.test(R.lore) && /"undoubtedly the last night of the year"/.test(R.lore) && /Moore, The Folk-Lore of the Isle of Man \(1891\), ch\. VI/.test(R.source));
check('…the boys\' turnips on sticks for herrings and potatoes, not money', /"carried big sticks with cabbages or turnips stuck in the top, and with these they knocked at people's doors till they received herrings and potatoes and such-like gifts"/.test(R.lore) && /"This is old Hollantide night"/.test(R.lore));
check('…the dumb cake, Soddag valloo', /"a cake is made, called Soddag valloo, or dumb cake"/.test(R.lore) && /"in the course of the night they expect to see the images of the men who are destined to be their husbands\."/.test(R.lore));
check('…the name told as uncertain, Jinny the witch as the newer verse (1900), and no New Year\'s Eve salt or ashes', /Hog-annaa/.test(R.lore) && /no one is sure/.test(R.lore) && /"Jinny the witch flew over the house", a newer verse first found in 1900/.test(R.lore) && !/salt|ashes|footprint/.test(R.lore) && !/Shogh/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'hop_tu_naa');
check('the Commonplace Book has its own Hop-tu-Naa, 31 October', cal && cal.month === 10 && cal.day === 31 && /Isle of Man/.test(cal.text) && /Moore/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'hop_tu_naa_moots');
check('Juan and Breesha Quayle, dated by it, for two days', c && c.when && c.when.calendar === 'hop_tu_naa' && c.when.days === 2 && c.steps[0].rite === 'hop_tu_naa');
check('the practical half: a grown-up cuts, away from the body; a battery light; off the doorstep; costumes marked safe, no candle in costume; never left alone', /grown-up does the knife work/.test(c.resolution) && /away from the body/.test(c.resolution) && /battery light/.test(c.resolution) && /off the doorstep/.test(c.resolution) && /marked safe for children/.test(c.resolution) && /shouldn't carry a candle at all/.test(c.resolution) && /never leave a lit moot burning on its own/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Juan'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Juan', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'juan'; h.accounts.juan = {}; h.playerProgress.juan = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 9, 31, 12), Date.UTC(2027, 10, 1, 12)].map(offered);
  check('on Hollantide Eve they come first, a Samhain caller after them', days.every((o) => o[0] === 'hop_tu_naa_moots' && o.length === 3 && CALLERS.find((x) => x.id === o[1]).season === 'samhain'), days);
  const outside = [Date.UTC(2027, 9, 30, 12), Date.UTC(2027, 10, 3, 12), Date.UTC(2027, 3, 30, 12)].map(offered);
  check('on other days they never come', outside.every((o) => !o.includes('hop_tu_naa_moots') && o.length === 3), outside);
  at(Date.UTC(2027, 9, 31, 12), () => {
    h.accounts.juan.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.juan, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'hop_tu_naa');
  check('…and writes Hop-tu-Naa into The Turning Year, dated 31 October, just before Souling', e && e.met && /· Hollantide Eve$/.test(e.title) && e.date === '31 October' && ch.entries.findIndex((x) => x.id === 'soul_cakes') === ch.entries.findIndex((x) => x.id === 'hop_tu_naa') + 1);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
