// The mop, or statute fair (the Statute of Artificers, 1563; Pare, in Hone's
// Table Book, 1827; Howitt, 1840; Jefferies, 1872): Sam Hewins comes at Old
// Michaelmas as the Commonplace Book now keeps it (11 October, as Hone has
// it), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-mop-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { MOP_RITES } = require('../data/mopFair.js');
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

const R = MOP_RITES.mop_fair;
check('standing at the mop: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the Statute of Artificers, 1563: hired for a whole year', /"for any lesse tyme or terme then for one hole yere"/.test(R.lore) && /5 Eliz\. c\. 4 \(1563\), s\. II/.test(R.source));
check('Pare, 1827: the signs in the hats; the girls with none; the earnest; the ribbons', /"a waggoner, or ploughboy, had a piece of whipcord in his hat… a cow-man… had some cow-hair… a piece of sponge; a shepherd had wool; a gardener had flowers"/.test(R.lore) && /"stood not unlike cattle at a fair waiting for dealers"/.test(R.lore) && /"'earnest money,' which is usually one shilling"/.test(R.lore) && /"When the hiring is over, the emblems in the hats are exchanged for ribbons of almost every hue\."/.test(R.lore) && /Table Book, vol\. I \(1827\), cols\. 171–78/.test(R.source));
check('…Howitt\'s fastening-penny and horse-cheapening; the runaway mops; Jefferies\'s complaint', /"the Fastening-penny, from its formerly being a penny, though now a shilling"/.test(R.lore) && /"cheapening them much as they would cheapen a horse"/.test(R.lore) && /Runaway Mops/.test(R.lore) && /"Many an honest, hard-working servant-girl owes her ruin to these fatal mops and fairs\."/.test(R.lore));
check('…Old Michaelmas on 11 October, and no maid\'s mop or Hardy', /"these statutes are held about Old Michaelmas-day"/.test(R.lore) && /11 October/.test(R.lore) && !/Hardy|Casterbridge/.test(R.lore) && !/maid.{0,20}mop|mop.{0,20}maid/i.test(R.lore + R.how));
const cal = OLD_CALENDAR.find((e) => e.key === 'mop_fair');
check('the Commonplace Book\'s mop now on 11 October, badged record, signs in the hats and no mop or pail', cal && cal.month === 10 && cal.day === 11 && cal.tier === 'record' && /whipcord for a carter/.test(cal.text) && !/a pail, a mop/.test(cal.text) && /Pare/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'mop_fair');
check('Sam Hewins, dated by it, for two days', c && c.when && c.when.calendar === 'mop_fair' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'mop_fair');
check('the practical half: the main terms in writing on the first day, the rest within two months; the minimum wage for farm work; 5.6 weeks\' holiday; the signs of exploitation and the helpline', /the main terms in writing on your first day, and the rest within two months/.test(c.resolution) && /at least the National Minimum Wage/.test(c.resolution) && /5\.6 weeks' paid holiday/.test(c.resolution) && /keeps your papers/.test(c.resolution) && /work it off/.test(c.resolution) && /08000 121 700/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Sam'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Sam', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'sam'; h.accounts.sam = {}; h.playerProgress.sam = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 9, 11, 12), Date.UTC(2027, 9, 12, 12)].map(offered);
  check('at Old Michaelmas and the 12th he comes first', days.every((o) => o[0] === 'mop_fair' && o.length === 3), days);
  const outside = [Date.UTC(2027, 9, 10, 12), Date.UTC(2027, 9, 13, 12), Date.UTC(2027, 8, 29, 12)].map(offered);
  check('on other days, Michaelmas itself among them, he never comes', outside.every((o) => !o.includes('mop_fair') && o.length === 3), outside);
  at(Date.UTC(2027, 9, 11, 12), () => {
    h.accounts.sam.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.sam, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'mop_fair');
  check('…and writes Standing at the Mop into The Turning Year, dated 11 October', e && e.met && /· Old Michaelmas$/.test(e.title) && e.date === '11 October' && ch.entries.findIndex((x) => x.id === 'mop_fair') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
