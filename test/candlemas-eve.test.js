// Candlemas Eve, down with the green (Herrick, Hesperides, 1648, read in the
// 1648 text; Hone, 1826; English Heritage on the Twelfth Night rule): Mistress
// Cole, who brought the green in at midwinter, comes on the Commonplace Book's
// own day (1 February, and the 2nd), at the door with the Donovan girls on St
// Brigid's Eve, and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-candlemas-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CANDLEMAS_RITES } = require('../data/candlemasEve.js');
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

const R = CANDLEMAS_RITES.candlemas_green;
check('down with the green: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Herrick\'s goblins, in the 1648 words', /"Down with the Holly, Ivie, all, \/ Wherewith ye drest the Christmas Hall"/.test(R.lore) && /"looke how many leaves there be \/ Neglected there \(maids trust to me\) \/ So many Goblins you shall see\."/.test(R.lore) && /pp\. 337–38 and 361/.test(R.source));
check('…box up in the holly\'s place till Easter, then yew, birch, rushes', /"In stead of Holly, now up-raise \/ The greener Box \(for show\.\)"/.test(R.lore) && /"Unto the crisped Yew"/.test(R.lore) && /"Green Rushes"/.test(R.lore) && /"Thus times do shift; each thing his turne do's hold"/.test(R.lore));
check('…the brand till sunset, kept for next year\'s log', /"Part must be kept wherewith to teend \/ The Christmas Log next yeare"/.test(R.lore) && /till sunset/.test(R.how));
check('Hone, and English Heritage on Twelfth Night as the newer rule; no burning of the green', /"severely he enjoins the removal of the last greens of the old year"/.test(R.lore) && /"a modern invention"/.test(R.lore) && !/burn(ed|t)? the (green|holly|ivy)/i.test(R.lore + R.how));
const cal = OLD_CALENDAR.find((e) => e.key === 'candlemas_eve');
check('the Commonplace Book\'s Candlemas Eve: box till Easter, Herrick\'s spelling', cal && cal.month === 2 && cal.day === 1 && /box went up in its place till Easter/.test(cal.text) && cal.quote === 'Down with the Rosemary, and so / Down with the Baies, & misletoe');
const c = CALLERS.find((x) => x.id === 'candlemas_green');
check('Mistress Cole, dated by it, for the eve alone', c && c.caller === 'Mistress Cole' && c.when && c.when.calendar === 'candlemas_eve' && c.when.days === 1 && c.steps[0].rite === 'candlemas_green');
check('…the same Mistress Cole who brought the green in, and her chalk', CALLERS.some((x) => x.id === 'bringing_in_green' && x.caller === 'Mistress Cole' && /chalk/.test(x.resolution)) && /chalk/.test(c.plea));
check('the practical half: the berries swept up; NHS 111 or A&E, the vet; gloves; no tree on the fire, the council\'s collection; the brand on Candlemas Day', /Sweep up the fallen berries/.test(c.resolution) && /ivy and box are harmful eaten/.test(c.resolution) && /ring NHS 111, or go to A&E with a bit of the plant/.test(c.resolution) && /gloves for the holly/.test(c.resolution) && /doesn't go on the fire/.test(c.resolution) && /council's collection/.test(c.resolution) && /tomorrow, Candlemas Day, the brand is kindled and burns till sunset/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Cole'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Cole', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'cole'; h.accounts.cole = {}; h.playerProgress.cole = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const eve = offered(Date.UTC(2027, 1, 1, 12));
  check('1 February is St Brigid\'s Eve too: both come, before anyone else', eve.slice(0, 2).sort().join() === 'brigid_eve_brideog,candlemas_green' && eve.length === 3, eve);
  const next = offered(Date.UTC(2027, 1, 2, 12));
  check('…and on the 2nd, Candlemas Day, she has gone: the day has its own caller now', !next.includes('candlemas_green') && next.includes('candlemas_weather') && next.length === 3, next);
  const outside = [Date.UTC(2027, 0, 31, 12), Date.UTC(2027, 1, 2, 12), Date.UTC(2027, 1, 3, 12), Date.UTC(2027, 7, 1, 12)].map(offered);
  check('on other days she never comes on this errand', outside.every((o) => !o.includes('candlemas_green') && o.length === 3), outside);
  at(Date.UTC(2027, 1, 1, 12), () => {
    h.accounts.cole.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.cole, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'candlemas_green');
  check('…and writes Down with the Green into The Turning Year, dated 1 February', e && e.met && /· Candlemas Eve$/.test(e.title) && e.date === '1 February' && ch.entries.findIndex((x) => x.id === 'candlemas_green') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
