// The Cream of the Well (The Edinburgh Magazine, 1800; Mackinlay, 1893;
// Crombie, 1893; Mowat, 1921; the Fife slander of 1723, as the Scottish
// National Dictionary quotes it): Isobel Rennie comes on New Year's morning,
// the Commonplace Book's own day (1 January, and the 2nd), at the door with the
// calennig children, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-cream-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CREAM_RITES } = require('../data/creamOfTheWell.js');
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

const R = CREAM_RITES.cream_of_the_well;
check('creaming the well: badged folk, three signs that fit the Board', R && R.tier === 'folk' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('1800\'s flower of the well; Mackinlay\'s ream or cream and the maidens\' couplet', /"that they may get the flower, as it is called, or the first pail-full of water from the well"/.test(R.lore) && /"Whoever secured the first pailful was said to get the flower of the well, otherwise known as the ream or cream of the well,"/.test(R.lore) && /"The flower o' the well to our house gaes, An' I'll the bonniest lad get\."/.test(R.lore) && /Mackinlay/.test(R.source));
check('…Mowat\'s wisp of straw; Crombie\'s creaming the well', /A wisp of straw was left in the well to indicate to the next comer that the well had already been 'creamed\.'"/.test(R.lore) && /"almost universally the first thing done on New Year's Day morning"/.test(R.lore));
check('…the Fife case of 1723 as a slander, on Rood-day, not New Year', /slandered her/.test(R.lore) && /"went to nine wells on the Road-day morning … to take away her neighbour's milk"/.test(R.lore) && /that was Rood-day, not New Year, and she was the one wronged/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'cream_of_the_well');
check('the Commonplace Book\'s Cream of the Well: no longer an accusation, the slander on Rood-day; the straw; badged folk; the couplet', cal && cal.month === 1 && cal.day === 1 && !/was accused/.test(cal.text) && /slandered/.test(cal.text) && /Rood-day/.test(cal.text) && /wisp of straw/.test(cal.text) && cal.tier === 'folk' && cal.quote === "The flower o' the well to our house gaes");
const c = CALLERS.find((x) => x.id === 'cream_of_the_well');
check('Isobel Rennie, dated by it, for two days', c && c.when && c.when.calendar === 'cream_of_the_well' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'cream_of_the_well');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Isobel'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Isobel', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'isobel'; h.accounts.isobel = {}; h.playerProgress.isobel = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 0, 1, 12), Date.UTC(2027, 0, 2, 12)].map(offered);
  check('on New Year\'s morning and the 2nd she and the calennig children both come first', days.every((o) => o.length === 3 && o.slice(0, 2).sort().join() === 'calennig_children,cream_of_the_well'), days);
  const outside = [Date.UTC(2026, 11, 31, 12), Date.UTC(2027, 0, 3, 12), Date.UTC(2027, 4, 3, 12)].map(offered);
  check('on other days, Hogmanay and Rood-day among them, she never comes', outside.every((o) => !o.includes('cream_of_the_well') && o.length === 3), outside);
  at(Date.UTC(2027, 0, 1, 12), () => {
    h.accounts.isobel.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.isobel, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'cream_of_the_well');
  check('…and writes Creaming the Well into The Turning Year, the first of its dated days', e && e.met && /· New Year's morning$/.test(e.title) && e.date === '1 January' && ch.entries.findIndex((x) => x.id === 'cream_of_the_well') === 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
