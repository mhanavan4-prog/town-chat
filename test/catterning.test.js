// Catterning: St Catherine's Day, the spinners' and lacemakers' holiday (Hone,
// quoting La Motte; Channer & Roberts, 1900; Notes and Queries, 1862;
// Halliwell, 1849; Dack, 1911), a caller dated by the Commonplace Book's own
// entry (25 November, and the 26th), first at the door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-cattern-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CATTERN_RITES } = require('../data/catterning.js');
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

const R = CATTERN_RITES.cattern_cakes;
check('keeping Cattern: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Hone (quoting La Motte): the patroness of spinsters, and "Cathar\'ning"', /"was esteemed the saint and patroness of spinsters, and her holiday observed by young women meeting on this day, and making merry together, which they call 'Cathar'ning\.'"/.test(R.lore) && /La Motte, 1730/.test(R.lore) && /Hone, The Every-Day Book, vol\. I \(1826\), 25 November/.test(R.source));
check('…Podington\'s lacemakers (1900): Old Style, the candle-block, the seed cakes, the gossip', /Podington/.test(R.lore) && /6 December/.test(R.lore) && /"washing the candle-block"/.test(R.lore) && /"seed cakes of large size"/.test(R.lore) && /"It really consisted in getting through a great deal of gossip, tea, and Cattern cakes"/.test(R.lore) && /Channer & M\. E\. Roberts, Lace-making in the Midlands \(1900\)/.test(R.source));
check('…the "wigs" of 1862', /"eat a sort of cakes they call 'wigs,' and drink ale\."/.test(R.lore) && /Notes and Queries \(17 May 1862\)/.test(R.source));
check('…the burnt lace as the 1862 note tells it, Catherine named only later', /a queen "burnt all her lace, and ordered new to be made"/.test(R.lore) && /"The poor people know nothing of the Queen"/.test(R.lore));
check('…the Worcestershire children\'s song and the Cathern bowl (Halliwell, 1849)', /"Catharine and Clement, be here, be here, \/ Some of your apples, and some of your beer"/.test(R.lore) && /"collecting apples and beer for a festival"/.test(R.lore) && /'Cathern bowl,'/.test(R.lore) && /Halliwell, Popular Rhymes and Nursery Tales \(1849\), p\. 238/.test(R.source));
check('…the Peterborough workhouse girls (Dack, 1911)', /"a crown of gilt paper"/.test(R.lore) && /Dack, Weather and Folk Lore of Peterborough \(1911\), p\. 12/.test(R.source));
check('…and nothing unchecked: no candle-jumping, no "lamb\'s wool"', !/candlestick|nimble|lamb's wool/i.test(R.lore + R.how + R.outcomes.join(' ')));
const c = CALLERS.find((x) => x.id === 'cattern_lacemakers');
check('Hannah Odell, dated by the old calendar\'s Catterning, for two days', c && c.when && c.when.calendar === 'catterning' && c.when.days === 2 && OLD_CALENDAR.some((e) => e.key === 'catterning' && e.month === 11 && e.day === 25) && c.steps[0].rite === 'cattern_cakes');
check('the practical half: daylight for comfort, no lasting harm (College of Optometrists), a far look now and then, the beer home to their mothers; no unsourced hourly walk or lace-school line', /work by daylight/.test(c.resolution) && /does them no lasting harm/.test(c.resolution) && /something across the room/.test(c.resolution) && !/walk about every hour|lace schools|wears out the eyes/.test(c.resolution) && /send the beer home to their mothers/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Lace'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Lace', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'lace'; h.accounts.lace = {}; h.playerProgress.lace = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [25, 26].map((d) => offered(Date.UTC(2027, 10, d, 12)));
  const season = at(Date.UTC(2027, 10, 25, 12), () => h.calendarPublicState().season.key);
  check('on St Catherine\'s Day she comes first, a caller of the season after her', days.every((o) => o[0] === 'cattern_lacemakers' && o.length === 3 && CALLERS.find((x) => x.id === o[1]).season === season), [season, days]);
  const outside = [Date.UTC(2027, 10, 24, 12), Date.UTC(2027, 10, 27, 12), Date.UTC(2027, 11, 6, 12)].map(offered);
  check('on other days she never comes (not on Old St Catherine\'s either)', outside.every((o) => !o.includes('cattern_lacemakers') && o.length === 3), outside);
  at(Date.UTC(2027, 10, 25, 12), () => {
    h.accounts.lace.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.lace, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'cattern_cakes');
  check('…and writes Keeping Cattern into The Turning Year', e && e.met && /· St Catherine's Day$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'cattern_cakes') >= 12);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
