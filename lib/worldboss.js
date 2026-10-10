// The World Boss (Session N) — a periodic public mega-boss that rises in the
// far north of the Wilds (the Blighted Hollow) for the whole town to rally
// against. Unlike dungeon/Delve bosses, it has ONE shared health pool, a
// per-player damage ledger, and a multi-winner payout: everyone who landed a
// blow shares in the spoils, and the top contributor is crowned the Vanquisher.
//
// The spawn schedule is DETERMINISTIC from the server clock (a window opens
// every WB_PERIOD; the boss holds the Hollow for up to WB_DURATION or until
// slain), so every client agrees without a handshake and the whole thing is
// testable against a fixed clock. Once slain in a window it stays dead until
// the next window opens.
//
// Pure-ish: all world/combat/economy helpers are injected; the module owns
// only the boss entity, its ledger, and the schedule math.

// The Blighted Hollow — a fixed arena in the far north, away from the spawn
// portal (y≈8800) and the village (y≈3000), so the boss is a destination.
const WB_ARENA = { x: 5000, y: 1500 };
const WB_PERIOD_MS = 3 * 60 * 60 * 1000;  // a window opens every 3 hours
const WB_DURATION_MS = 30 * 60 * 1000;    // the boss holds the Hollow for 30 min
const WB_ENRAGE_AT = 0.5;                 // below half health it hits ~40% harder
const WB_ENRAGE_MULT = 1.4;

// Three rotating bosses, chosen per-window by a seeded roll. Health pools are
// sized for a town rally (several players over a few minutes), not a solo kill.
const WB_TYPES = [
  { id: 'hollow_king', name: 'The Hollow King', icon: '👑', visual: 'skeleton',
    maxHealth: 6000, dmgMin: 26, dmgMax: 42, speed: 95, aggroRadius: 560, strikeRange: 110, hitCooldownMs: 1500,
    xp: 130, gold: 280, blurb: 'A crowned skeleton king drags his court up from the barrow.' },
  { id: 'gloamwyrm', name: 'Gloamwyrm', icon: '🐉', visual: 'wyrm',
    maxHealth: 7200, dmgMin: 30, dmgMax: 48, speed: 110, aggroRadius: 600, strikeRange: 120, hitCooldownMs: 1700,
    xp: 150, gold: 320, blurb: 'A wyrm of living dusk uncoils across the Hollow.' },
  { id: 'thorn_mother', name: 'Mother of Thorns', icon: '🥀', visual: 'briar',
    maxHealth: 6600, dmgMin: 24, dmgMax: 40, speed: 80, aggroRadius: 540, strikeRange: 130, hitCooldownMs: 1400,
    xp: 140, gold: 300, blurb: 'The briar itself stands up and starts walking.' },
];
const WB_TYPE_BY_ID = Object.fromEntries(WB_TYPES.map(t => [t.id, t]));

// The world boss's own loot table — rare crafting catalysts + materials that
// feed the Artificer's Workshop, rolled once per contributor (instanced, so a
// rally never squabbles over one corpse).
const WB_LOOT = [
  { itemId: 'enchanted_gem', chance: 0.35 },
  { itemId: 'dragon_scale',  chance: 0.25 },
  { itemId: 'druid_stone',   chance: 0.25 },
  { itemId: 'shadow_essence', chance: 0.6, qty: 2 },
  { itemId: 'iron_ore',      chance: 0.7, qty: 3 },
  { itemId: 'glimmerdust',   chance: 0.5, qty: 2 },
];

