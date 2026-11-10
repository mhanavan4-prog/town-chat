// St Crispin's Day (the First Folio, 1623; Deloney's Gentle Craft; Hone,
// 1826; Chambers, 1864): Davy Tegg, a shoemaker's apprentice, comes on the
// Commonplace Book's own day (25 October, and the 26th), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-crispin-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CRISPIN_RITES } = require('../data/stCrispin.js');
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

const R = CRISPIN_RITES.st_crispin;
check('the gentle craft: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the legend after Butler: Soissons, shoes by night, about 287; Deloney\'s Feversham and the proverb', /"worked with their hands in the night, making shoes"/.test(R.lore) && /"finished their course by the sword about the year 287"/.test(R.lore) && /"a Shoomaker in Feversham"/.test(R.lore) && /"A Shoomakers sonne is a Prince borne\."/.test(R.lore) && /Deloney/.test(R.source));
check('…Agincourt, and the First Folio\'s words, "Crispine Crispian"', /Agincourt was fought on their day in 1415/.test(R.lore) && /"This day is call'd the Feast of Crispian… And Crispine Crispian shall ne're goe by, \/ From this day to the ending of the World, \/ But we in it shall be remembred"/.test(R.lore) && /First Folio \(1623\)/.test(R.source));
check('…Chambers\'s procession; the cordwainers\' tavern; Tenby\'s effigy, the will at each craftsman\'s door, the stuffing for a football', /"a grand procession of the brethren of the craft with banners and music, whilst various characters representing King Crispin and his court were sustained by different members"/.test(R.lore) && /"a good tavern"/.test(R.lore) && /"last will and testament"/.test(R.lore) && /"the padding which formed the body of the effigy was made into a football"/.test(R.lore) && !/lance/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'st_crispin');
check('the Commonplace Book\'s St Crispin: every craftsman\'s door, the stuffing a football; the Folio\'s capital and Shakespeare cited', cal && cal.month === 10 && cal.day === 25 && /every craftsman's door/.test(cal.text) && /its stuffing made into a football/.test(cal.text) && !/kicked about the town/.test(cal.text) && cal.quote === "This day is call'd the Feast of Crispian" && /First Folio/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'st_crispin');
check('Davy Tegg, dated by it, for two days', c && c.when && c.when.calendar === 'st_crispin' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'st_crispin');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Davy'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Davy', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'davy'; h.accounts.davy = {}; h.playerProgress.davy = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 9, 25, 12), Date.UTC(2027, 9, 26, 12)].map(offered);
  check('on St Crispin\'s Day and the 26th he comes first', days.every((o) => o[0] === 'st_crispin' && o.length === 3), days);
  const outside = [Date.UTC(2027, 9, 24, 12), Date.UTC(2027, 9, 27, 12), Date.UTC(2027, 3, 25, 12)].map(offered);
  check('on other days, St Mark\'s among them, he never comes', outside.every((o) => !o.includes('st_crispin') && o.length === 3), outside);
  at(Date.UTC(2027, 9, 25, 12), () => {
    h.accounts.davy.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.davy, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'st_crispin');
  check('…and writes the Gentle Craft into The Turning Year, dated 25 October', e && e.met && /· St Crispin's Day$/.test(e.title) && e.date === '25 October' && ch.entries.findIndex((x) => x.id === 'st_crispin') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
