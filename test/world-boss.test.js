// The World Boss — a periodic public mega-boss with a shared pool and a
// multi-winner payout. Tests the deterministic schedule, the damage ledger,
// the shared-spoils payout (incl. the Vanquisher bonus), leaderboard +
// achievement credit, the distance gate, and slain-this-window gating.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-wb-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    allOfType(t) { return this.sent.filter(m => m.type === t); },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const WB = h.worldBossMod;
  const PERIOD = WB.WB_PERIOD_MS, DUR = WB.WB_DURATION_MS, ARENA = WB.WB_ARENA;

  // ── Schedule ──
  const w0 = h.worldBossWindow(0);
  check('a window opens at the top of each period', w0.active && w0.startsAt === 0 && w0.endsAt === DUR, w0);
  check('the boss is gone after the duration', !h.worldBossWindow(DUR + 1000).active);
  check('the next window opens one period later', h.worldBossWindow(PERIOD).active && h.worldBossWindow(PERIOD).index === 1);
  check('window→boss-type is deterministic', WB.windowBossType(5).id === WB.windowBossType(5).id);
  const types = new Set();
  for (let i = 0; i < 12; i++) types.add(WB.windowBossType(i).id);
  check('the boss roster rotates across windows', types.size >= 2, [...types]);

  // ── Join two fighters at the Hollow ──
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
  const A = join('Ava', 1);   // will deal the most → Vanquisher
  const B = join('Ben', 2);
  h.ensureBankAccount('ava').balance = 0;
  h.ensureBankAccount('ben').balance = 0;

  // Force the CURRENT window's boss (not a fixed index 0): tickWorldBoss reads
  // the real clock, so using the live window makes the "slain-this-window"
  // gate below deterministic regardless of where the wall-clock sits in the cycle.
  const boss = WB._forceSpawn(h.worldBossWindow(Date.now()).index);
  check('a boss can be raised in the Hollow', !!boss && boss.health === boss.maxHealth, boss && boss.typeId);
  check('the public snapshot exposes the live boss', h.worldBossPublic() && h.worldBossPublic().id === 'worldboss');

  // ── Distance gate ──
  const far = { name: 'Faraway', accountKey: 'far', id: 'zzz', room: 'wilds', x: ARENA.x + 5000, y: ARENA.y };
  const refused = h.worldBossHit(far, 100);
  check('a blow from outside the fight is refused', refused.ok === false, refused);

  // ── Ledger accumulates per player ──
  const hp0 = boss.health;
  h.worldBossHit(A.p, 300);
  h.worldBossHit(B.p, 120);
  h.worldBossHit(A.p, 200);
  check('the shared pool drops by the damage dealt', boss.health === hp0 - 620, { now: boss.health, exp: hp0 - 620 });
  check('the ledger tracks each fighter', boss.contrib.get('ava').dmg === 500 && boss.contrib.get('ben').dmg === 120, { ava: boss.contrib.get('ava').dmg, ben: boss.contrib.get('ben').dmg });

  // ── The killing blow triggers the shared payout ──
  h.worldBossHit(A.p, boss.health - 40); // Ava hammers it down to a sliver, dominating the ledger
  const res = h.worldBossHit(B.p, boss.health); // Ben lands the small finisher; Ava is still top damage
  check('the finishing blow reports a kill', res.ok && res.dead, res);
  check('the boss is cleared after death', h.worldBossPublic() === null && WB._getBoss() === null);

  // Gold paid to BOTH banks; Ava (top damage) is the Vanquisher and earns more.
  const avaGold = h.ensureBankAccount('ava').balance, benGold = h.ensureBankAccount('ben').balance;
  check('every fighter is paid from the shared spoils', avaGold > 0 && benGold > 0, { avaGold, benGold });
  check('the Vanquisher (top damage) out-earns the rest', avaGold > benGold, { avaGold, benGold });
  check('the town is told the boss fell and who vanquished it',
    A.s.allOfType('announce').concat(B.s.allOfType('announce')).some(m => /slain/.test(m.message || '') && /Ava/.test(m.message || '')));

  // Both fighters receive boss-leaderboard credit + the Boss-Breaker achievement.
  const topBoss = h.lbTop('boss', h.weekKey(Date.now()), 20).map(e => e.name);
  check('both fighters score the weekly Boss board', topBoss.includes('Ava') && topBoss.includes('Ben'), topBoss);
  check('a world-boss kill unlocks the Boss-Breaker ladder',
    A.s.allOfType('achievement_unlocked').some(m => m.ach && m.ach.id === 'boss_1'));

  // ── Slain-this-window gating ──
  WB.tickWorldBoss(0.1); // same (current) window, already slain → must not respawn
  check('a slain boss does not respawn in the same window', WB._getBoss() === null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
