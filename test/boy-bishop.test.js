// The Boy Bishop (Gregory, 1649, read in the 1649 text; Hone, 1826; Henry
// VIII's proclamation of 1541 as E. K. Chambers gives it; Machyn's diary):
// Mistress Ashby comes on St Nicholas' Day, the Commonplace Book's own day (6
// December, and the 7th), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-bishop-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { BISHOP_RITES } = require('../data/boyBishop.js');
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

const R = BISHOP_RITES.boy_bishop;
check('the Boy Bishop: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Gregory, 1649: chosen by his fellows on St Nicholas\' day, the state of a bishop till Innocents\'; Hone the same', /"The Episcopus Choristarum was a Chorister Bishop chosen by his fellow Children upon S\. Nicholas daie"/.test(R.lore) && /"From this daie till Innocents daie at night… The Episcopus Puerorum was to bear the name, and hold up the State of a Bishop\."/.test(R.lore) && /"Though the boy bishop's election was on the 6th of December, yet his office and authority lasted till the 28th, being Innocents' day\."/.test(R.lore) && /pp\. 95, 113–17/.test(R.source));
check('…not the same everywhere; Henry VIII\'s proclamation of 22 July 1541, in its words', /not the same everywhere/.test(R.lore) && /22 July 1541/.test(R.lore) && /children were "decked and apparalid to counterfaite priestes, bysshopps, and women" and led from house to house/.test(R.lore) && !/1542/.test(R.lore));
check('…Machyn\'s Sant Necolas of 1556; disuse under Elizabeth; the Salisbury effigy doubted; the revivals', /"Sant Necolas whentt a-brod in most partt in London syngyng after the old fassyon/.test(R.lore) && /"naturally fell again into disuse"/.test(R.lore) && /scholars now doubt it/.test(R.lore) && /1980s/.test(R.lore) && /Hereford revived the custom in 1973/.test(R.lore) && !/child bishop of Paul/i.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'boy_bishop');
check('the Commonplace Book\'s Boy Bishop: 1541, fell out of use under Elizabeth, Gregory quoted', cal && cal.month === 12 && cal.day === 6 && /suppressed it in 1541/.test(cal.text) && !/1542/.test(cal.text) && /under Elizabeth it fell out of use/.test(cal.text) && cal.quote === 'chosen by his fellow Children upon S. Nicholas daie' && /Gregory/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'boy_bishop');
check('Mistress Ashby, dated by it, for two days', c && c.when && c.when.calendar === 'boy_bishop' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'boy_bishop');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Ashby'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Ashby', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'ashby'; h.accounts.ashby = {}; h.playerProgress.ashby = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 11, 6, 12), Date.UTC(2027, 11, 7, 12)].map(offered);
  check('on St Nicholas\' Day and the 7th she comes first', days.every((o) => o[0] === 'boy_bishop' && o.length === 3), days);
  const outside = [Date.UTC(2027, 11, 5, 12), Date.UTC(2027, 11, 8, 12), Date.UTC(2027, 11, 28, 12)].map(offered);
  check('on other days, Childermas among them, she never comes', outside.every((o) => !o.includes('boy_bishop') && o.length === 3), outside);
  at(Date.UTC(2027, 11, 6, 12), () => {
    h.accounts.ashby.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.ashby, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'boy_bishop');
  check('…and writes the Boy Bishop into The Turning Year, dated 6 December', e && e.met && /· St Nicholas' Day$/.test(e.title) && e.date === '6 December' && ch.entries.findIndex((x) => x.id === 'boy_bishop') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
