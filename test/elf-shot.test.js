// Elf-shot: the fairy arrow and the cure with the flint in the water (Kirk,
// 1691; Gowdie, 1662), with the practical half for a cow that is blown.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-elfshot-');
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

const R = HOUSEHOLD_RITES.elf_shot;
check('elf-shot is a household rite, badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Kirk\'s words on the fairy arrows, as printed', /"solid earthly Bodies, nothing of Iron, but much of Stone, like to yellow soft Flint Spa, shaped like a barbed Arrow-head"/.test(R.lore) && /Kirk, The Secret Common-Wealth \(1691\)/.test(R.source));
check('Isobel Gowdie\'s "spang them from the naillis of our thowmbes" (1662, Pitcairn)', /spang them from the naillis of our thowmbes/.test(R.lore) && /Gowdie \(1662\), in R\. Pitcairn/.test(R.source));
check('the cures of the record: find the hole, and water the elf-arrow was dipped in', /find the hole/i.test(R.how) && /bowl of water/.test(R.how) && /dipped in/.test(R.lore));
check('honest about what the arrows were: Neolithic and Bronze Age flints', /Neolithic and Bronze Age flint arrowheads/.test(R.lore) && /Dowd/.test(R.source));
check('…and that "ylfa gescot" is already Old English', /Ylfa gescot/.test(R.lore) && /Wið færstice/.test(R.source));
const c = CALLERS.find((x) => x.id === 'elf_shot_cow');
check('a caller any time of year, working the rite', c && !c.season && c.steps.some((s) => s.kind === 'rite' && s.rite === 'elf_shot'));
check('the practical half: bloat from wet clover, walk her uphill, a stick in her mouth, the trocar', /blown, not shot/.test(c.resolution) && /wet clover/.test(c.resolution) && /uphill/.test(c.resolution) && /stick tied in her mouth/.test(c.resolution) && /trocar/.test(c.resolution));
check('…and the elf-arrow called what it is', /four thousand years ago/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Byre'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Byre', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'byre'; h.accounts.byre = {}; h.playerProgress.byre = { level: 1, xp: 0 };
  h.callers.stateOf(p);
  h.accounts.byre.callers.active = { id: c.id, done: {} };
  s.emit('message', JSON.stringify({ type: 'rite_do' }));
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.byre, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'household');
  check('…and writes Elf-Shot into The House and the Hive', ch.entries.find((e) => e.id === 'elf_shot').met);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
