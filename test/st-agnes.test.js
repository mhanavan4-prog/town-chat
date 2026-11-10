// St Agnes' Eve: the fast and the row of pins (Aubrey, 1696; Hone, 1826; Keats,
// 1820), a caller who comes only on the 20th and 21st of January, first at the
// door, and the Charm Book; the practical half is hunger and dreams.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-stagnes-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { AGNES_RITES, AGNES_WHEN } = require('../data/stAgnes.js');
const { CALLERS } = require('../data/callers.js');
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

const R = AGNES_RITES.st_agnes_pins;
check('St Agnes\' pins: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Hone\'s words on the night, and "St. Agnes\' fast"', /"a night of great import to maidens who desired to know who they should marry"/.test(R.lore) && /"St\. Agnes' fast"/.test(R.lore) && /Hone, The Every-Day Book, vol\. I \(1826\), 20 January/.test(R.source));
check('Aubrey\'s charm as Hone quotes it (the 1696 page not seen): the row of pins, the Pater Noster, the dream', /"Upon St\. Agnes' night you take a row of pins"/.test(R.lore) && /"saying Pater Noster, sticking a pin in your sleeve, and you will dream of him or her you shall marry\."/.test(R.lore) && !/Ianuary/.test(R.lore) && /Aubrey, Miscellanies \(1696\), as Hone quotes it/.test(R.source));
check('Keats, stanza VI: "visions of delight", "supperless to bed"', /"They told her how, upon St\. Agnes' Eve, \/ Young virgins might have visions of delight"/.test(R.lore) && /"supperless to bed they must retire"/.test(R.lore) && /Keats, "The Eve of St\. Agnes" \(1820\)/.test(R.source));
check('the 20th and the 21st (Aubrey keeps it on the 21st)', AGNES_WHEN.month === 1 && AGNES_WHEN.from === 20 && AGNES_WHEN.to === 21);
const c = CALLERS.find((x) => x.id === 'st_agnes_eve');
check('Lucy Tranter: the pins, any year, on her night', c && c.when === AGNES_WHEN && c.steps.length === 1 && c.steps[0].rite === 'st_agnes_pins');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Agnes'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Agnes', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'agnes'; h.accounts.agnes = {}; h.playerProgress.agnes = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [20, 21].map((d) => offered(Date.UTC(2027, 0, d, 12)));
  check('on St Agnes\' Eve she comes first at the door', days.every((o) => o[0] === 'st_agnes_eve' && o.length === 3), days);
  const outside = [Date.UTC(2027, 0, 19, 12), Date.UTC(2027, 0, 22, 12), Date.UTC(2027, 6, 20, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('st_agnes_eve') && o.length === 3), outside);
  at(Date.UTC(2027, 0, 20, 12), () => {
    h.accounts.agnes.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.agnes, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'yule');
  const e = ch.entries.find((x) => x.id === 'st_agnes_pins');
  check('…and writes St Agnes\' Pins into Yuletide', e && e.met && /· St Agnes' Eve$/.test(e.title));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
