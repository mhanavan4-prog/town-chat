// The clootie well in the Wilds: Morag's cloot is tied the old way, for real.
// The cloth is chosen on the Board (a polyester ribbon refused, in Forestry and
// Land Scotland's words), the three rounds sunways are counted from the
// walker's own steps round the spring (widdershins undoes them), and the knot
// is tied at the spring itself.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-cloot-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const fs = require('fs');
const C = require('../data/clootie');
const { CALLERS, READING_KINDS } = require('../data/callers');
const W = C.CLOOTIE_WELL;
const morag = CALLERS.find((c) => c.id === 'clootie');

// ── Sunways ──────────────────────────────────────────────────────────────────
// x runs east and y runs south, so east -> south -> west is sunways.
let st = null;
for (const [x, y] of [[W.x + 100, W.y], [W.x, W.y + 100], [W.x - 100, W.y]]) st = C.clootieTurn(st, x, y);
check('east, then south, then west is sunways (a positive turn)', st.turn > 3 && st.turn < 3.3, st);
st = null;
for (const [x, y] of [[W.x + 100, W.y], [W.x, W.y - 100], [W.x - 100, W.y]]) st = C.clootieTurn(st, x, y);
check('east, then north, then west is widdershins', st.turn < -3, st);
check('only steps near the spring count', !C.clootieNear(W.x, W.y) && !C.clootieNear(W.x + 400, W.y) && C.clootieNear(W.x + 120, W.y));
check('the well stands clear of the portal, the campfire and the Shepherd\'s Race, inside the ring no tree is scattered into', Math.hypot(W.x - 5000, W.y - 8800) > 400 && Math.hypot(W.x - 5000, W.y - 8450) > 400 && Math.hypot(W.x - 5600, W.y - 8400) > 800 && Math.hypot(W.x - 5000, W.y - 8800) + 300 < 1300);

// ── The words ────────────────────────────────────────────────────────────────
check('polyester refused, in FLS\'s own words', C.CLOOT_CLOTHS.find((c) => c.key === 'polyester').ok === false && /'small, appropriate and biodegradable'/.test(C.CLOOT_CLOTHS.find((c) => c.key === 'polyester').why) && /'Pure wool or pure cotton are best for the environment\.'/.test(C.CLOOT_CLOTHS.find((c) => c.key === 'polyester').why));
check('lore: Anderson 1618, Martin\'s "sunways from east to west", Craigie Well\'s first Sunday in May, the Manx rotting rag, Gregor\'s warning', /'all tapestried about with old rags/.test(morag.lore) && /'move thrice round the well, proceeding sunways from east to west'/.test(morag.lore) && /'early in the morning of the first Sunday in May'/.test(morag.lore) && /'When the cloth had rotted away the cure was supposed to be effected'/.test(morag.lore) && /'Whoever carried off one, of such relics contracted the disease of the one who left it\.'/.test(morag.lore));
check('the rotting-rag belief is dated honestly: Manx in 1890, and "said in Scotland now"', /recorded on the Isle of Man in 1890/.test(morag.lore) && /is said in Scotland now/.test(morag.lore));
check('record tier; Mackinlay, Martin, FLS, the DWI cited; a reading the server credits', morag.tier === 'record' && /Mackinlay/.test(morag.source) && /Martin/.test(morag.source) && /Forestry and Land Scotland/.test(morag.source) && /Drinking Water Inspectorate/.test(morag.source) && READING_KINDS.includes('cloot'));
const scene = fs.readFileSync(__dirname + '/../client/wilds-scene.js', 'utf8'), main = fs.readFileSync(__dirname + '/../client/main.js', 'utf8');
check('the Wilds draws the well with its thorn, and the spring is the interact point', /makeClootieWell\(w2\.clootieWell\.x/.test(scene) && /npc: 'clootie'/.test(scene) && /kiosk\.npc === 'clootie'\) \{ ws\.send\(JSON\.stringify\(\{ type: 'cloot_tie' \}\)\)/.test(main));

// ── Through the game's own handlers ──────────────────────────────────────────
require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const init = (() => { const s = makeMockSocket('g'); connHandler(s); say(s, { type: 'join', name: 'g', charId: 0 }); return s.lastOfType('init'); })();
  check('the Wilds the client is sent carries the well', init.world2 && init.world2.clootieWell && init.world2.clootieWell.x === W.x);
  const s = makeMockSocket('Tier'); connHandler(s);
  say(s, { type: 'join', name: 'Tier', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'cloot_a'; h.accounts.cloot_a = { callers: { day: Math.floor(Date.now() / 86400000), served: [], active: { id: 'clootie', done: {} }, total: 0, byId: {} } };
  const view = () => { say(s, { type: 'callers_state' }); return s.lastOfType('callers_state').active.steps[0]; };
  const round = (n, dir = 1, r = 120) => { for (let k = 0; k <= n * 24; k++) { const a = dir * (k / 24) * 2 * Math.PI; say(s, { type: 'move', x: W.x + r * Math.cos(a), y: W.y + r * Math.sin(a), room: 'wilds' }); } };
  p.room = 'wilds';
  check('the Board offers the three cloths, none chosen, no rounds', view().cloot.cloths.length === 3 && view().cloot.cloth === null && view().cloot.rounds === 0);
  say(s, { type: 'cloot_cloth', cloth: 'polyester' });
  check('the polyester ribbon is refused, with the reason', /won't rot/.test((s.lastOfType('caller_error') || {}).message || '') && view().cloot.cloth === null);
  round(2);
  check('rounds walked before the cloth is chosen don\'t count', view().cloot.rounds === 0);
  say(s, { type: 'cloot_cloth', cloth: 'cotton' });
  check('cotton is taken', view().cloot.cloth === 'cotton');
  say(s, { type: 'cloot_tie' });
  check('tying before the rounds is refused', /three times first, sunways/.test(s.lastOfType('caller_error').message) && !view().done);
  round(2);
  check('two rounds sunways are counted', view().cloot.rounds === 2, view().cloot);
  round(1, -1);
  check('widdershins undoes them, and says so', view().cloot.rounds === 0 && s.sent.some((m) => m.type === 'toast' && /Widdershins/.test(m.message)));
  p.x = W.x + 2000; say(s, { type: 'move', x: W.x + 2000, y: W.y, room: 'wilds' });
  round(3);
  check('three rounds sunways', view().cloot.rounds === 3 && s.sent.some((m) => m.type === 'toast' && /Three times round, sunways/.test(m.message)));
  say(s, { type: 'move', x: W.x + 900, y: W.y, room: 'wilds' });
  say(s, { type: 'cloot_tie' });
  check('…but the knot is tied at the spring, not from across the moor', /at the clootie well itself/.test(s.lastOfType('caller_error').message) && !view().done);
  say(s, { type: 'move', x: W.x + 60, y: W.y, room: 'wilds' });
  say(s, { type: 'cloot_tie' });
  const v = view();
  check('tied at the spring: done, with its note', v.done && /cotton/.test(v.note) && /three rounds sunways/.test(v.note), v);
  s.sent.length = 0;
  say(s, { type: 'caller_finish' });
  check('and Morag pays', !!s.lastOfType('caller_result'));
  say(s, { type: 'cloot_tie' });
  const lore = s.lastOfType('npc_hint_dialogue');
  check('with no working in hand, the spring reads out its lore and sources', lore && /tapestried about with old rags/.test(lore.message) && /Mackinlay/.test(lore.message));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
