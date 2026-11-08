// St James's Day, the first oysters (Chambers, 1864; Hone, 1826 and 1827;
// Buttes, 1599): Polly Briggs comes on the Commonplace Book's own day
// (25 July, and the 26th), with a practical half on raw shellfish, norovirus
// and a shucking cut (the FSA; NHS 111 Wales; nidirect); and the Charm Book.
// The old calendar is put right: Hone moves the oysters to Old St James's
// Day, 5 August.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-james-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { JAMES_RITES } = require('../data/stJames.js');
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

const R = JAMES_RITES.st_james;
check('the First Oysters: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Chambers: the proverb, the oysters "somewhat dearer", the "jocular encouragement"; Hone\'s "vulgar superstition" and his own correction to 5 August', /"Whoever eats oysters on St\. James's Day, will never want money,"/.test(R.lore) && /"it is customary in London to begin eating oysters on St\. James's Day, when they are necessarily somewhat dearer than afterwards"/.test(R.lore) && /"only meant as a jocular encouragement to a little piece of extravagance"/.test(R.lore) && /"a vulgar superstition"/.test(R.lore) && /"It is on this day, and not on St\. James's day new style"/.test(R.lore) && /5 August/.test(R.lore));
check('…the grottoes: the candle, "Mind the grotto!", Hone\'s rhyme; the pilgrims\' scallop; Buttes\'s R rule, 1599, and July has none', /"with a candle stuck in the top"/.test(R.lore) && /'Mind the grotto!'/.test(R.lore) && /"A grotto comes but once a year!"/.test(R.lore) && /"a scallop shell worn on the cloak or hat"/.test(R.lore) && /Henry Buttes's, in 1599: "It is vnseasonable and vnholesome in all monethes, that haue not the letter R\. in their name"/.test(R.lore) && /July has none/.test(R.lore) && !/Butler/.test(R.lore) && /Buttes/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'st_james');
check('the Commonplace Book\'s St James, put right: Old St James\'s Day, 5 August, the grottoes; Chambers\'s proverb kept, Hone cited', cal && cal.month === 7 && cal.day === 25 && /Old St James's Day, 5 August/.test(cal.text) && /'Mind the grotto!'/.test(cal.text) && cal.quote === "Whoever eats oysters on St. James's Day, will never want money." && /5 August/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'st_james');
check('Polly Briggs, from Billingsgate, dated by it, for two days', c && /Billingsgate/.test(c.caller) && c.when && c.when.calendar === 'st_james' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'st_james');
check('the practical half: a reputable fishmonger and classified waters; who should not eat raw shellfish, and why', /Then the practical half/.test(c.resolution) && /Buy oysters from a reputable fishmonger/.test(c.resolution) && /classified waters/.test(c.resolution) && /Older people, pregnant women, very young children and anyone who is unwell should not eat raw or lightly cooked shellfish, because it can be hard to get viruses out of live shellfish/.test(c.resolution) && /Food Standards Agency/.test(c.source));
check('…norovirus: soap and water, gel doesn\'t kill it, two days off, 111 if drying out; a shucking cut pressed, A&E if it won\'t stop', /wash hands with soap and water, because alcohol gel doesn't kill norovirus/.test(c.resolution) && /stay off work or school until two days after it stops; ring 111 if someone is drying out/.test(c.resolution) && /press a clean, dry cloth on the cut for several minutes, and go to A&E if it won't stop bleeding/.test(c.resolution) && /NHS 111 Wales/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Polly'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Polly', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'polly'; h.accounts.polly = {}; h.playerProgress.polly = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('st_james');
  const days = [Date.UTC(2027, 6, 25, 12), Date.UTC(2027, 6, 26, 12)].map(offered);
  check('on St James\'s Day and the 26th she comes first', days.every(leads), days);
  const outside = [Date.UTC(2027, 6, 24, 12), Date.UTC(2027, 6, 27, 12), Date.UTC(2027, 7, 5, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('st_james') && o.length === 3), outside);
  at(Date.UTC(2027, 6, 25, 12), () => {
    h.accounts.polly.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.polly, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'st_james');
  check('…and writes the First Oysters into The Turning Year, dated 25 July', e && e.met && /· St James's Day$/.test(e.title) && e.date === '25 July' && ch.entries.findIndex((x) => x.id === 'st_james') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
