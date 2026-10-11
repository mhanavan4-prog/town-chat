// Regression: a Necromancer's summoned undead must attack mobs inside a DELVE
// floor. Delve floors use that run's own instanced mobs (run.mobs), not the
// shared dungeonMobs arena array — so the minion target search has to look in
// the run. Before the fix it searched the (empty) dungeonMobs and the undead
// just idled next to the enemies.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-minion-delve-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function makeMockSocket() {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}

require('../server.js');
const srv = global.__testHooks;

setTimeout(() => {
  try {
    const wss = global.__wssInstances[0];
    const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

    const sock = makeMockSocket();
    connHandler(sock);
    sock.emit('message', JSON.stringify({ type: 'join', name: 'Necro', charId: 5 }));
    const id = sock.lastOfType('init').id;
    const owner = srv.players.get(id);
    check('player joined', !!owner);

    // Descend into a fresh Delve run (spawns that run's own instanced mobs).
    srv.delveStart(owner);
    const run = srv.delveRunsByRoom.get(owner.room);
    check('delve run started with instanced mobs', !!run && run.mobs.length > 0, run && run.mobs.length);

    const mob = run.mobs.find(mm => !mm.dead);
    check('a live delve mob exists to attack', !!mob);
    const before = mob.health;

    // Stand an undead minion right on the mob (shape per raiseUndead), already
    // risen and off cooldown, so one tick lands a hit.
    const now = Date.now();
    srv.minions.push({
      id: 'minion_test_1', ownerId: owner.id, ownerName: owner.name, type: 'skeleton', room: owner.room,
      x: mob.x, y: mob.y, facing: 0,
      health: 999, maxHealth: 999, dmgMin: 10, dmgMax: 10,
      speed: 60, strikeRange: 999, hitCooldownMs: 0,
      bornAt: now, risenAt: now - 2000, dead: false, crumbleAt: 0, lastHitAt: 0, lastHit: 0
    });

    srv.tickMinions(0.2);

    check('minion damaged the delve mob (was idle before the fix)', mob.health < before || mob.dead, { before, after: mob.health, dead: mob.dead });
  } catch (e) {
    check('test ran without throwing', false, String(e && e.stack || e));
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
