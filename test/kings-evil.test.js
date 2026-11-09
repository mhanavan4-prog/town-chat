// The king's evil: scrofula and the royal touch (to Queen Anne), Johnson's
// touching as Boswell tells it, and the seventh son; the practical half is the
// milk and the doctor.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-kingsevil-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { HOUSEHOLD_RITES } = require('../data/household.js');
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

const R = HOUSEHOLD_RITES.kings_evil;
check('the seventh son\'s touch is a household rite, badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('what the king\'s evil was, in the Royal College of Physicians\' words', /"swollen and discharging tuberculous lymph glands of the neck"/.test(R.lore) && /Royal College of Physicians/.test(R.source));
check('the touch-piece on its ribbon; Charles II\'s 105,000; Anne the last', /"pierced and threaded on a ribbon"/.test(R.lore) && /over 105,000 people/.test(R.lore) && /RCIN 443149/.test(R.source) && /Queen Anne was the last: "The death of Anne in 1714 marked the end of this ceremony in England\."/.test(R.lore) && !/Hanoverians/.test(R.lore) && !/17th-century note/.test(R.lore));
check('Johnson, in Boswell\'s words: the lady in diamonds, and "without any effect"', /"actually touched by Queen Anne"/.test(R.lore) && /"a confused, but somehow a sort of solemn recollection of a lady in diamonds, and a long black hood"/.test(R.lore) && /"This touch, however, was without any effect\."/.test(R.lore) && /Boswell, Life of Johnson \(1791\)/.test(R.source));
check('the seventh son, from Notes and Queries', /"and so doth the seaventh sonne"/.test(R.lore) && /Notes and Queries \(22 February 1851\)/.test(R.source));
const c = CALLERS.find((x) => x.id === 'kings_evil_child');
check('a caller any time of year, working the rite', c && !c.season && !c.when && c.steps.some((s) => s.kind === 'rite' && s.rite === 'kings_evil'));
check('the practical half: the touch did nothing; the milk; boil it; the doctor', /did nothing for Samuel Johnson/.test(c.resolution) && /comes in the milk/.test(c.resolution) && /Boil every drop/.test(c.resolution) && /doctor/.test(c.resolution) && /CMAJ/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Touch'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Touch', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'touch'; h.accounts.touch = {}; h.playerProgress.touch = { level: 1, xp: 0 };
  h.callers.stateOf(p);
  h.accounts.touch.callers.active = { id: c.id, done: {} };
  s.emit('message', JSON.stringify({ type: 'rite_do' }));
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.touch, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'household');
  check('…and writes the Seventh Son\'s Touch into The House and the Hive', ch.entries.find((e) => e.id === 'kings_evil').met);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
