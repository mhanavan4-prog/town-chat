// Well-dressing at Tissington (Lysons, 1817; Rhodes and Hone, 1826; Chambers,
// 1864, on the drought of 1615): Hannah Brindley comes on Ascension Day as the
// Commonplace Book reckons it (forty days after Easter, a Thursday), and the
// Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-wells-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { WELL_RITES } = require('../data/wellDressing.js');
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

const R = WELL_RITES.well_dressing;
check('dressing the well: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Lysons, 1817: the devices and inscriptions, the clay boards, the petal mosaic', /"an annual custom at Tissington, of dressing the wells or springs"/.test(R.lore) && /"are adorned with flowers, arranged in various devices, and accompanied with inscriptions"/.test(R.lore) && /"boards cut to the size and form of the subject intended to be represented, and covered with moist clay"/.test(R.lore) && /"the petals of flowers forming a sort of mosaic-work"/.test(R.lore) && /pp\. ccxli–ccxlii/.test(R.source));
check('…five wells, and the psalms, Epistle and Gospel, one at each', /"of which there are five, of remarkably clear water"/.test(R.lore) && /"the three Psalms for the day, with the Epistle and Gospel, are read, one at each well"/.test(R.lore));
check('…Rhodes\'s well-flowering and Hone\'s red daisies', /"well-flowering"/.test(R.lore) && /"red daisies, and none else"/.test(R.lore) && /Every-Day Book, vol\. II \(1827\), 4 May/.test(R.source));
check('…the origin unknown: the 1615 drought as Chambers gives it, and the Black Death called out as without early source', /Why it began nobody knows/.test(R.lore) && /"There was no rayne fell upon the earth from the 25th day of March till the 2nd day of May"/.test(R.lore) && /Youlgreave register/.test(R.lore) && /Black Death has no early source/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'well_dressing');
check('the Commonplace Book\'s Ascension Day: five wells, psalms, Epistle and Gospel, no Black Death; forty days after Easter', cal && /five wells/.test(cal.text) && /the Epistle and the Gospel/.test(cal.text) && !/Black Death/.test(cal.text) && cal.quote === 'the petals of flowers forming a sort of mosaic-work' && entryDate(cal, 2027).join('/') === '5/6' && entryDate(cal, 2026).join('/') === '5/14' && new Date(Date.UTC(2027, 4, 6)).getUTCDay() === 4);
const c = CALLERS.find((x) => x.id === 'well_dressing');
check('Hannah Brindley, dated by it, for two days', c && c.when && c.when.calendar === 'well_dressing' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'well_dressing');
check('the practical half: you can\'t tell by looking; don\'t drink it untreated; the council tests it; children and a grille; pick, never dig, one in twenty', /you can't tell by looking/.test(c.resolution) && /Don't drink it untreated/.test(c.resolution) && /have the council test it/.test(c.resolution) && /stout grille/.test(c.resolution) && /never dig a plant up/.test(c.resolution) && /one flower in twenty/.test(c.resolution) && /UKHSA/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Hannah'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Hannah', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'hannah'; h.accounts.hannah = {}; h.playerProgress.hannah = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 4, 6, 12), Date.UTC(2027, 4, 7, 12), Date.UTC(2028, 4, 25, 12)].map(offered);
  check('on Ascension Day (6 May 2027, 25 May 2028) and the day after she comes first', days.every((o) => o[0] === 'well_dressing' && o.length === 3), days);
  const outside = [Date.UTC(2027, 4, 5, 12), Date.UTC(2027, 4, 8, 12), Date.UTC(2028, 4, 6, 12)].map(offered);
  check('on other days, last year\'s day among them, she never comes', outside.every((o) => !o.includes('well_dressing') && o.length === 3), outside);
  at(Date.UTC(2027, 4, 6, 12), () => {
    h.accounts.hannah.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.hannah, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'well_dressing');
  check('…and writes Dressing the Well into The Turning Year, moving with Easter', e && e.met && /· Ascension Day$/.test(e.title) && e.date === 'moves with Easter' && ch.entries.findIndex((x) => x.id === 'well_dressing') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
