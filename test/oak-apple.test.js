// Oak Apple Day, 29 May: the Restoration thanksgiving (Act of 1660, repealed
// 1859), oak for the Boscobel oak, and nettles for a lad without (Hone;
// Chambers, 1864; Andrews, 1891), a caller dated by the Commonplace Book's own
// entry (29 May, and the 30th), first at the door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-oak-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { OAK_RITES } = require('../data/oakApple.js');
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

const R = OAK_RITES.royal_oak;
check('the oak sprig: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the Act of 1660 in its own spelling, and its repeal in 1859', /"a Perpetuall Anniversary Thanksgiveing on the nine and twentyeth day of May"/.test(R.lore) && /"most memorable Birth day"/.test(R.lore) && /repealed in 1859/.test(R.lore) && /Statutes of the Realm, vol\. 5 \(1819\), p\. 237/.test(R.source));
check('…Boscobel: Worcester, 3 September 1651, Major Careless, and a descendant of the oak', /3 September 1651/.test(R.lore) && /William Careless/.test(R.lore) && /a descendant of the Royal Oak/.test(R.lore) && /English Heritage/.test(R.source));
check('…Hone\'s oak-leaves in hats and horses\' heads, and Chambers\'s loyalist\'s badge', /"It is usual with the vulgar people to wear oak-leaves in their hats on this day, and dress their horses' heads with them"/.test(R.lore) && /"A spray of oak in the hat was the badge of a loyalist"/.test(R.lore));
check('…the nettles of Derbyshire and the eggs of East Yorkshire (Andrews, after Nicholson)', /"If the lads neglect to wear the oak-leaf they are stung with nettles by their more loyal companions"/.test(R.lore) && /"Royal Oak Day, or Mobbing Day"/.test(R.lore) && /"a sprig of Royal Oak, not dog oak"/.test(R.lore) && /Andrews, Old Church Lore \(1891\), p\. 179/.test(R.source));
check('…Pepys in 1662 (and no oak put in his mouth); Grovely and Chelsea today', /"This day, being the King's birth-day, was very solemnly observed\."/.test(R.lore) && /"Grovely, Grovely, Grovely and all Grovely"/.test(R.lore) && /Chelsea Pensioners/.test(R.lore));
check('…and nothing unfound: no pinching, no "Oak and Nettle Day"', !/pinch|Oak and Nettle/i.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'oak_apple_day');
check('the Commonplace Book\'s own entry: nettles and eggs as the sources have them, no pinching, the Act repealed', cal && cal.month === 5 && cal.day === 29 && /stung with nettles/.test(cal.text) && /eggs/.test(cal.text) && !/pinch/.test(cal.text) && /repealed in 1859/.test(cal.text));
const c = CALLERS.find((x) => x.id === 'oak_apple_boys');
check('Sam Hobday and the village lads, dated by the old calendar\'s Oak Apple Day, for two days', c && c.when && c.when.calendar === 'oak_apple_day' && c.when.days === 2 && c.steps[0].rite === 'royal_oak');
check('the practical half: nobody stung; soap and water, don\'t rub, a cold cloth; dock maybe only a comfort; nettle tops with gloves, away from the road, cooked', /Nobody stings anybody/.test(c.resolution) && /soap and water/.test(c.resolution) && /don't rub it/.test(c.resolution) && /cold wet cloth/.test(c.resolution) && /dock leaf may cool it a little, or it may only be a comfort/.test(c.resolution) && /gloves on, away from the road/.test(c.resolution) && /cooking takes the sting out/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Oakie'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Oakie', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'oakie'; h.accounts.oakie = {}; h.playerProgress.oakie = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [29, 30].map((d) => offered(Date.UTC(2027, 4, d, 12)));
  const season = at(Date.UTC(2027, 4, 29, 12), () => h.calendarPublicState().season.key);
  check('on Oak Apple Day they come first, a caller of the season after them', days.every((o) => o[0] === 'oak_apple_boys' && o.length === 3 && CALLERS.find((x) => x.id === o[1]).season === season), [season, days]);
  const outside = [Date.UTC(2027, 4, 28, 12), Date.UTC(2027, 4, 31, 12), Date.UTC(2027, 10, 29, 12)].map(offered);
  check('on other days they never come', outside.every((o) => !o.includes('oak_apple_boys') && o.length === 3), outside);
  at(Date.UTC(2027, 4, 29, 12), () => {
    h.accounts.oakie.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.oakie, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'royal_oak');
  check('…and writes The Oak Sprig into The Turning Year, after Good Friday', e && e.met && /· Oak Apple Day$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'royal_oak') === ch.entries.findIndex((x) => x.id === 'cross_bun') + 1);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
