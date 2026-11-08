// St John's Eve: fern seed caught at midnight to walk invisible (Shakespeare,
// Henry IV, Part 1; Jonson, The New Inn), a caller only on 23 and 24 June,
// first at the door, and the Charm Book; the practical half: there is no seed.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-fernseed-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { FERN_RITES, FERN_WHEN } = require('../data/fernSeed.js');
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

const R = FERN_RITES.fern_seed;
check('the fern seed: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Gadshill and the Chamberlain, as printed (Henry IV, Part 1, 2.1)', /"We have the receipt of fern-seed, we walk invisible,"/.test(R.lore) && /"more beholding to the night than to fern-seed for your walking invisible\."/.test(R.lore) && /Henry IV, Part 1 \(c\. 1597\), 2\.1/.test(R.source));
check('Jonson\'s Ferret: "No fern-seed in my pocket"', /"No fern-seed in my pocket"/.test(R.lore) && /The New Inn \(1629\), 1\.6/.test(R.source));
check('the honest botany: no seed, spores; Malpighi in the late 1600s; the life cycle in the 1840s', /There was no seed to catch/.test(R.lore) && /spores/.test(R.lore) && /Malpighi/.test(R.lore) && /1840s/.test(R.lore) && /Moran/.test(R.source) && /Hofmeister/.test(R.source));
check('every sign is an empty plate or dust, and nobody invisible', R.outcomes.every((o) => /empty|dust/.test(o)));
check('the 23rd and the 24th', FERN_WHEN.month === 6 && FERN_WHEN.from === 23 && FERN_WHEN.to === 24 && FERN_WHEN.label === "St John's Eve");
const c = CALLERS.find((x) => x.id === 'fern_seed_eve');
check('Hal Pritchard: the plate under the fern, on his night', c && c.when === FERN_WHEN && c.steps.length === 1 && c.steps[0].rite === 'fern_seed');
check('the practical half: no seed, keep out of the orchard, ticks in the bracken', /there is no seed to catch/.test(c.resolution) && /keep out of the orchard/.test(c.resolution) && /ticks/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Hal'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Hal', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'hal'; h.accounts.hal = {}; h.playerProgress.hal = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [23, 24].map((d) => offered(Date.UTC(2027, 5, d, 12)));
  // Hester Bligh's Midsummer Men (data/midsummerMen.js) come the same two days: both dated callers first, a midsummer caller after.
  const datedN = (o) => o.filter((id) => !!(CALLERS.find((x) => x.id === id) || {}).when).length;
  check('on St John\'s Eve he comes first (with any other caller of the day), a midsummer caller after', days.every((o) => o.length === 3 && o.slice(0, datedN(o)).includes('fern_seed_eve') && CALLERS.find((x) => x.id === o[datedN(o)]).season === 'litha'), days);
  const outside = [Date.UTC(2027, 5, 22, 12), Date.UTC(2027, 5, 25, 12), Date.UTC(2027, 11, 23, 12)].map(offered);
  check('on other days he never comes', outside.every((o) => !o.includes('fern_seed_eve') && o.length === 3), outside);
  at(Date.UTC(2027, 5, 23, 12), () => {
    h.accounts.hal.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.hal, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'fern_seed');
  check('…and writes the Fern Seed into The Turning Year', e && e.met && /· St John's Eve$/.test(e.title) && ch.entries.findIndex((x) => x.id === 'fern_seed') >= 12);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
