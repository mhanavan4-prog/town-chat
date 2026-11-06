// Death is a clean slate.
//
// Playtest report: "I was just killed in a dungeon, when I came back alive at
// the town spawn I died again." Statuses outlived the body they were on, so a
// player who was withered when they died respawned at FULL health with wither
// still ticking. It drains to a 1 HP floor in about half a minute — it cannot
// finish you itself — and then the first thing that touches you does, which is
// why this reads as dying twice from one fight.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-respawn-');

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

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {};
    return { s, p };
  }

  // ── A withered death ──────────────────────────────────────────────────────
  const a = join('Withered', 'respawn_a');
  a.p.room = 'dungeon_t1'; a.p.x = 500; a.p.y = 500;
  a.p.activeStatus = { type: 'wither', expiresAt: Date.now() + 60000 };
  a.p.health = 0;
  h.noteDeath(a.p);
  a.p.isDead = true;

  check('death clears the status that was on the body', a.p.activeStatus === null, a.p.activeStatus);

  a.s.sent.length = 0;
  a.s.emit('message', JSON.stringify({ type: 'respawn' }));
  const r = a.s.lastOfType('you_respawned');
  check('respawning out of a dungeon returns you to town', r && r.room === 'outside', r);
  check('you come back at the town spawn', r && r.x === h.WORLD.spawn.x && r.y === h.WORLD.spawn.y, r);
  check('you come back at full health', a.p.health === h.playerMaxHealth(a.p), { hp: a.p.health, max: h.playerMaxHealth(a.p) });
  check('and nothing is still draining you', a.p.activeStatus === null, a.p.activeStatus);

  // The whole point: full health has to still BE full health a moment later.
  // Before the fix this read 1 by the time the player had got their bearings.
  const hpAtRespawn = a.p.health;
  setTimeout(() => {
    check('health is not bleeding away after you get up', a.p.health === hpAtRespawn, { was: hpAtRespawn, now: a.p.health });
    check('and you are still alive', a.p.isDead === false);

    // ── Damage-over-time aimed at the body goes with it ─────────────────────
    const b = join('Burning', 'respawn_b');
    b.p.room = 'wilds';
    h.activeDots.set('player|' + b.p.id, { dps: 5, until: Date.now() + 60000, byId: a.p.id, targetType: 'player', targetId: b.p.id, acc: 0 });
    check('a DoT is riding the target', h.activeDots.has('player|' + b.p.id));
    b.p.health = 0;
    h.noteDeath(b.p);
    check('death drops the DoT aimed at that player', !h.activeDots.has('player|' + b.p.id), [...h.activeDots.keys()]);

    // A DoT on somebody else is not this player's business to clear.
    const c = join('Bystander', 'respawn_c');
    h.activeDots.set('player|' + c.p.id, { dps: 5, until: Date.now() + 60000, byId: a.p.id, targetType: 'player', targetId: c.p.id, acc: 0 });
    h.noteDeath(b.p);
    check("someone else's DoT is left alone", h.activeDots.has('player|' + c.p.id));
    h.activeDots.clear();

    // ── Buffs do not outlive the body either ────────────────────────────────
    const d = join('Hasted', 'respawn_d');
    d.p.activeStatus = { type: 'speedboost', expiresAt: Date.now() + 60000 };
    h.noteDeath(d.p);
    check('a buff is cleared by death too — nothing outlives the body', d.p.activeStatus === null, d.p.activeStatus);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }, 1500);
}, 700);