module.exports = function createWorldBoss({
  players, send, broadcastAll, broadcastRoom, broadcastHitFx,
  nearestWildsPlayer, isEvading, absorbIncomingDamage, noteAttacked,
  ensureBankAccount, saveBankAccounts, findConnectionByAccountKey,
  grantXP, getInventory, addItemToAccount, saveInventories, inventoryStatePayload,
  ITEM_CATALOG, lbBump, noteBossKill, mulberry32, now: nowFn,
}) {
  const now = () => (typeof nowFn === 'function' ? nowFn() : Date.now());

  // ── Schedule ──────────────────────────────────────────────────────────────
  function worldBossWindow(t) {
    const index = Math.floor(t / WB_PERIOD_MS);
    const startsAt = index * WB_PERIOD_MS;
    const endsAt = startsAt + WB_DURATION_MS;
    return { index, startsAt, endsAt, active: t >= startsAt && t < endsAt };
  }
  function windowBossType(index) {
    const seed = (index * 2654435761) >>> 0;
    return WB_TYPES[Math.floor(mulberry32(seed)() * WB_TYPES.length)];
  }

  // ── Live boss ───────────────────────────────────────────────────────────────
  let boss = null;            // the live entity, or null
  let lastSlainWindow = null; // window index whose boss has already been slain

  function spawnBoss(windowIndex) {
    const type = windowBossType(windowIndex);
    boss = {
      id: 'worldboss',
      typeId: type.id,
      windowIndex,
      x: WB_ARENA.x, y: WB_ARENA.y, facing: Math.PI,
      health: type.maxHealth, maxHealth: type.maxHealth,
      dead: false, bornAt: now(),
      contrib: new Map(), // keyed by accountKey||('g_'+playerId) -> { name, dmg, accountKey }
      lastHitAt: 0, wanderTimer: 0, wanderAngle: 0,
    };
    broadcastAll({ type: 'announce', message: `${type.icon} ${type.name} has risen in the Blighted Hollow, far to the north of the Wilds! ${type.blurb} Rally and bring it down.` });
    broadcastAll({ type: 'world_boss_rose', typeId: type.id, name: type.name, icon: type.icon, x: WB_ARENA.x, y: WB_ARENA.y });
  }

  function retreatBoss() {
    if (!boss) return;
    const type = WB_TYPE_BY_ID[boss.typeId];
    broadcastAll({ type: 'announce', message: `${type.icon} ${type.name} sinks back into the Hollow, unbroken. It will rise again.` });
    broadcastAll({ type: 'world_boss_gone', slain: false });
    boss = null;
  }

  // ── Damage + death ───────────────────────────────────────────────────────────
  function ledgerKey(player) { return player.accountKey || ('g_' + player.id); }
  function recordDamage(player, dmg) {
    const k = ledgerKey(player);
    const e = boss.contrib.get(k) || { name: player.name, dmg: 0, accountKey: player.accountKey || null, playerId: player.id };
    e.name = player.name; e.dmg += dmg; e.playerId = player.id;
    boss.contrib.set(k, e);
  }
  // Resolve a ledger entry to a live connection, or null if they've left.
  function onlineFor(e) {
    if (e.accountKey) { const c = findConnectionByAccountKey(e.accountKey); if (c) return c; }
    const p = players.get(e.playerId);
    return (p && p.ws && p.ws.readyState === p.ws.OPEN) ? p : null;
  }

  // Called from applyDamage's world_boss branch. Returns an applyDamage-shaped
  // result so the attack handlers can respond uniformly.
  function worldBossHit(player, dmg) {
    if (!boss || boss.dead || player.room !== 'wilds') return { ok: false };
    if (Math.hypot(boss.x - player.x, boss.y - player.y) > 700) return { ok: false, range: true }; // must be in the fight
    const type = WB_TYPE_BY_ID[boss.typeId];
    boss.health = Math.max(0, boss.health - dmg);
    recordDamage(player, dmg);
    broadcastHitFx('wilds', 'world_boss', boss.id, dmg, boss.health <= 0, player.id);
    if (boss.health <= 0) { killBoss(player); return { ok: true, dead: true, dmg, name: type.name, xp: type.xp }; }
    return { ok: true, dead: false, dmg, name: type.name };
  }

  function killBoss(finisher) {
    const type = WB_TYPE_BY_ID[boss.typeId];
    boss.dead = true;
    lastSlainWindow = boss.windowIndex;
    // Rank contributors by damage; the top is the Vanquisher.
    const ranked = [...boss.contrib.values()].sort((a, b) => b.dmg - a.dmg);
    const mvp = ranked[0] || null;
    const totalDmg = ranked.reduce((s, e) => s + e.dmg, 0) || 1;

    for (const e of ranked) {
      if (e.dmg <= 0) continue;
      const isMvp = mvp && e === mvp;
      const online = onlineFor(e);
      // XP: full boss XP for everyone who helped; double for the Vanquisher.
      if (online) grantXP(online, isMvp ? type.xp * 2 : type.xp);
      // Gold to the bank (account players only), scaled a little by share so a
      // tagger doesn't out-earn the people who carried it, floored so everyone
      // who truly fought still gets a real purse. MVP gets a fixed bonus.
      if (e.accountKey) {
        const share = e.dmg / totalDmg;
        const gold = Math.max(Math.round(type.gold * 0.4), Math.round(type.gold * share)) + (isMvp ? Math.round(type.gold * 0.5) : 0);
        ensureBankAccount(e.accountKey).balance += gold;
        if (online) send(online.ws, { type: 'announce', message: `💰 ${gold} gold from the ${type.name} has been paid to your bank.` });
      }
      // Instanced loot: a personal roll delivered straight to the pack.
      if (online) {
        const earned = [];
        for (const d of WB_LOOT) {
          if (Math.random() < d.chance) { const q = d.qty || 1; if (addItemToAccount(getInventory(online), d.itemId, q)) earned.push({ itemId: d.itemId, qty: q }); }
        }
        if (earned.length) {
          if (online.accountKey) saveInventories();
          send(online.ws, { type: 'inventory_state', ...inventoryStatePayload(online) });
          send(online.ws, { type: 'loot_drop', items: earned });
        }
        // Boss credit: leaderboard + the Boss-Breaker achievement ladder.
        try { lbBump('boss', online, 1); } catch (err) {}
        try { noteBossKill(online, boss); } catch (err) {}
      }
    }
    const mvpName = mvp ? mvp.name : 'the town';
    broadcastAll({ type: 'announce', message: `${type.icon} ${type.name} has been slain! ${mvpName} struck hardest and is named Vanquisher. The spoils are shared among all who fought.` });
    broadcastAll({ type: 'world_boss_gone', slain: true, name: type.name, icon: type.icon, vanquisher: mvpName });
    boss = null;
  }

  // ── AI tick ───────────────────────────────────────────────────────────────────
  function tickWorldBoss(dt) {
    const t = now();
    const w = worldBossWindow(t);
    // Spawn / retreat management.
    if (boss && boss.windowIndex !== w.index) retreatBoss();
    if (boss && !w.active) retreatBoss();
    if (!boss && w.active && lastSlainWindow !== w.index) spawnBoss(w.index);
    if (!boss) return;

    const type = WB_TYPE_BY_ID[boss.typeId];
    const margin = 60;
    const { player: nearestP, dist } = nearestWildsPlayer(boss.x, boss.y);
    let vx = 0, vy = 0;
    if (nearestP && dist < type.aggroRadius && !isEvading(nearestP)) {
      const dx = nearestP.x - boss.x, dy = nearestP.y - boss.y;
      const inv = dist > 0.01 ? 1 / dist : 0;
      vx = dx * inv * type.speed; vy = dy * inv * type.speed;
      if (dist < type.strikeRange && (!boss.lastHitAt || t - boss.lastHitAt >= type.hitCooldownMs)) {
        boss.lastHitAt = t;
        const enrage = boss.health <= boss.maxHealth * WB_ENRAGE_AT ? WB_ENRAGE_MULT : 1;
        const base = Math.round((type.dmgMin + Math.floor(Math.random() * (type.dmgMax - type.dmgMin + 1))) * enrage);
        const dmg = absorbIncomingDamage(nearestP, base);
        nearestP.health = Math.max(0, nearestP.health - dmg);
        noteAttacked(nearestP);
        if (nearestP.health <= 0) { nearestP.health = 0; nearestP.isDead = true; send(nearestP.ws, { type: 'you_died', byName: type.name, mobId: boss.id }); }
        else send(nearestP.ws, { type: 'struck', byName: type.name, damage: dmg, mobId: boss.id });
      }
    } else {
      // Patrol slowly around the Hollow when no one's near.
      boss.wanderTimer -= dt;
      if (boss.wanderTimer <= 0) { boss.wanderTimer = 2 + Math.random() * 3; boss.wanderAngle = Math.random() * Math.PI * 2; }
      vx = Math.sin(boss.wanderAngle) * (type.speed * 0.25);
      vy = Math.cos(boss.wanderAngle) * (type.speed * 0.25);
      // Drift home if it has wandered too far from the arena.
      if (Math.hypot(boss.x - WB_ARENA.x, boss.y - WB_ARENA.y) > 400) {
        const dx = WB_ARENA.x - boss.x, dy = WB_ARENA.y - boss.y, d = Math.hypot(dx, dy) || 1;
        vx = dx / d * type.speed * 0.3; vy = dy / d * type.speed * 0.3;
      }
    }
    const nx = boss.x + vx * dt, ny = boss.y + vy * dt;
    if (vx !== 0 && nx > margin && nx < 10000 - margin) boss.x = nx;
    if (vy !== 0 && ny > margin && ny < 10000 - margin) boss.y = ny;
    if (vx !== 0 || vy !== 0) boss.facing = Math.atan2(vx, vy);
  }

  // ── Public snapshot for wildlife_state (null when no boss is up) ──────────────
  function worldBossPublic() {
    if (!boss || boss.dead) return null;
    const type = WB_TYPE_BY_ID[boss.typeId];
    return { id: boss.id, typeId: boss.typeId, name: type.name, icon: type.icon, visual: type.visual,
      x: boss.x, y: boss.y, facing: boss.facing, health: boss.health, maxHealth: boss.maxHealth };
  }
  function worldBossRenderPos() { return (boss && !boss.dead) ? { x: boss.x, y: boss.y } : null; }

  // Test/debug helpers.
  function _getBoss() { return boss; }
  function _forceSpawn(index) { lastSlainWindow = null; spawnBoss(index != null ? index : worldBossWindow(now()).index); return boss; }

  return {
    WB_TYPES, WB_TYPE_BY_ID, WB_LOOT, WB_ARENA, WB_PERIOD_MS, WB_DURATION_MS,
    worldBossWindow, windowBossType, tickWorldBoss, worldBossHit, worldBossPublic, worldBossRenderPos,
    _getBoss, _forceSpawn,
  };
};
