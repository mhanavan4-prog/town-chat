// The Shepherd's Race: a Troy Town cut in the Wilds turf and run in and out
// for real. The server follows the steps along its one path (data/troyTown.js):
// in at the gate, to the centre, out again, and a step over a bank sends you
// back to the gate. Run here through the game's own move handler.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-twalk-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const fs = require('fs');
const T = require('../data/troyTown');
const { troyWalkPath, troyRunMoves } = require('./troy-walk-path');
const { CALLERS } = require('../data/callers');
const R = T.raster();
const geo = T.troyTownGeometry();

// ── The figure ───────────────────────────────────────────────────────────────
check('every open cell inside the outer wall is on the one path (the flood reaches them all)', R.open === R.reached && R.open > 1000, R);
check('eight arches and the seed\'s six strokes, four dots, a gate to the south facing the portal', geo.walls.length === 14 && geo.dots.length === 4 && geo.gate[1] > geo.hub[1]);
const { inward } = troyWalkPath();
check('the path runs from the gate to the centre without a gap', inward.every((p, k) => k === 0 || Math.hypot(p[0] - inward[k - 1][0], p[1] - inward[k - 1][1]) <= T.TROY_TOWN.unit * 0.26));
// the figure is clear of the Wilds' fixed places, and inside the spawn keep-out the scatter respects
const clear = [[5000, 8450, 150], [5000, 8800, 100], [5170, 8820, 90]];
check('clear of the campfire, the arrival spot and the return portal', clear.every(([x, y, r]) => Math.hypot(x - geo.hub[0], y - geo.hub[1]) > geo.radius + r));
check('inside the 1300-unit ring round the Wilds spawn that no tree or plant is scattered into', Math.hypot(geo.hub[0] - 5000, geo.hub[1] - 8800) + geo.radius < 1300);

