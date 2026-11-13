// The drove road east from the Wilds and the March gate into the Ember Wastes
// (data/droveRoad.js, lib/droveRoad.js, the march_gate message in server.js).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-drove-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
const { ROAD, GATE, STOPS } = require('../data/droveRoad');
const { WAYSIDE } = require('../data/wayside');
const { WORLD2 } = require('../data/world');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const gibbet = WAYSIDE.find((w) => w.id === 'gibbet');
check('the road leaves from the gibbet crossroads and runs east to the gate at the edge of the Wilds', Math.hypot(ROAD.pts[0][0] - gibbet.x, ROAD.pts[0][1] - gibbet.y) < 250 && ROAD.pts.every((p, i) => !i || p[0] > ROAD.pts[i - 1][0]) && Math.hypot(ROAD.pts.at(-1)[0] - GATE.wilds.x, ROAD.pts.at(-1)[1] - GATE.wilds.y) < 120 && GATE.wilds.x < WORLD2.width - 150);
check('four stops, each named for the record or for folk tradition, with a source and a note on where the game goes beyond it', STOPS.length === 4 && STOPS.every((s) => (s.tier === 'record' || s.tier === 'folk') && s.lore.length >= 2 && s.source && s.note && s.says));
check('the stops stand clear of Troy Town and the Countless Stones', STOPS.every((s) => Math.hypot(s.x - 7000, s.y - 7900) > 500 && Math.hypot(s.x - 8600, s.y - 6600) > 500));
check('the road and the stance keep clear of the tombs at (7000, 7000)', (() => { const d = (px, py) => { let b = 1e9; for (let i = 0; i < ROAD.pts.length - 1; i++) { const [ax, ay] = ROAD.pts[i], [bx, by] = ROAD.pts[i + 1], L2 = (bx - ax) ** 2 + (by - ay) ** 2, t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / L2)); b = Math.min(b, Math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay))); } return b; }; return d(7000, 7000) > 340 + ROAD.width / 2 && Math.hypot(STOPS.find((s) => s.id === 'pines').x - 7000, STOPS.find((s) => s.id === 'pines').y - 7000) > 700; })());
check('the three pines are told as folk tradition, not record', STOPS.find((s) => s.id === 'pines').tier === 'folk');

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('d'); connHandler(s); s.emit('message', JSON.stringify({ type: 'join', name: 'Drover' }));
  const p = h.players.get(s.lastOfType('init').id);
  const at = (x, y, room = 'wilds') => Object.assign(p, { room, x, y, isDead: false });
  const use = (id) => s.emit('message', JSON.stringify({ type: 'drove_use', id }));
  const by = Object.fromEntries(STOPS.map((x) => [x.id, x]));

  at(by.milestone.x + 500, by.milestone.y); s.sent.length = 0; use('milestone');
  check('from too far off: go up to it', s.sent.some((m) => m.type === 'toast' && /Go up to it/.test(m.message)) && !s.lastOfType('drove_state'));
  at(by.milestone.x, by.milestone.y + 60); use('milestone');
  check('the milestone: read, and done for today', s.lastOfType('drove_state').done.includes('milestone') && s.sent.some((m) => m.type === 'vh_board' && /milestone/.test(m.title)));
  p.health = 10; p.maxHealth = 100;
  at(by.pines.x, by.pines.y + 100); use('pines');
  check('the stance mends you', p.health > 10);
  at(by.needfire.x, by.needfire.y + 60); use('needfire');
  check('the need-fire leaves its smoke on you, and the client is told how long', p.needfireUntil > Date.now() + ROAD.needfireMs - 5000 && s.lastOfType('needfire_state') && h.droveRoad.smokeCut(p) === ROAD.needfireCut);
  s.sent.length = 0;
  at(by.gate.x, by.gate.y + 60); use('gate');
  check('all four in a day: the road walked', s.lastOfType('drove_state').walked === true && s.sent.some((m) => m.type === 'toast' && /walked the drove road/.test(m.message)));
  s.sent.length = 0; use('gate');
  check('pressing again that day reads you its history, and pays nothing more', s.sent.some((m) => m.type === 'vh_board') && !s.sent.some((m) => m.type === 'drove_state'));

  // the gate, both ways
  at(GATE.wilds.x - 400, GATE.wilds.y); s.sent.length = 0;
  s.emit('message', JSON.stringify({ type: 'march_gate' }));
  check('from too far off, the gate does nothing', p.room === 'wilds');
  at(GATE.wilds.x - 40, GATE.wilds.y);
  h.setTemplePortal(false); s.sent.length = 0;
  s.emit('message', JSON.stringify({ type: 'march_gate' }));
  check('with the temple torches out, it will not open inward', p.room === 'wilds' && s.sent.some((m) => m.type === 'toast' && /will not open from this side/.test(m.message)));
  h.setTemplePortal(true);
  s.emit('message', JSON.stringify({ type: 'march_gate' }));
  const ent = s.lastOfType('ember_wastes_entered');
  check('with them lit, through the gate from the Wilds into the west of the Ember Wastes', p.room === 'ember_wastes' && p.x === GATE.arriveWastes.x && ent && ent.march === true && ent.spawn.x === GATE.arriveWastes.x);
  check('nothing of the Wastes rises near the gate', h.EMBER_MOB_SPAWNS.every((m) => Math.hypot(m.x - GATE.arriveWastes.x, m.y - GATE.arriveWastes.y) >= GATE.quiet - 1));

  // the smoke: a creature of the Wastes bites less
  for (const m of h.emberMobs) if (!m.boss) { m.dead = true; m.respawnAt = Date.now() + 1e9; }
  const hound = h.emberMobs.find((m) => m.mobType === 'ash_hound');
  const bites = (smoke) => {
    p.needfireUntil = smoke ? Date.now() + 60000 : 0;
    let lost = 0;
    for (let k = 0; k < 40; k++) {
      Object.assign(hound, { dead: false, health: 70, x: p.x + 20, y: p.y, lastHitAt: 0 });
      p.health = 5000; p.maxHealth = 5000; p.isDead = false;
      h.applyDamage(p, 'ember_mob', hound.id, 1, 99999); hound.health = 70;
      h.tickEmberWastes(0.05);
      lost += 5000 - p.health;
    }
    return lost;
  };
  const plain = bites(false), smoked = bites(true);
  check('in the need-fire\'s smoke the Wastes\' creatures bite you less', smoked < plain && plain > 0, { plain, smoked });
  hound.dead = true; hound.respawnAt = Date.now() + 1e9;

  h.setTemplePortal(false);   // out is open whether the torches burn or not
  at(GATE.wastes.x + 50, GATE.wastes.y, 'ember_wastes'); s.sent.length = 0;
  s.emit('message', JSON.stringify({ type: 'march_gate' }));
  const ex = s.lastOfType('ember_wastes_exited');
  check('and back through it from the Wastes, into the Wilds, portal lit or not', p.room === 'wilds' && ex && ex.room === 'wilds' && ex.x === GATE.arriveWilds.x);

  // the client
  const main = read('client/main.js'), wilds = read('client/wilds-scene.js'), ember = read('client/ember-scene.js');
  const cg = ember.match(/const MARCH_GATE = \{ x: (\d+), y: (\d+) \}/);
  check('the Wastes side of the gate is where the server says', cg && +cg[1] === GATE.wastes.x && +cg[2] === GATE.wastes.y);
  check('the client draws the road and its stops, and sends the gate and the stops', /if \(w2\.drove\)/.test(wilds) && /npc: 'drove', droveId: st\.id/.test(wilds) && /npc: 'march'/.test(wilds) && /npc: 'march'/.test(ember) && /type: 'march_gate'/.test(main) && /type: 'drove_use', id: kiosk\.droveId/.test(main));
  check('coming back through the gate puts you in the Wilds, not the town', /const toWilds = msg\.room === 'wilds';\n    if \(msg\.sfx && typeof playSfx === 'function'\) playSfx\(sfxOrStandIn\(msg\.sfx\)\);\n    if \(me\) \{ me\.room = toWilds \? 'wilds' : 'outside'; me\.x = msg\.x; me\.y = msg\.y; \}\n    if \(toWilds\) swapToWildsMap\(\); else swapToTownMap\(\);\n    setUnlockToast\(toWilds \? '🚧/.test(main));
  check('the four models are in the kit', ['milestone', 'scots_pine', 'needfire', 'march_gate'].every((k) => fs.existsSync(path.join(__dirname, '..', 'public/kk/home', k + '.glb')) && new RegExp(`wd_${k}: 'kk/home/${k}\\.glb'`).test(main)));
  check('the road walked is a line in the daybook', /entry\('drove', '🐄', 'The drove road, walked'/.test(read('lib/daybook.js')));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
