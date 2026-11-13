// Ashminster's houses and the witches' ring are solid to the Wastes' creatures
// too (lib/emberSolids.js), not only to the player (client/ember-scene.js).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-embersolids-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
require('../server.js');
const S = require('../lib/emberSolids');
const { EMBER_TOWN, ASH_PIECES } = require('../data/emberTown');
const { RING } = require('../data/witchRing');

setTimeout(() => {
  const h = global.__testHooks;
  // the client's copies of the plan match the server's
  const scene = fs.readFileSync(path.join(__dirname, '..', 'client/ember-scene.js'), 'utf8');
  const grab = (name, open, close) => { const i = scene.indexOf(`const ${name} = `); const a = scene.indexOf(open, i); let d = 0; for (let j = a; j < scene.length; j++) { if (scene[j] === open) d++; else if (scene[j] === close && --d === 0) return Function(`return ${scene.slice(a, j + 1)}`)(); } return null; };
  check('the client and server agree on what of the town is solid', JSON.stringify(grab('ASH_SOLID', '{', '}')) === JSON.stringify(S.ASH_SOLID));
  check('and on what of the minster is solid', JSON.stringify(grab('MINSTER_SOLID', '[', ']')) === JSON.stringify(S.MINSTER_SOLID));
  const solidPieces = ASH_PIECES.filter(([k]) => S.ASH_SOLID[k] || k === 'em_barricade').length;
  check('every wall is there: the minster, the town, the elder and the ring\'s stones', S.WALLS.length === S.MINSTER_SOLID.length + solidPieces + 1 + RING.stones, S.WALLS.length);
  check('no creature rises inside a wall', h.EMBER_MOB_SPAWNS.every((s) => !S.blocked(s.x, s.y, 0)));
  check('far from the town, nothing is in the way', !S.blocked(2000, 2000) && !S.blocked(EMBER_TOWN.x + 6000, EMBER_TOWN.y));

  // a hound sent after someone the far side of a house goes round it, never through
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('w'); connHandler(s); s.emit('message', JSON.stringify({ type: 'join', name: 'Wayfarer' }));
  const p = h.players.get(s.lastOfType('init').id);
  for (const m of h.emberMobs) if (!m.boss) { m.dead = true; m.respawnAt = Date.now() + 1e9; }
  const house = ASH_PIECES.find(([k, x, y]) => k === 'em_house_a' && y === EMBER_TOWN.y + 3200 && x < EMBER_TOWN.x);
  const [, hx, hy] = house;
  const hound = h.emberMobs.find((m) => m.mobType === 'ash_hound');
  Object.assign(hound, { dead: false, health: 70, x: hx - 330, y: hy, provokedUntil: 0 });
  Object.assign(p, { room: 'ember_wastes', isDead: false, x: hx + 330, y: hy, health: 5000, maxHealth: 5000 });
  h.applyDamage(p, 'ember_mob', hound.id, 1, 99999);
  let through = false;
  for (let i = 0; i < 160; i++) { h.tickEmberWastes(0.05); if (S.blocked(hound.x, hound.y, 0)) through = true; if (Math.abs(hound.x - hx) < 1 && Math.abs(hound.y - hy) < 1) through = true; }
  check('a hound after you never passes through a house', !through, { x: hound.x, y: hound.y });
  check('but it does not stand stuck at the wall: it comes round to you', Math.hypot(hound.x - p.x, hound.y - p.y) < 120, { x: hound.x, y: hound.y });

  // a crow goes over the roofs
  const crow = h.emberMobs.find((m) => m.mobType === 'carrion_crow');
  Object.assign(crow, { dead: false, health: 22, x: hx - 330, y: hy, provokedUntil: 0 });
  hound.dead = true; hound.respawnAt = Date.now() + 1e9;
  h.applyDamage(p, 'ember_mob', crow.id, 1, 99999);
  let crossed = false;
  for (let i = 0; i < 160 && !crossed; i++) { h.tickEmberWastes(0.05); if (crow.x > hx) crossed = true; }
  check('a crow flies straight over the roofs', crossed, { x: crow.x });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
