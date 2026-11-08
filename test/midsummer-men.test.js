// Midsummer Men (Aubrey, 1680s, as Vickery gives it; Gerard, 1597; The
// Connoisseur and Hannah More, as Hone gives them, 1826; Brewer, 1895):
// Hester Bligh comes on Midsummer Eve, the Commonplace Book's own day (23 June,
// and the 24th), at the door with the fern-seed seeker, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-orpine-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { MIDSUMMER_MEN_RITES } = require('../data/midsummerMen.js');
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

const R = MIDSUMMER_MEN_RITES.midsummer_men;
check('Midsummer Men: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Aubrey: the maids, chinks and joists, slips by pairs, incline or recline, love or aversion, withering death', /"especially the Cooke mayds and Dayry-mayds"/.test(R.lore) && /"stick-up in some chinkes and joists, etc\., Midsommer-men, which are slips of Orpins\./.test(R.lore) && /according as the Orpin did incline to, or recline from ye other, that there would be love or aversion; if either did wither, death\."/.test(R.lore) && /Vickery/.test(R.source) && !/potsherd/.test(R.lore));
check('…Gerard on why it serves; The Connoisseur\'s two that turned together', /"This plant is very full of life; the stalks set onely in claie continue greene a long time"/.test(R.lore) && /"I likewise stuck up two Midsummer Men, one for myself and one for him… his blowed and turned to mine\."/.test(R.lore) && /Herball \(1597\), II\.138, p\. 415/.test(R.source));
check('…Hannah More\'s right or left, as Hone gives it; Brewer\'s later form; the Cawood ring', /"the bending of the leaves to the right, or to the left"/.test(R.lore) && /"whether her lover was true or false"/.test(R.lore) && /24 June, cols\. 849–52/.test(R.source) && /"If the leaves bent to the right, it was a sign of fidelity"/.test(R.lore) && /"two Orpine plants joined by a true-love knot"/.test(R.lore) && !/Sawston/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'midsummer_men');
check('the Commonplace Book\'s Midsummer Men: in pairs first (Aubrey), right and left later; Brewer\'s words kept', cal && cal.month === 6 && cal.day === 23 && /stuck up in pairs/.test(cal.text) && /Later one plant served/.test(cal.text) && /Aubrey/.test(cal.source) && cal.quote === 'If the leaves bent to the right, it was a sign of fidelity');
const c = CALLERS.find((x) => x.id === 'midsummer_men');
check('Hester Bligh, dated by it, for two days', c && c.when && c.when.calendar === 'midsummer_men' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'midsummer_men');
check('the practical half: only he can tell you; say it plainly; control is not love, the helpline 0808 2000 247; pick, never pull up, one in twenty, or grow a cutting', /only he can/.test(c.resolution) && /what you've noticed, and how it makes you feel/.test(c.resolution) && /that isn't love but control/.test(c.resolution) && /0808 2000 247/.test(c.resolution) && /never pull up the plant/.test(c.resolution) && /one in twenty/.test(c.resolution) && /from a cutting/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Hester'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Hester', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'hester'; h.accounts.hester = {}; h.playerProgress.hester = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 5, 23, 12), Date.UTC(2027, 5, 24, 12)].map(offered);
  check('on Midsummer Eve and the 24th she and the fern-seed seeker both come first', days.every((o) => o.length === 3 && o.slice(0, 2).sort().join() === 'fern_seed_eve,midsummer_men'), days);
  const outside = [Date.UTC(2027, 5, 22, 12), Date.UTC(2027, 5, 25, 12), Date.UTC(2027, 11, 23, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('midsummer_men') && o.length === 3), outside);
  at(Date.UTC(2027, 5, 23, 12), () => {
    h.accounts.hester.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.hester, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'midsummer_men');
  check('…and writes Midsummer Men into The Turning Year, dated 23 June', e && e.met && /· Midsummer Eve$/.test(e.title) && e.date === '23 June' && ch.entries.findIndex((x) => x.id === 'midsummer_men') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
