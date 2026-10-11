// Town layering: public players in 'outside' are spread across capped town_N
// instances; the Wilds (and other rooms) stay the single public world (null);
// coven moots are left alone; and two players in different layers don't sync
// against each other in the position firehose.
process.env.PORT = '0';
process.env.TOWN_LAYER_CAP = '5'; // small cap so the test can overflow a layer cheaply
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-layer-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    return { s, p };
  }

  check('the layer cap is exposed', h.TOWN_LAYER_CAP === 5);

  // Join 12 players — all spawn in 'outside', so they should fill town_1 (5),
  // town_2 (5), town_3 (2).
  const ppl = [];
  for (let i = 0; i < 12; i++) ppl.push(join('L' + i));
  h.reconcileTownLayers();
  const layerOf = {};
  for (const { p } of ppl) layerOf[p.instance] = (layerOf[p.instance] || 0) + 1;
  check('everyone in town got a town_ layer', ppl.every(x => h.isTownLayer(x.p.instance)), ppl.map(x => x.p.instance));
  check('no town layer exceeds the cap', Object.values(layerOf).every(n => n <= 5), layerOf);
  check('players overflow into multiple layers', Object.keys(layerOf).length >= 2, layerOf);

  // Two players in DIFFERENT layers must not see each other in the position firehose.
  const a = ppl.find(x => x.p.instance === 'town_1');
  const b = ppl.find(x => x.p.instance === 'town_2');
  check('there is a player in town_1 and one in town_2', !!a && !!b);
  for (const x of ppl) x.s.sent.length = 0;
  h.broadcastPlayerState();
  const aState = a.s.lastOfType('state');
  const aIds = new Set((aState ? aState.players : []).map(p => p.id));
  check('a town_1 player does NOT receive a town_2 player in the firehose', !aIds.has(b.p.id), [...aIds]);

  // Walking into the Wilds drops you to the single public world (instance null).
  a.p.room = 'wilds';
  h.reconcileTownLayers();
  check('leaving town clears the town layer (null in the Wilds)', (a.p.instance || null) === null, a.p.instance);

  // A coven moot instance is left untouched by the layer reconciler.
  const c = ppl[0]; c.p.room = 'outside'; c.p.instance = 'coven_9';
  h.reconcileTownLayers();
  check('a coven moot instance is preserved (not overwritten by a town layer)', c.p.instance === 'coven_9', c.p.instance);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
