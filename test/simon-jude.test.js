// St Simon and St Jude, the rainy day (Hone, 1827; The Roaring Girl, 1611;
// Holinshed, 1587): Martha Pickering comes on the Commonplace Book's own day
// (28 October, and the 29th), with a practical half on flood water (GOV.UK;
// SEPA; UKHSA); and the Charm Book. The old calendar is put right: the
// chronicle gives no saint's day for Doncaster, 1536.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-simon-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { SIMON_JUDE_RITES } = require('../data/simonJude.js');
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

const R = SIMON_JUDE_RITES.simon_jude;
check('Simon and Jude\'s Rain: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Hone\'s "as rainy as St. Swithin\'s"; Trapdoor\'s whole line, "next" and all; Jack Dapper\'s pancakes', /"This anniversary was deemed as rainy as St\. Swithin's,"/.test(R.lore) && /"As well as I know 'twill rain upon Simon and Jude's day next"/.test(R.lore) && /"a continual Simon and Jude's rain"/.test(R.lore) && /"Beat all your feathers as flat down as pancakes"/.test(R.lore) && /Roaring Girl \(1611\)/.test(R.source));
check('…Hone\'s Doncaster "on the eve of this day", and Holinshed\'s own, with no saint\'s day: a small rain, and the Don rising', /"on the eve of this day in 1536, when a battle was to have been fought"/.test(R.lore) && /"there fell so great a rain"/.test(R.lore) && /"there fell a raine not great to speake of, but yet as it were by miracle, the riuer of Dun rose suddenlie"/.test(R.lore) && /with no saint's day/.test(R.lore) && /27 October/.test(R.lore) && /Holinshed/.test(R.source) && !/intrude/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'simon_jude');
check('the Commonplace Book\'s day, put right: Hone ties it, the chronicle gives no saint\'s day; Trapdoor quoted whole, the play cited', cal && cal.month === 10 && cal.day === 28 && /Hone ties it to 1536/.test(cal.text) && /no saint's day/.test(cal.text) && !/Holinshed says rain on its eve/.test(cal.text) && cal.quote === "As well as I know 'twill rain upon Simon and Jude's day next" && /Roaring Girl/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'simon_jude');
check('Martha Pickering, by the ford, dated by it, for two days', c && /ford/.test(c.caller) && c.when && c.when.calendar === 'simon_jude' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'simon_jude');
check('the practical half: not through flood water, 15cm and 30cm; sewage and hidden holes, wash hands', /Then the practical half/.test(c.resolution) && /Don't walk, ride or drive through flood water: 15cm of flowing water could knock over an adult, and 30cm could move the average family car/.test(c.resolution) && /may carry sewage and hide holes/.test(c.resolution) && /wash your hands after touching it/.test(c.resolution));
check('…flood warnings and Floodline\'s number; gas, electricity and water off if safe, no switch in water; 999 in danger', /Sign up for free flood warnings by text, phone or email, or ring Floodline on 0345 988 1188, day or night/.test(c.resolution) && /turn off the gas, electricity and water if it's safe, and never touch an electrical switch while you're standing in water/.test(c.resolution) && /ring 999 if anyone is in immediate danger/.test(c.resolution) && /GOV\.UK/.test(c.source) && /SEPA/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Martha'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Martha', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'martha'; h.accounts.martha = {}; h.playerProgress.martha = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('simon_jude');
  const days = [Date.UTC(2027, 9, 28, 12), Date.UTC(2027, 9, 29, 12)].map(offered);
  check('on St Simon and St Jude\'s Day and the 29th she comes first', days.every(leads), days);
  const outside = [Date.UTC(2027, 9, 27, 12), Date.UTC(2027, 9, 30, 12), Date.UTC(2027, 8, 1, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('simon_jude') && o.length === 3), outside);
  at(Date.UTC(2027, 9, 28, 12), () => {
    h.accounts.martha.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.martha, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'simon_jude');
  check('…and writes the Simon and Jude\'s Rain into The Turning Year, dated 28 October', e && e.met && /· St Simon and St Jude$/.test(e.title) && e.date === '28 October' && ch.entries.findIndex((x) => x.id === 'simon_jude') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
