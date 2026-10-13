// Necromancer minions vs the World Boss. The boss is a singleton, not part of
// any hostile pool, so the undead used to ignore it entirely — they'd mill
// around the raid target and never swing. This proves a summoned minion now
// acquires the boss as a target in the Wilds and lands its blows through the
// owner's damage ledger.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-mwb-');

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
  try {
    const h = global.__testHooks;
    const WB = h.worldBossMod;
    const ARENA = WB.WB_ARENA;

    const wss = global.__wssInstances[0];
    const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
    function join(tag, charId) {
      const s = makeMockSocket(tag);
      connHandler(s);
      s.emit('message', JSON.stringify({ type: 'join', name: tag, charId }));
      const p = h.players.get(s.lastOfType('init').id);
      p.accountKey = tag.toLowerCase(); s._isGuest = false;
      p.room = 'wilds'; p.x = ARENA.x; p.y = ARENA.y; p.isDead = false;
      return { s, p };
    }

    // A Necromancer standing at the Hollow, with a boss risen in front of them.
    const necro = join('Mort', 5);
    const boss = WB._forceSpawn(h.worldBossWindow(Date.now()).index);
    check('a boss is up in the Wilds', !!boss && boss.health === boss.maxHealth, boss && boss.typeId);

    // Raise a skeleton and stand it right next to the boss, past its rise anim.
    const r = h.raiseUndead(necro.p, 'skeleton');
    check('a skeleton is raised', r.ok && !!r.minion, r);
    const m = r.minion;
    m.risenAt = 0;                 // skip the clawing-out-of-the-ground delay
    m.lastHitAt = 0;
    m.x = boss.x + 20; m.y = boss.y; // within strikeRange of the boss

    const hp0 = boss.health;
    // A few ticks: acquire → (already in range) → strike, then respect cooldown.
    for (let i = 0; i < 4; i++) h.tickMinions(1.6);

    check('the minion damaged the World Boss', boss.health < hp0, { before: hp0, after: boss.health });
    check('the hit is credited to the summoner in the boss ledger',
      boss.contrib.get(necro.p.accountKey) && boss.contrib.get(necro.p.accountKey).dmg > 0,
      boss.contrib.get(necro.p.accountKey));

    // Control: once the boss is down, worldBossPublic() goes null and ticking
    // the minion is harmless — the new branch keys off a live boss, so it
    // doesn't conjure a target from a dead one.
    const b = WB._getBoss(); if (b) b.dead = true;
    check('boss no longer live for the control case', h.worldBossPublic() === null);
    m.lastHitAt = 0;
    for (let i = 0; i < 3; i++) h.tickMinions(1.6); // must not throw / re-target the corpse

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) { console.error(e); process.exit(1); }
}, 200);
