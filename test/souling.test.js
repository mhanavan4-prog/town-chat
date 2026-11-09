// All Souls' Day: souling for soul cakes (Aubrey, 1680s; Notes and Queries,
// 1851; Burne, 1883–86; Shakespeare), a caller dated by the Commonplace Book's own
// entry (2 November, and the 3rd), first at the door, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-souling-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { SOUL_RITES } = require('../data/souling.js');
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

const R = SOUL_RITES.soul_cakes;
check('souling: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Aubrey in Shropshire: the heap of soul cakes on the board', /"There is sett on the Board a high heap of Soule-cakes"/.test(R.lore) && /"n'ly all the visitants that day take one\."/.test(R.lore) && /Aubrey, Remaines of Gentilisme and Judaisme \(1686–87\)/.test(R.source));
check('…the children still souling in 1851 (Notes and Queries)', /"the custom for the village children to go round to all their neighbours souling"/.test(R.lore) && /Notes and Queries \(15 November 1851\)/.test(R.source));
check('…the song as Burne printed it, and Shakespeare\'s beggar at Hallowmas', /"Soul! Soul! For a soul-cake! \/ I pray, good missis, a soul-cake!"/.test(R.lore) && /Burne, Shropshire Folk-Lore \(1883–86\)/.test(R.source) && /"to speak puling, like a beggar at Hallowmas"/.test(R.lore) && /Two Gentlemen of Verona, 2\.1/.test(R.source));
check('…the Antrobus soul-cakers still playing; and no unchecked "1511"', /Antrobus/.test(R.lore) && !/1511/.test(R.lore));
const c = CALLERS.find((x) => x.id === 'all_souls_souling');
check('Margery Dutton, dated by the old calendar\'s souling day, for two days', c && c.when && c.when.calendar === 'souling' && c.when.days === 2 && OLD_CALENDAR.some((e) => e.key === 'souling' && e.month === 11 && e.day === 2) && c.steps[0].rite === 'soul_cakes');
check('the practical half: charity for the poorest at winter\'s start; take cakes to the old folk; go easy with the spice', /charity before they were a game/.test(c.resolution) && /old folk on the lane/.test(c.resolution) && /go easy with the spice/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Soul'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Soul', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'soul'; h.accounts.soul = {}; h.playerProgress.soul = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [2, 3].map((d) => offered(Date.UTC(2027, 10, d, 12)));
  check('on All Souls\' Day she comes first, a Samhain caller after her', days.every((o) => o[0] === 'all_souls_souling' && o.length === 3 && CALLERS.find((x) => x.id === o[1]).season === 'samhain'), days);
  const outside = [Date.UTC(2027, 10, 1, 12), Date.UTC(2027, 10, 4, 12), Date.UTC(2027, 4, 2, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('all_souls_souling') && o.length === 3), outside);
  at(Date.UTC(2027, 10, 2, 12), () => {
    h.accounts.soul.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.soul, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'soul_cakes');
  check('…and writes Souling into The Turning Year', e && e.met && /· All Souls' Day$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'soul_cakes') >= 12);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
