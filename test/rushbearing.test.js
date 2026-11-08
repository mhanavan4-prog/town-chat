// The Rush-bearing at Ambleside (The Gentleman's Magazine, 1823 and 1843; St
// Mary at Hill's accounts, 1493–4; Bates, 1907; Gilbert White on rushlights,
// 1775): Annie Fleming comes on the Commonplace Book's own day, which is now
// the first Saturday in July (26 July was the Saturday of 1823), and the
// Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-rush-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { RUSH_RITES } = require('../data/rushbearing.js');
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

const R = RUSH_RITES.rushbearing;
check('the rush-bearing: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Ambleside, 1823: the forty girls, the band, the bearings round the pulpit', /"On the 26th and 27th of July"/.test(R.lore) && /"young girls, to the number of about forty, formed the procession to the Church, preceded by a band of music"/.test(R.lore) && /"round the pulpit, reading-desks, pews, &c\."/.test(R.lore) && /\(1823\), pt 2, p\. 173/.test(R.source));
check('…the strewn floor and the gingerbread, 1843; rushes paid for in 1493–4', /"is annually strown with rushes"/.test(R.lore) && /"The children receive a penny-worth of gingerbread, and a small gratuity at the door of the church"/.test(R.lore) && /"payd for ij burdens of Russhys for þe newe pewys, iij d\."/.test(R.lore) && /Littlehales/.test(R.source));
check('…1906\'s harps and crosses, Owen Lloyd\'s hymn; and no St Anne\'s rule', /"harps of reeds and waterlilies, crosses of ferns and harebells, shepherds' crooks wound with heather"/.test(R.lore) && /Owen Lloyd/.test(R.lore) && /Bates/.test(R.source) && !/St Anne/.test(R.lore + R.how));
const cal = OLD_CALENDAR.find((e) => e.key === 'rushbearing');
check('the Commonplace Book\'s rush-bearing now moves: the first Saturday in July', cal && cal.rule && cal.moves === 'the first Saturday in July' && [2026, 2027, 2028, 2029].map((y) => entryDate(cal, y).join('/')).join() === '7/4,7/3,7/1,7/7' && /In 1823 it fell on 26 July/.test(cal.text));
const c = CALLERS.find((x) => x.id === 'rushbearing_ambleside');
check('Annie Fleming, dated by it, for two days', c && c.when && c.when.calendar === 'rushbearing' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'rushbearing');
check('the practical half: cut, never uproot; ask the landowner; the nesting birds, April to June; White\'s rushlight; the naked flame', /never pull them up: uprooting a wild plant is against the law/.test(c.resolution) && /so ask first/.test(c.resolution) && /from April to June/.test(c.resolution) && /a nest in use is protected/.test(c.resolution) && /'one regular, narrow, even rib'/.test(c.resolution) && /never leave one burning in an empty room/.test(c.resolution) && /put it out before you sleep/.test(c.resolution) && /Selborne/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Annie'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Annie', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'annie'; h.accounts.annie = {}; h.playerProgress.annie = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 6, 3, 12), Date.UTC(2027, 6, 4, 12), Date.UTC(2029, 6, 7, 12)].map(offered);
  check('on the Saturday (and the Sunday after) she comes first', days.every((o) => o[0] === 'rushbearing_ambleside' && o.length === 3), days);
  const outside = [Date.UTC(2027, 6, 2, 12), Date.UTC(2027, 6, 5, 12), Date.UTC(2027, 6, 26, 12), Date.UTC(2029, 6, 1, 12)].map(offered);
  check('on other days, 26 July among them, she never comes', outside.every((o) => !o.includes('rushbearing_ambleside') && o.length === 3), outside);
  at(Date.UTC(2027, 6, 3, 12), () => {
    h.accounts.annie.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.annie, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'rushbearing');
  check('…and writes the Rush-bearing into The Turning Year, dated as it moves', e && e.met && /· Ambleside$/.test(e.title) && e.date === 'the first Saturday in July' && ch.entries.findIndex((x) => x.id === 'rushbearing') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
