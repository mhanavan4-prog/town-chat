// Hunting the gowk (Hone, 1826, after Brand; Jamieson, 1808; Ramsay, 1728;
// Dawks's News-Letter, 1698): Elspeth Reid comes on the first of April, the
// Commonplace Book's own day (and the 2nd), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-gowk-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { GOWK_RITES } = require('../data/huntTheGowk.js');
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

const R = GOWK_RITES.hunt_the_gowk;
check('hunting the gowk: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Hone, 1826: from place to place with the letter; the rhyme; the April gowk', /"from place to place by means of a letter, in which is written \/ 'On the first day of April \/ Hunt the gowk another mile\.'"/.test(R.lore) && /"This is called 'hunting the gowk;' and the bearer of the 'fools' errand' is called an 'April gowk\.'"/.test(R.lore) && /cols\. 411–12/.test(R.source));
check('…Brand\'s cuckoo, Jamieson\'s fool and cuckoo, Ramsay\'s Hermes', /"says, that gowk is properly a cuckoo, and is used here metaphorically for a fool"/.test(R.lore) && /"To hunt the gowk, to go on a fool's errand"/.test(R.lore) && /"here to hunt the Gowk"/.test(R.lore) && /Jamieson/.test(R.source));
check('…the passing-on given as later; Aubrey, the Tower lions, the noon rule; no Chaucer, no "Dinna laugh"', /Later tellers have each reader send the bearer on/.test(R.lore) && /"Fooles holy day"/.test(R.lore) && /"to see the Lions washed"/.test(R.lore) && /stopped at noon/.test(R.lore) && !/Chaucer|Dinna/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'hunt_the_gowk');
check('the Commonplace Book\'s gowk: from place to place, not house to house; cuckoo and fool', cal && cal.month === 4 && cal.day === 1 && /from place to place/.test(cal.text) && !/each reader/.test(cal.text) && /a cuckoo, and a fool/.test(cal.text) && cal.quote === 'On the first day of April / Hunt the gowk another mile');
const c = CALLERS.find((x) => x.id === 'hunt_the_gowk');
check('Elspeth Reid, dated by it, for two days', c && c.when && c.when.calendar === 'hunt_the_gowk' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'hunt_the_gowk');
check('the practical half: only a joke if the gowk laughs; when it becomes bullying; before noon; no false messages, 7726; past the headline', /only a joke if the gowk laughs too/.test(c.resolution) && /become bullying, whether anyone meant it or not/.test(c.resolution) && /before noon/.test(c.resolution) && /never send one for a joke/.test(c.resolution) && /7726/.test(c.resolution) && /Read past the headline/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Elspeth'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Elspeth', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'elspeth'; h.accounts.elspeth = {}; h.playerProgress.elspeth = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  // In 2027 Good Friday is 26 March and Easter 28 March, so the first of April is free of other dated callers.
  const days = [Date.UTC(2027, 3, 1, 12), Date.UTC(2027, 3, 2, 12)].map(offered);
  check('on the first of April and the 2nd she comes first', days.every((o) => o[0] === 'hunt_the_gowk' && o.length === 3), days);
  const outside = [Date.UTC(2027, 2, 31, 12), Date.UTC(2027, 3, 3, 12), Date.UTC(2027, 9, 1, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('hunt_the_gowk') && o.length === 3), outside);
  // When Good Friday falls on 1 April (Easter on 3 April, as in 2067), both dated callers come first.
  const gf = offered(Date.UTC(2067, 3, 1, 12));
  check('…and on a 1 April that is Good Friday too, both come before anyone else', gf.includes('hunt_the_gowk') && gf.filter(dated).length >= 2 && gf.slice(0, gf.filter(dated).length).every(dated), gf);
  at(Date.UTC(2027, 3, 1, 12), () => {
    h.accounts.elspeth.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.elspeth, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'hunt_the_gowk');
  check('…and writes Hunting the Gowk into The Turning Year, dated 1 April', e && e.met && /· 1 April$/.test(e.title) && e.date === '1 April' && ch.entries.findIndex((x) => x.id === 'hunt_the_gowk') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
