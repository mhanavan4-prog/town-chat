// St Peter's Eve (Stow, 1603; the Newcastle cooks' ordinary of 1575, as Dyer
// quotes Brand; Borlase, 1754; Courtney, 1890): Jacky Pengelly comes on the
// Commonplace Book's own day (28 June, and the 29th), and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-peter-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { PETER_RITES } = require('../data/stPetersEve.js');
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

const R = PETER_RITES.st_peters_eve;
check('St Peter\'s fire: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Stow, 1603, in his spelling: the vigils, the wood, the sweet bread, amity and the air', /"In the Moneths of Iune, and Iuly, on the Vigiles of festiuall dayes"/.test(R.lore) && /"euery man bestowing wood or labour towards them"/.test(R.lore) && /"furnished with sweete breade, and good drinke"/.test(R.lore) && /"These were called Bonefiers aswell of good amitie amongest neighbours … as also for the vertue that a great fire hath to purge the infection of the ayre\."/.test(R.lore) && /"Watches in London"/.test(R.source));
check('…Newcastle, 1575: the Sand-hill, the two fires, and St Peter\'s only if the Mayor and Aldermen please', /according to the auntient custome of the said towne on the Sand-hill/.test(R.lore) && /the other on the even of the Feast of St\. Peter the Apostle, if it shall please the Maior and Aldermen of the said towne for the time being to have the same bone-fires\."/.test(R.lore) && /i\. 318/.test(R.source) && /Dyer/.test(R.source));
check('…Borlase and Courtney\'s west Penwith tar-barrels on both eves; Polperro\'s beach pile and the begging fishermen', /"the festival fires, called bonfires, are kindled on the eve of St\. John the Baptist and St\. Peter's Day"/.test(R.lore) && /"In Penzance, and in nearly all the parishes of West Penwith, immediately after nightfall on the eves of St\. John and St\. Peter, the 23rd and 28th of June, lines of tar-barrels, occasionally broken by bonfires, were simultaneously lighted in all the streets\."/.test(R.lore) && /"a large pile of faggots and tar-barrels is built on the beach"/.test(R.lore) && /"go from house to house and beg money"/.test(R.lore) && !/Hone/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'st_peters_eve');
check('the Commonplace Book\'s St Peter\'s Eve: the Sand-hill, "if the Mayor and Aldermen pleased", Cornwall\'s tar-barrels; the quote as Dyer prints it', cal && cal.month === 6 && cal.day === 28 && /Sand-hill/.test(cal.text) && /if the Mayor and Aldermen pleased/.test(cal.text) && /tar-barrels/.test(cal.text) && cal.quote === 'the other on the even of the Feast of St. Peter the Apostle' && /Courtney/.test(cal.source));
const c = CALLERS.find((x) => x.id === 'st_peters_eve');
check('Jacky Pengelly, dated by it, for two days', c && c.when && c.when.calendar === 'st_peters_eve' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'st_peters_eve');
check('the practical half: no fires in the countryside, barbecues where signs say; 999 for an unwatched fire; on a beach water not sand, never bury it; the burn', /don't light fires, and have a barbecue only where the signs say you can/.test(c.resolution) && /ring 999/.test(c.resolution) && !/find out first/.test(c.resolution) && /put a fire out with water/.test(c.resolution) && /never bury a fire or a barbecue in sand/.test(c.resolution) && /cool running water for twenty minutes/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Jacky'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Jacky', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'jacky'; h.accounts.jacky = {}; h.playerProgress.jacky = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [Date.UTC(2027, 5, 28, 12), Date.UTC(2027, 5, 29, 12)].map(offered);
  check('on St Peter\'s Eve and the 29th he comes first', days.every((o) => o[0] === 'st_peters_eve' && o.length === 3), days);
  const outside = [Date.UTC(2027, 5, 27, 12), Date.UTC(2027, 5, 30, 12), Date.UTC(2027, 5, 23, 12)].map(offered);
  check('on other days, Midsummer Eve among them, he never comes', outside.every((o) => !o.includes('st_peters_eve') && o.length === 3), outside);
  at(Date.UTC(2027, 5, 28, 12), () => {
    h.accounts.jacky.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.jacky, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'st_peters_eve');
  const order = ch.entries.map((x) => x.id);
  check('…and writes St Peter\'s Fire into The Turning Year, dated 28 June, after the Midsummer Men', e && e.met && /· St Peter's Eve$/.test(e.title) && e.date === '28 June' && order.indexOf('st_peters_eve') > order.indexOf('midsummer_men') && order.indexOf('st_peters_eve') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