// ── The words ────────────────────────────────────────────────────────────────
check('lore: Matthews\'s names, the treading at Boughton Green, "running it in and out", the wagers; Simpkinson marked as a novel', /'Mizmaze,' 'Julian's Bower,' 'Troy Town,' or 'Shepherd's Race'/.test(T.TROY_TOWN_LORE) && /three days' fair in June/.test(T.TROY_TOWN_LORE) && /'running it in and out'/.test(T.TROY_TOWN_LORE) && /gallons of beer/.test(T.TROY_TOWN_LORE) && /Simpkinson's novel of 1860/.test(T.TROY_TOWN_LORE));
check('lore: Titania\'s lines; the law left out of the lore, and one plain line folded under it instead', /'the quaint mazes in the wanton green, \/ For lack of tread, are undistinguishable\.'/.test(T.TROY_TOWN_LORE) && !/criminal offence/.test(T.TROY_TOWN_LORE) && /protected monuments/.test(T.TROY_TOWN_NOTE) && /Historic England/.test(T.TROY_TOWN_SOURCE));
const ned = CALLERS.find((c) => c.id === 'shepherds_race');
check('(the lore, as audited) Old Ned\'s working: run it for real; J.F. and de la Pryme from Matthews; the practical half', ned.steps[0].kind === 'troywalk' && /'running it in and out'/.test(ned.lore) && /de la Pryme/.test(ned.lore) && ned.tier === 'record');
// ── The client ───────────────────────────────────────────────────────────────
const scene = fs.readFileSync(__dirname + '/../client/wilds-scene.js', 'utf8'), main = fs.readFileSync(__dirname + '/../client/main.js', 'utf8');
check('the Wilds draws it, with a gate stone that reads like a waymarker', /makeTroyTown\(w2\.troyTown/.test(scene) && /markerId: 'troy_town'/.test(scene));
check('the ground is dead level across the whole maze', /core: world2\.troyTown\.radius \+ 40/.test(main) && /if \(c\.core && d < c\.core\) \{ flat = 0; continue; \}/.test(main));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  function walker(key) {
    const s = makeMockSocket(key); connHandler(s);
    say(s, { type: 'join', name: key, charId: 0 });
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = key; h.accounts[key] = {}; p.room = 'wilds';
    return { s, p, events: () => s.sent.filter((m) => m.type === 'troy_walk').map((m) => m.event) };
  }
  const init = (() => { const s = makeMockSocket('g'); connHandler(s); say(s, { type: 'join', name: 'g', charId: 0 }); return s.lastOfType('init'); })();
  check('the Wilds the client is sent carries the maze and its lore', init.world2 && init.world2.troyTown && init.world2.troyTown.walls.length === 14 && /Shepherd's Race/.test(init.world2.troyTown.lore));

  const a = walker('twalk_a');
  for (const [x, y] of troyRunMoves(1)) say(a.s, { type: 'move', x, y, room: 'wilds' });
  check('in at the gate, the centre, and out: start, centre, done', a.events().join(',') === 'start,centre,done', a.events());
  check('…paid once today, and the run counted', h.accounts.twalk_a.troyTown.runs === 1 && a.s.lastOfType('troy_walk').xp === 30);
  for (const [x, y] of troyRunMoves(2)) say(a.s, { type: 'move', x, y, room: 'wilds' });
  check('a second run the same day counts, but pays nothing more', h.accounts.twalk_a.troyTown.runs === 2 && a.s.lastOfType('troy_walk').xp === 0);

  const b = walker('twalk_b');
  const path = troyWalkPath();
  say(b.s, { type: 'move', x: path.outside[0], y: path.outside[1], room: 'wilds' });
  for (let k = 0; k < 300; k += 2) say(b.s, { type: 'move', x: path.inward[k][0], y: path.inward[k][1], room: 'wilds' });
  // over the bank: the nearest point of the path that is a long way further along it
  const here = path.inward[300];
  let over = null;
  for (let k = 500; k < path.inward.length && !over; k++) if (Math.hypot(path.inward[k][0] - here[0], path.inward[k][1] - here[1]) < T.TROY_TOWN.unit * 1.2) over = path.inward[k];
  say(b.s, { type: 'move', x: over[0], y: over[1], room: 'wilds' });
  check('a step over a bank is a false step, and the run is over', b.events().join(',') === 'start,false' && /A false step/.test(b.s.lastOfType('toast').message));
  for (let k = 0; k < path.inward.length; k += 2) say(b.s, { type: 'move', x: path.inward[k][0], y: path.inward[k][1], room: 'wilds' });
  check('…and walking on from there, without coming back in at the gate, starts nothing', b.events().join(',') === 'start,false');

  const c = walker('twalk_c');
  say(c.s, { type: 'move', x: path.outside[0], y: path.outside[1], room: 'wilds' });
  for (let k = 0; k < 100; k += 2) say(c.s, { type: 'move', x: path.inward[k][0], y: path.inward[k][1], room: 'wilds' });
  say(c.s, { type: 'move', x: path.outside[0], y: path.outside[1], room: 'wilds' });
  check('turning back out of the gate before the centre is leaving, not a run', c.events().join(',') === 'start,left' && !(h.accounts.twalk_c.troyTown));

  say(c.s, { type: 'read_waymarker', markerId: 'troy_town' });
  const lore = c.s.lastOfType('npc_hint_dialogue');
  check('the gate stone reads out the lore and its sources', lore && /Run it in and out/.test(lore.message) && /Matthews/.test(lore.message));

  // Old Ned's working, done by running it
  const d = walker('twalk_d');
  h.accounts.twalk_d.callers = { day: Math.floor(Date.now() / 86400000), served: [], active: { id: 'shepherds_race', done: {} }, total: 0, byId: {} };
  for (const [x, y] of troyRunMoves(2)) say(d.s, { type: 'move', x, y, room: 'wilds' });
  say(d.s, { type: 'callers_state' });
  const step = d.s.lastOfType('callers_state').active.steps[0];
  check('running it does Old Ned\'s working', step.done && /without a false step/.test(step.note), step);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
