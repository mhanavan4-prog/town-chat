// More of the charmer's craft: the Shetland wresting thread for a sprain (and
// its Merseburg ancestor), the cramp charm and the royal cramp rings, and
// charming a stye with a black cat's tail; each with a caller.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-morecharms-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CHARMS, STYE_CHARM } = require('../data/charms.js');
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

// ── The words, as recorded ──
check('the sprain charm is the 1845 Shetland wording, "Set joint to joint"', /The Lord rade, and the foal slade/.test(CHARMS.sprain.lines[0]) && /Set joint to joint, bone to bone, and sinew to sinew/.test(CHARMS.sprain.lines[2]) && /New Statistical Account/.test(CHARMS.sprain.source));
check('…on a thread of black wool with nine knots, said too low to be heard', /black wool/.test(CHARMS.sprain.use) && /nine knots/.test(CHARMS.sprain.use) && /cannot hear/.test(CHARMS.sprain.use));
check('…and its Merseburg ancestor, as written in the manuscript', /ben zi bena, bluot zi bluoda, lid zi geliden/.test(CHARMS.sprain.lore) && /Cod\. 136/.test(CHARMS.sprain.source));
check('the cramp charm is the Christ\'s Hospital one, with the eel-skin and the cramp rings', /The devil is tying a knot in my leg/.test(CHARMS.cramp.lines[0]) && /eel-skin/.test(CHARMS.cramp.use) && /cramp rings/.test(CHARMS.cramp.lore) && /Henderson/.test(CHARMS.cramp.source));
check('the stye: nine strokes of a black cat\'s tail (Hunt), and the older gold', /nine times/.test(STYE_CHARM.use) && /Hunt/.test(STYE_CHARM.source) && /no gold to cure it/.test(STYE_CHARM.lore));
const sprain = CALLERS.find((c) => c.id === 'the_sprain'), cramp = CALLERS.find((c) => c.id === 'the_cramp'), stye = CALLERS.find((c) => c.id === 'the_stye');
check('three callers: nine knots then the words; the words alone; nine strokes', sprain && sprain.steps[0].count === 9 && sprain.steps[1].charm === 'sprain' && cramp && cramp.steps[0].charm === 'cramp' && stye && stye.steps[0].count === 9 && stye.steps[0].charm === 'stye');
check('each is told the practical half (bind and rest; stretch; a hot cloth)', /foot up/.test(sprain.resolution) && /stretch the calf/.test(cramp.resolution) && /hot water/.test(stye.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Charmer'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Charmer', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'charmer2'; h.accounts.charmer2 = {}; h.playerProgress.charmer2 = { level: 1, xp: 0 };
  const say = (m) => s.emit('message', JSON.stringify(m));
  h.callers.stateOf(p);
  const step = (i) => h.callers.callersStatePayload(p).active.steps[i];

  // The stye: nine strokes of the tail.
  h.accounts.charmer2.callers.active = { id: 'the_stye', done: {} };
  check('the Board shows the stroke, with its icon and how', step(0).verb === 'Pass the tail over it' && step(0).icon === '🐈‍⬛' && step(0).count === 9 && /black cat/.test(step(0).use));
  for (let k = 0; k < 8; k++) say({ type: 'knot_tie' });
  check('eight strokes: not done yet', step(0).tied === 8 && !step(0).done);
  say({ type: 'knot_tie' });
  check('the ninth completes it, noted, and the stye charm is remembered (not the warts)', step(0).done && /passed nine times over the stye for Mrs Penrose/.test(step(0).note) && (h.accounts.charmer2.charmsSaid || []).includes('stye') && !(h.accounts.charmer2.charmsSaid || []).includes('warts'), step(0).note);

  // The sprain: nine knots, then the words.
  h.accounts.charmer2.callers.active = { id: 'the_sprain', done: {} };
  for (let k = 0; k < 9; k++) say({ type: 'knot_tie' });
  check('nine knots on the black thread', step(0).done && /Nine knots cast/.test(step(0).note));
  for (let li = 0; li < 4; li++) say({ type: 'charm_say', line: li });
  check('then the words, and the sprain charm is remembered', step(1).done && (h.accounts.charmer2.charmsSaid || []).includes('sprain'));

  // The cramp: the words.
  h.accounts.charmer2.callers.active = { id: 'the_cramp', done: {} };
  for (let li = 0; li < 4; li++) say({ type: 'charm_say', line: li });
  check('the cramp charm said and remembered', step(0).done && (h.accounts.charmer2.charmsSaid || []).includes('cramp'));

  const ch = buildCharmBook({ acct: h.accounts.charmer2, prog: {}, seasonKey: null }).chapters.find((c) => c.key === 'charms');
  check('the Charm Book\'s Spoken Charms chapter has seven, three written in', ch && ch.total === 7 && ch.met === 3);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
