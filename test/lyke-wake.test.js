// Waking at the Lyke-Wake, against the real server: a paid bed in the
// Wildlands Village is where you get up if the Wilds kill you, or a deep you
// went down into from them. (The buying of the bed is in village-houses.test.js.)
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-lykewake-test-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
require('../server.js');
const { VILLAGE_HOUSES: H } = require('../data/villageHouses');

setTimeout(() => {
  const hooks = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const sock = makeMockSocket('sleeper');
  connHandler(sock);
  sock.emit('message', JSON.stringify({ type: 'join', name: 'Sleeper' }));
  const player = hooks.players.get(sock.lastOfType('init').id);
  const die = (room, extra) => { Object.assign(player, { room, x: 2000, y: 2000, isDead: true, health: 0 }, extra || {}); sock.sent.length = 0; sock.emit('message', JSON.stringify({ type: 'respawn' })); return sock.lastOfType('you_respawned'); };
  const door = H.lodging.door, portal = hooks.WORLD2.spawn;

  const r0 = die('wilds');
  check('with no bed, the Wilds give you back at the portal, as ever', r0 && r0.room === 'wilds' && r0.x === portal.x && r0.y === portal.y && !player.isDead);

  player.accountKey = 'sleeper';
  hooks.accounts.sleeper = hooks.accounts.sleeper || {};
  hooks.accounts.sleeper.lodging = { until: Date.now() + 3600000 };
  const r1 = die('wilds');
  check('with a bed paid for, you wake outside the Lyke-Wake\'s door, whole, and are told who sat up with you', r1 && r1.room === 'wilds' && r1.x === door.x && r1.y === door.y + 30 && player.x === door.x && player.health > 0 && sock.sent.some((m) => m.type === 'toast' && /You wake at the Lyke-Wake/.test(m.message)));
  const r2 = die('dungeon_t1', { dungeonReturnRoom: 'wilds' });
  check('killed in a deep you went down into from the Wilds, the same', r2 && r2.room === 'wilds' && r2.x === door.x && r2.y === door.y + 30 && player.room === 'wilds');
  const r3 = die('dungeon_t1', { dungeonReturnRoom: 'outside' });
  check('killed in a deep you went down into from the town, you come up in the town', r3 && r3.room === 'outside' && r3.x === hooks.WORLD.spawn.x && !sock.sent.some((m) => m.type === 'toast' && /Lyke-Wake/.test(m.message)));
  const r4 = die('outside');
  check('killed in the town, the town', r4 && r4.room === 'outside');
  hooks.accounts.sleeper.lodging = { until: Date.now() - 1 };
  const r5 = die('wilds');
  check('when the bed has run out, it is the portal again', r5 && r5.x === portal.x && r5.y === portal.y);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 1500);
