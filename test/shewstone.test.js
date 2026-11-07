// The shewstone: scrying in glass, from Dee's obsidian mirror to the cunning
// man who let the client see the face, with the harm a name could do (Tring,
// 1751) and the practical half for a sow that lay on her litter.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-shewstone-');
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

const R = HOUSEHOLD_RITES.shewstone;
check('the shewstone is a household rite, badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Dee\'s mirror: British Museum, Mexican obsidian from Pachuca, Walpole\'s label', /British Museum/.test(R.lore) && /Pachuca/.test(R.lore) && /"The Black Stone into which Dr Dee used to call his Spirits"/.test(R.lore) && /1966,1001\.1/.test(R.source) && /Antiquity 95 \(2021\)/.test(R.source));
check('Kelley looked, not Dee', /Dee did not look himself/.test(R.lore) && /Edward Kelley/.test(R.lore));
check('Scot\'s chapter, as he printed it, and why he printed it', /"How to enclose a spirit in a christall stone"/.test(R.lore) && /to expose it/.test(R.lore) && /Scot, The Discoverie of Witchcraft \(1584\), XV\.12/.test(R.source));
check('the cunning folk let the client look, and never named anyone', /let the one who asks look into it, not you/.test(R.how) && /never had to name anyone/.test(R.lore) && /Davies, Cunning-Folk \(2003\)/.test(R.source));
check('the law: an offence from 1542, a pretence from 1736', /from 1542/.test(R.lore) && /from 1736 it was punished as a pretence/.test(R.lore));
const c = CALLERS.find((x) => x.id === 'shewstone_litter');
check('a caller any time of year, working the rite', c && !c.season && !c.when && c.steps.some((s) => s.kind === 'rite' && s.rite === 'shewstone'));
check('the honest half: the glass shows the face you bring, and a name can kill (Tring, 1751)', /shows the face you bring to it/.test(c.resolution) && /Tring in 1751/.test(c.resolution) && /Ruth Osborne/.test(c.resolution) && /Colley was hanged/.test(c.resolution) && /Osborne, Ruth/.test(c.source));
check('the practical half: fever after farrowing, overlying, straw, a rail, the farrier', /fever/.test(c.resolution) && /lies on her young/.test(c.resolution) && /straw/.test(c.resolution) && /rail along the wall/.test(c.resolution) && /farrier/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Glass'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Glass', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'glass'; h.accounts.glass = {}; h.playerProgress.glass = { level: 1, xp: 0 };
  h.callers.stateOf(p);
  h.accounts.glass.callers.active = { id: c.id, done: {} };
  s.emit('message', JSON.stringify({ type: 'rite_do' }));
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.glass, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'household');
  check('…and writes the Shewstone into The House and the Hive', ch.entries.find((e) => e.id === 'shewstone').met);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
