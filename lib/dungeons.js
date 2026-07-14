// Dungeon engine (Session L) — shared tier-arena mobs/bosses + the per-tick
// combat loop. Extracted to lib/ in Tier 3.4 Phase B. Data catalogs required
// here; players/send/combat helpers + DUNGEON_ROOMS/SIZE injected. The
// findDungeonTarget bridge (dungeon+delve) and the master tick loop stay in server.js.
const { DUNGEON_LORE, DUNGEON_MOB_TYPES, DUNGEON_MOB_KEYS_BY_TIER, DUNGEON_SPAWN_POSITIONS, DUNGEON_SPAWN_POSITIONS_BY_TIER } = require('../data/dungeons');

module.exports = function createDungeons({ players, send, isEvading, absorbIncomingDamage, noteAttacked, DUNGEON_ROOMS, DUNGEON_SIZE }) {
  function dungeonTierForLevel(level) {
    if (level <= 5)  return 1;
    if (level <= 10) return 2;
    if (level <= 15) return 3;
    return 4;
  }

  // Build dungeonMobs: 8 types × 4 tiers × 2 instances = 64 total
  const dungeonMobs = [];
  for (const [tierStr, keys] of Object.entries(DUNGEON_MOB_KEYS_BY_TIER)) {
    const tier = Number(tierStr);
    const room = DUNGEON_ROOMS[tier];
    const _positions = DUNGEON_SPAWN_POSITIONS_BY_TIER[tier] || DUNGEON_SPAWN_POSITIONS;
    let _ti = 0;
    for (const key of keys) {
      const preset = DUNGEON_MOB_TYPES[key];
      for (let inst = 0; inst < 2; inst++) {
        const sp = _positions[_ti % _positions.length];
        _ti++;
        const jitter = () => (Math.random() - 0.5) * 60;
        const sx = Math.max(50, Math.min(DUNGEON_SIZE - 50, sp.x + jitter()));
        const sy = Math.max(50, Math.min(DUNGEON_SIZE - 50, sp.y + jitter()));
        dungeonMobs.push({
          id: `dung_${key}_${inst}`,
          mobType: key, tier, room,
          spawnX: sx, spawnY: sy, x: sx, y: sy,
          facing: Math.random() * Math.PI * 2,
          wanderTimer: Math.random() * 2, wanderAngle: 0, paused: false,
          health: preset.maxHealth, dead: false, respawnAt: 0,
          lastHitAt: 0
        });
      }
    }
  }

  // One signature boss per tier, holding the middle-north of the arena (the
  // exit portal stays reachable along the walls for anyone not looking for a
  // fight). Slower respawn than the rank-and-file so a boss kill stays an
  // event, not a farm.
  const DUNGEON_BOSS_SPAWN = { x: 600, y: 360 };
  // Per-tier boss position. Tier 1's boss (Old Gnawbone) holds the deep north
  // chamber of the Rootcellar labyrinth; other tiers keep the old arena spot.
  const DUNGEON_BOSS_SPAWN_BY_TIER = { 1: { x: 600, y: 225 }, 2: { x: 235, y: 600 }, 3: { x: 600, y: 600 }, 4: { x: 600, y: 600 } };
  const DUNGEON_ENTRY_BY_TIER = { 1: { x: 600, y: 1080 }, 2: { x: 1080, y: 600 }, 3: { x: 600, y: 1090 }, 4: { x: 600, y: 1090 } };
  const DUNGEON_BOSS_RESPAWN_MS = 5 * 60 * 1000;
  for (const tier of [1, 2, 3, 4]) {
    const key = DUNGEON_LORE[tier].bossKey;
    const preset = DUNGEON_MOB_TYPES[key];
    const _bsp = DUNGEON_BOSS_SPAWN_BY_TIER[tier] || DUNGEON_BOSS_SPAWN;
    dungeonMobs.push({
      id: `dungboss_t${tier}`,
      mobType: key, tier, room: DUNGEON_ROOMS[tier], boss: true,
      spawnX: _bsp.x, spawnY: _bsp.y,
      x: _bsp.x, y: _bsp.y,
      facing: Math.PI, wanderTimer: 2, wanderAngle: 0, paused: false,
      health: preset.maxHealth, scaledMax: preset.maxHealth, engaged: false,
      dead: false, respawnAt: 0, lastHitAt: 0
    });
  }

  // Party scaling (Session L): the moment a boss first engages, its health
  // pool grows +60% per extra living player in the room — so a full party
  // fights a monument, not a piñata. Computed once per life (at engage), so
  // mid-fight joins/leaves can't yo-yo the bar.
  const PARTY_BOSS_HP_PER_ALLY = 0.6;
  function playersInRoom(room) {
    let n = 0;
    for (const p of players.values()) if (p.room === room && !p.isDead) n++;
    return n;
  }
  function bossEngagedScale(m, preset) {
    const n = Math.max(1, playersInRoom(m.room));
    m.engaged = true;
    m.scaledMax = Math.round(preset.maxHealth * (1 + PARTY_BOSS_HP_PER_ALLY * (n - 1)));
    m.health = m.scaledMax;
  }
  function dungeonMobMaxHealth(m) {
    const preset = DUNGEON_MOB_TYPES[m.mobType];
    return (m.boss && m.scaledMax) ? m.scaledMax : preset.maxHealth;
  }

  function nearestDungeonPlayer(room, x, y) {
    let best = null, bestDist = Infinity;
    for (const p of players.values()) {
      if (p.room !== room || p.isDead) continue;
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return { player: best, dist: bestDist };
  }

  // Fresh-run repopulate (Session M): each dungeon tier is ONE shared,
  // persistent room, so walking back into a tier you just cleared finds it
  // still on the 60s / 5-min respawn timers rather than freshly stocked. When a
  // dungeon room has no players in it, the next entry is a brand-new run, so
  // snap every one of that tier's mobs (and its boss) back to full at their
  // spawn points. Mirrors the revive branch in tickDungeon exactly. Gated by
  // the caller on the room being empty so it can never revive mobs out from
  // under someone already fighting the shared instance.
  function resetDungeonRoom(room) {
    for (const m of dungeonMobs) {
      if (m.room !== room) continue;
      m.dead = false;
      m.respawnAt = 0;
      m.health = DUNGEON_MOB_TYPES[m.mobType].maxHealth;
      m.x = m.spawnX; m.y = m.spawnY;
      m.pendingLoot = null; m.lootKillerId = null;
      if (m.boss) { m.engaged = false; m.scaledMax = DUNGEON_MOB_TYPES[m.mobType].maxHealth; }
    }
  }

  function tickDungeon(dt) {
    const now = Date.now();
    const margin = 40;
    for (const m of dungeonMobs) {
      if (m.dead) {
        if (now >= m.respawnAt) {
          m.dead = false;
          m.health = DUNGEON_MOB_TYPES[m.mobType].maxHealth;
          if (m.boss) { m.engaged = false; m.scaledMax = DUNGEON_MOB_TYPES[m.mobType].maxHealth; }
          m.x = m.spawnX; m.y = m.spawnY;
          m.pendingLoot = null; m.lootKillerId = null;
        }
        continue;
      }
      const preset = DUNGEON_MOB_TYPES[m.mobType];
      const { player: nearestP, dist } = nearestDungeonPlayer(m.room, m.x, m.y);
      let vx = 0, vy = 0;
      // Leashing (labyrinth revamp): dungeon mobs hold their chamber. They chase
      // only while within chaseLeash of their spawn, and walk home if they drift
      // past their leash — so the client-side walls that block the PLAYER never
      // strand a mob far from where it belongs.
      const spawnDist = Math.hypot(m.x - m.spawnX, m.y - m.spawnY);
      const leash = m.boss ? 300 : 150;
      const chaseLeash = leash + 130;
      if (m.scaredUntil > now && nearestP) {
        const dx = m.x - nearestP.x, dy = m.y - nearestP.y;
        const inv = dist > 0.01 ? 1 / dist : 0;
        vx = dx * inv * preset.speed;
        vy = dy * inv * preset.speed;
      } else if (nearestP && dist < preset.aggroRadius && !isEvading(nearestP) && spawnDist < chaseLeash) {
        // A boss sizes up the whole room the first time it stirs (Session L).
        if (m.boss && !m.engaged) bossEngagedScale(m, preset);
        const dx = nearestP.x - m.x, dy = nearestP.y - m.y;
        const inv = dist > 0.01 ? 1 / dist : 0;
        vx = dx * inv * preset.speed;
        vy = dy * inv * preset.speed;
        if (dist < preset.strikeRange && (!m.lastHitAt || now - m.lastHitAt >= preset.hitCooldownMs)) {
          m.lastHitAt = now;
          const dmg = absorbIncomingDamage(nearestP, preset.dmgMin + Math.floor(Math.random() * (preset.dmgMax - preset.dmgMin + 1)));
          nearestP.health = Math.max(0, nearestP.health - dmg);
          noteAttacked(nearestP);
          if (nearestP.health <= 0) {
            nearestP.health = 0;
            nearestP.isDead = true;
            send(nearestP.ws, { type: 'you_died', byName: preset.name, mobId: m.id });
          } else {
            send(nearestP.ws, { type: 'struck', byName: preset.name, damage: dmg, mobId: m.id });
          }
        }
      } else if (spawnDist > leash * 0.9) {
        // Drifted too far from home — walk back toward spawn.
        const dx = m.spawnX - m.x, dy = m.spawnY - m.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > 8) { vx = dx / d * preset.speed * 0.5; vy = dy / d * preset.speed * 0.5; }
      } else {
        m.wanderTimer -= dt;
        if (m.wanderTimer <= 0) {
          m.wanderTimer = 1.5 + Math.random() * 2.5;
          m.paused = Math.random() < 0.3;
          m.wanderAngle = Math.random() * Math.PI * 2;
        }
        if (!m.paused) {
          vx = Math.sin(m.wanderAngle) * (preset.speed * 0.35);
          vy = Math.cos(m.wanderAngle) * (preset.speed * 0.35);
        }
      }
      const nx = m.x + vx * dt, ny = m.y + vy * dt;
      if (vx !== 0 && nx > margin && nx < DUNGEON_SIZE - margin) m.x = nx;
      if (vy !== 0 && ny > margin && ny < DUNGEON_SIZE - margin) m.y = ny;
      if (vx !== 0 || vy !== 0) m.facing = Math.atan2(vx, vy);
    }
  }

  return { dungeonTierForLevel, dungeonMobs, dungeonMobMaxHealth, nearestDungeonPlayer, resetDungeonRoom, tickDungeon, bossEngagedScale, playersInRoom, DUNGEON_ENTRY_BY_TIER, DUNGEON_BOSS_RESPAWN_MS, PARTY_BOSS_HP_PER_ALLY };
};
