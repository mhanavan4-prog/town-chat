// Against the real server: a night creature of the Wilds after a player on
// the far side of the village's stall goes round it, not through it.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-wildschase-test-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
// night, whatever the clock says
const realNow = Date.now;
require('../server.js');
const { VILLAGE } = require('../data/villageHouses');
const { WILDS_SOLIDS } = require('../data/wildsSolids');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const sock = makeMockSocket('quarry');
  connHandler(sock);
  sock.emit('message', JSON.stringify({ type: 'join', name: 'Quarry' }));
  const player = h.players.get(sock.lastOfType('init').id);
  // put the clock into the night half of the cycle
  const CYCLE = 30 * 60 * 1000; let t = Math.ceil(realNow() / CYCLE) * CYCLE - 5 * 60 * 1000;
  Date.now = () => t;
  check("it is night", h.isNightNow());
  // something solid she can stand behind and still be seen across: the stall by the hall
  const hall = WILDS_SOLIDS.find(([x, y, w, hh]) => Math.hypot(x + w / 2 - VILLAGE.x, y + hh / 2 - VILLAGE.y) < 700 && w >= 90 && w <= 150 && hh >= 120);
  check('there is a stall in the village to stand behind', !!hall);
  const [hx, hy, hw, hh] = hall, midY = hy + hh / 2;
  Object.assign(player, { room: 'wilds', x: hx + hw + 60, y: midY, isDead: false, health: 100000, maxHealth: 100000 });
  // one plain walking creature, west of it; every other is out of it
  const type = 'shade_stalker';
  const m = h.mobs2.find((x) => x.mobType === type);
  for (const o of h.mobs2) if (o !== m) o.dead = true;
  Object.assign(m, { dead: false, x: hx - 60, y: midY, health: 9999, scaredUntil: 0 });
  const reach = Math.hypot(player.x - m.x, player.y - m.y);
  check('the creature can see its quarry across it', !!m && reach < h.MOB2_TYPES[type].aggroRadius * 1.8, { reach });
  let inside = 0, nearest = Infinity, steps = 0;
  for (let i = 0; i < 1200; i++) {
    t += 50; h.tickWilds(0.05); steps++;
    if (m.x > hx && m.x < hx + hw && m.y > hy && m.y < hy + hh) inside++;
    const d = Math.hypot(player.x - m.x, player.y - m.y); nearest = Math.min(nearest, d);
    if (d < 45) break;
  }
  check('it never sets foot inside it', inside === 0, inside);
  check('and it comes round to where she stands', nearest < 60, { nearest: Math.round(nearest), steps, at: [Math.round(m.x), Math.round(m.y)] });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
