// The pinned heart: Somerset counter-magic as Elworthy recorded it (1895),
// with the harm it led to (Wiveliscombe, 1823) and the practical half for a
// run of dead pigs: sickness or poison, yew along the hedge.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-pinnedheart-');
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

const R = HOUSEHOLD_RITES.pinned_heart;
check('the pinned heart is a household rite, badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Elworthy\'s words: pins and white thorns, and the heart that withers', /"stuck full of pins and white thorns"/.test(R.lore) && /"in the belief that as the heart dried and withered so would that of the malignant person"/.test(R.lore) && /Elworthy, The Evil Eye \(1895\)/.test(R.source));
check('the Mendip rhyme, as he printed it', /"It is not this heart I mean to burn, \/ But the person's heart I wish to turn"/.test(R.lore));
check('the finds: Ashbrittle 1882, Taunton\'s pig hearts, the Pitt Rivers sheep\'s heart', /Ashbrittle in 1882/.test(R.lore) && /"more than one heart, said to be those of pigs"/.test(R.lore) && /"breaking evil spells"/.test(R.lore) && /Pitt Rivers Museum 1911\.75\.1/.test(R.source));
const c = CALLERS.find((x) => x.id === 'pinned_heart_pigs');
check('a caller any time of year, working the rite', c && !c.season && !c.when && c.steps.some((s) => s.kind === 'rite' && s.rite === 'pinned_heart'));
check('the harm it led to: Ann Burges, 1823, from the Stamford Mercury', /Ann Burges/.test(c.resolution) && /1823/.test(c.resolution) && /"with pins, nails and scissars"/.test(c.resolution) && /Stamford Mercury \(24 January 1823\)/.test(c.source));
check('…so whoever comes to the door gets what she came for, and nothing else', /gets what she came for, and nothing else/.test(c.resolution));
check('the practical half: sickness or poison, yew along the hedge, the living pigs kept apart', /sickness or poison, not a witch/.test(c.resolution) && /yew/.test(c.resolution) && /keep the living pigs apart/.test(c.resolution) && /pig doctor/.test(c.resolution) && /Cuming Collection/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Sty'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Sty', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'sty'; h.accounts.sty = {}; h.playerProgress.sty = { level: 1, xp: 0 };
  h.callers.stateOf(p);
  h.accounts.sty.callers.active = { id: c.id, done: {} };
  s.emit('message', JSON.stringify({ type: 'rite_do' }));
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.sty, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'against');
  check('…and writes the Pinned Heart into Against the Witch', ch.entries.find((e) => e.id === 'pinned_heart').met);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
