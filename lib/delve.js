// Weekly Delve engine (Session M) — instanced roguelite runs: floors, boon
// drafts, party descent, and the per-tick mob AI. Extracted to lib/ in Tier 3.4
// Phase B. The most-wired module: ~24 deps injected (players, send, combat, the
// dungeon helpers, leaderboards, calendar week-math, party maps, bank, world).
const { DUNGEON_MOB_KEYS_BY_TIER, DUNGEON_MOB_TYPES, DUNGEON_LORE } = require('../data/dungeons');

module.exports = function createDelve({ mulberry32, legendaryWeekIndex, weekKey, lbRankOf, lbTop, lbSetMax, LEGENDARY_EPOCH, LEGENDARY_WEEK_MS, players, send, getProgress, ensureBankAccount, saveBankAccounts, playerParty, parties, dungeonTierForLevel, nearestDungeonPlayer, PARTY_BOSS_HP_PER_ALLY, isEvading, absorbIncomingDamage, noteAttacked, WORLD, WORLD2, DUNGEON_SIZE, statContrib }) {
  const DELVE_MODS = {
    swift_shadows:  { name: 'Swift Shadows',   icon: '💨', desc: 'The dark moves 25% faster.', mobSpd: 1.25 },
    thick_hides:    { name: 'Thick Hides',     icon: '🛡️', desc: 'Creatures carry 35% more health.', mobHp: 1.35 },
    sharp_fangs:    { name: 'Sharp Fangs',     icon: '🗡️', desc: 'Creatures bite 25% harder.', mobDmg: 1.25 },
    bountiful_dark: { name: 'Bountiful Dark',  icon: '💰', desc: 'Floor purses pay half again.', goldMult: 1.5 },
    glass_souls:    { name: 'Glass Souls',     icon: '🫙', desc: 'You strike +30% — and take +30%.', playerPower: 0.3, playerTakenMult: 1.3 },
    long_dark:      { name: 'The Long Dark',   icon: '🌌', desc: 'Every floor demands two more kills.', extraKills: 2 },
    starving_moon:  { name: 'Starving Moon',   icon: '🌘', desc: 'No out-of-combat mending down here.', noMend: true },
    lucky_stars:    { name: 'Lucky Stars',     icon: '✨', desc: 'Boon drafts offer four choices, not three.', boonChoices: 4 }
  };
  const DELVE_BOONS = {
    ember_heart:  { name: 'Ember Heart',    icon: '🔥', desc: '+8% damage dealt',                 stats: { power: 0.08 } },
    bark_skin:    { name: 'Bark Skin',      icon: '🪵', desc: '−6% damage taken',                 stats: { guard: 0.06 } },
    moon_blood:   { name: 'Moon Blood',     icon: '🌕', desc: '+18 max health (and mends 18 now)', stats: { vitality: 18 }, healNow: 18 },
    quick_wick:   { name: 'Quick Wick',     icon: '🕯️', desc: 'Abilities recharge 8% faster',     stats: { haste: 0.08 } },
    cat_step:     { name: 'Cat Step',       icon: '🐈‍⬛', desc: '+6% movement speed',              stats: { swift: 0.06 } },
    red_thread:   { name: 'Red Thread',     icon: '🧵', desc: 'Heal 3% of damage you deal',       stats: { leech: 0.03 } },
    witchs_broth: { name: "Witch's Broth",  icon: '🍲', desc: 'Mend +1.2 HP/s out of combat',     mending: 1.2 },
    wolfs_bargain:{ name: "Wolf's Bargain", icon: '🐺', desc: '+15% damage dealt, +8% taken',     stats: { power: 0.15, guard: -0.08 } },
    gravedigger:  { name: "Gravedigger's Cut", icon: '⚰️', desc: 'Floor purses pay +50% to you',  goldBonus: 0.5 }
  };
  const DELVE_BOON_IDS = Object.keys(DELVE_BOONS);
  const DELVE_DRAFT_MS = 25 * 1000;
  const DELVE_SPAWN = { x: 600, y: 1090 }; // The Delve = layout 5 (pillar field), entry chamber (south)
  const DELVE_BOSS_SPAWN = { x: 600, y: 235 };
  const DELVE_LANES = [ { x:70, y:1130 }, { x:1130, y:1130 }, { x:70, y:530 }, { x:1130, y:530 }, { x:590, y:830 }, { x:150, y:70 }, { x:1050, y:70 }, { x:770, y:1130 }, { x:930, y:810 }, { x:410, y:1130 }, { x:250, y:810 }, { x:390, y:490 }, { x:810, y:490 }, { x:410, y:70 }, { x:790, y:70 }, { x:210, y:310 } ];

  function weeklyDelveMods(now) {
    const rand = mulberry32(((legendaryWeekIndex(now) * 1103515245) ^ 0x2545F491) >>> 0);
    const ids = Object.keys(DELVE_MODS);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.slice(0, 2);
  }

  const delveRuns = new Map();        // runId -> run
  const delveRunsByRoom = new Map();  // room  -> run
  let delveRunSeq = 1;

  function allDelveMobs() {
    if (!delveRuns.size) return [];
    const out = [];
    for (const run of delveRuns.values()) for (const m of run.mobs) out.push(m);
    return out;
  }
  function delveRunOf(player) {
    return player && player.delveRunId ? (delveRuns.get(player.delveRunId) || null) : null;
  }
  function delveMemberOf(player) {
    const run = delveRunOf(player);
    return run ? (run.members.get(player.id) || null) : null;
  }
  function delveModActive(run, modId) { return run.mods.includes(modId); }
  function delveModVal(run, field, fallback) {
    let v = fallback;
    for (const id of run.mods) {
      const m = DELVE_MODS[id];
      if (m && m[field] != null) v = m[field];
    }
    return v;
  }

  // Boon plumbing — delve boons speak the SAME stat vocabulary as skills and
  // gear, so statContrib() folds them in and every derived effect (damage,
  // guard, max HP, cooldowns, speed, lifesteal) just works for the run.
  function delveBoonContrib(player, statKey) {
    const member = delveMemberOf(player);
    if (!member) return 0;
    let sum = 0;
    for (const [boonId, stacks] of Object.entries(member.boons)) {
      const st = DELVE_BOONS[boonId] && DELVE_BOONS[boonId].stats;
      if (st && st[statKey]) sum += st[statKey] * stacks;
    }
    // Glass Souls: the week itself sharpens everyone's knives.
    const run = delveRunOf(player);
    if (statKey === 'power' && run) sum += delveModVal(run, 'playerPower', 0);
    return sum;
  }
  function delveMendingBonus(player) {
    const member = delveMemberOf(player);
    if (!member) return 0;
    const run = delveRunOf(player);
    if (run && delveModVal(run, 'noMend', false)) return -Infinity; // Starving Moon: no mending at all
    let sum = 0;
    for (const [boonId, stacks] of Object.entries(member.boons)) {
      if (DELVE_BOONS[boonId] && DELVE_BOONS[boonId].mending) sum += DELVE_BOONS[boonId].mending * stacks;
    }
    return sum;
  }
  function delveTakenMult(player) {
    const run = delveRunOf(player);
    return run ? delveModVal(run, 'playerTakenMult', 1) : 1;
  }

  function delveFloorTier(run) {
    return Math.min(4, run.startTier + Math.floor((run.floor - 1) / 2));
  }
  function delveKillsNeeded(run) {
    return 6 + Math.min(6, run.floor - 1) + (delveModActive(run, 'long_dark') ? DELVE_MODS.long_dark.extraKills : 0);
  }
  function delveSpawnFloor(run) {
    const tier = delveFloorTier(run);
    const floorMult = 1 + 0.12 * (run.floor - 1);
    const hpMult = floorMult * delveModVal(run, 'mobHp', 1);
    const dmgMult = floorMult * delveModVal(run, 'mobDmg', 1);
    const spdMult = delveModVal(run, 'mobSpd', 1);
    run.mobs = [];
    const keys = DUNGEON_MOB_KEYS_BY_TIER[tier];
    const count = delveKillsNeeded(run);
    for (let i = 0; i < count; i++) {
      const key = keys[Math.floor(Math.random() * keys.length)];
      const preset = DUNGEON_MOB_TYPES[key];
      const sp = DELVE_LANES[i % DELVE_LANES.length];
      const jitter = () => (Math.random() - 0.5) * 60;
      const sx = Math.max(50, Math.min(DUNGEON_SIZE - 50, sp.x + jitter()));
      const sy = Math.max(50, Math.min(DUNGEON_SIZE - 50, sp.y + jitter()));
      run.mobs.push({
        id: `delve_${run.id}_f${run.floor}_${i}`,
        mobType: key, tier, room: run.room, delve: run.id,
        hpMult, dmgMult, spdMult,
        spawnX: sx, spawnY: sy, x: sx, y: sy,
        facing: Math.random() * Math.PI * 2,
        wanderTimer: Math.random() * 2, wanderAngle: 0, paused: false,
        health: Math.round(preset.maxHealth * hpMult),
        scaledMax: Math.round(preset.maxHealth * hpMult),
        dead: false, respawnAt: 0, lastHitAt: 0
      });
    }
    // Every third floor, the tier's signature boss stalks the arena too —
    // scaled to the party like its counterpart in the named dungeons.
    if (run.floor % 3 === 0) {
      const bossKey = DUNGEON_LORE[tier].bossKey;
      const preset = DUNGEON_MOB_TYPES[bossKey];
      const alive = [...run.members.values()].filter(mm => mm.alive).length || 1;
      const bossHp = Math.round(preset.maxHealth * hpMult * (1 + PARTY_BOSS_HP_PER_ALLY * (alive - 1)));
      run.mobs.push({
        id: `delve_${run.id}_f${run.floor}_boss`,
        mobType: bossKey, tier, room: run.room, delve: run.id, boss: true, engaged: true,
        hpMult, dmgMult, spdMult,
        spawnX: DELVE_BOSS_SPAWN.x, spawnY: DELVE_BOSS_SPAWN.y,
        x: DELVE_BOSS_SPAWN.x, y: DELVE_BOSS_SPAWN.y,
        facing: Math.PI, wanderTimer: 2, wanderAngle: 0, paused: false,
        health: bossHp, scaledMax: bossHp,
        dead: false, respawnAt: 0, lastHitAt: 0
      });
    }
    run.kills = 0;
    run.killsNeeded = count; // the boss is a bonus, not a gate
    run.state = 'fighting';
  }

  function delveStatePayloadFor(run, player) {
    const member = run.members.get(player.id);
    return {
      type: 'delve_state',
      inRun: true,
      runId: run.id,
      room: run.room,
      floor: run.floor,
      tier: delveFloorTier(run),
      kills: run.kills,
      killsNeeded: run.killsNeeded,
      state: run.state,
      draftEndsAt: run.draftEndsAt || 0,
      mods: run.mods.map(id => ({ id, ...DELVE_MODS[id] })),
      members: [...run.members.entries()].map(([pid, mm]) => {
        const p = players.get(pid);
        return { id: pid, name: p ? p.name : '—', alive: mm.alive, picked: mm.picked !== false };
      }),
      myBoons: member ? member.boons : {},
      myOffer: member && member.offer ? member.offer.map(id => ({ id, ...DELVE_BOONS[id] })) : null,
      myGold: member ? member.gold : 0,
      speedMult: 1 + statContrib(player, 'swift') // client applies this while in the delve room
    };
  }
  function delveBroadcast(run) {
    for (const pid of run.members.keys()) {
      const p = players.get(pid);
      if (p) send(p.ws, delveStatePayloadFor(run, p));
    }
  }

  // The lobby/menu view (not in a run): this week's twists + boards.
  function delveMenuPayload(player) {
    const now = Date.now();
    const wk = weekKey(now);
    return {
      type: 'delve_state',
      inRun: false,
      week: wk,
      weekEndsAt: LEGENDARY_EPOCH + (legendaryWeekIndex(now) + 1) * LEGENDARY_WEEK_MS,
      mods: weeklyDelveMods(now).map(id => ({ id, ...DELVE_MODS[id] })),
      best: player.accountKey ? (lbRankOf('delve', wk, player.accountKey) || { rank: null, value: 0 }) : { rank: null, value: 0 },
      top: lbTop('delve', wk, 5),
      isGuest: !player.accountKey
    };
  }

  function delveStart(player) {
    if (player.isDead) return;
    if (delveRunOf(player)) return;
    const room = player.room || 'outside';
    // No delving out of the underworld's own pockets — come up for air first.
    if (room.startsWith('dungeon_') || room === 'ember_wastes' || room === 'bank_vault' || room === 'witch_cave') {
      send(player.ws, { type: 'delve_error', message: 'The Delve opens from the town and the Wilds — come up out of there first.' });
      return;
    }
    const id = delveRunSeq++;
    const run = {
      id,
      room: `dungeon_delve_${id}`,
      startedAt: Date.now(),
      week: weekKey(Date.now()),
      mods: weeklyDelveMods(Date.now()),
      floor: 1, kills: 0, killsNeeded: 0,
      mobs: [], state: 'fighting', draftEndsAt: 0,
      members: new Map(),
      startTier: 1
    };
    // The starter and any party members standing with them descend together.
    const group = [player];
    const partyId = playerParty.get(player.id);
    if (partyId) {
      const party = parties.get(partyId);
      if (party) {
        for (const memberId of party.members) {
          if (memberId === player.id) continue;
          const m = players.get(memberId);
          if (m && m.room === player.room && !m.isDead && !delveRunOf(m)) group.push(m);
        }
      }
    }
    // The floor matches the strongest delver — brave for the low-levels, honest
    // for the veterans (no farming tier-1 rats at level 20).
    run.startTier = dungeonTierForLevel(Math.max(...group.map(p => getProgress(p).level)));
    for (const p of group) {
      run.members.set(p.id, {
        boons: {}, alive: true, picked: true, offer: null, gold: 0,
        returnRoom: p.room || 'outside'
      });
      p.delveRunId = id;
      const jitter = () => (Math.random() - 0.5) * 60;
      p.x = DELVE_SPAWN.x + jitter(); p.y = DELVE_SPAWN.y + jitter();
      p.room = run.room;
      p.roomLockUntil = Date.now() + 1500; // outlive any in-flight stale moves
      send(p.ws, { type: 'dungeon_entered', tier: run.startTier, room: run.room, spawn: { x: p.x, y: p.y }, level: getProgress(p).level, delve: true, floor: 1 });
    }
    delveRuns.set(id, run);
    delveRunsByRoom.set(run.room, run);
    delveSpawnFloor(run);
    delveBroadcast(run);
  }

  function noteDelveKill(player, mob) {
    const run = delveRuns.get(mob.delve);
    if (!run || run.state !== 'fighting') return;
    run.kills++;
    if (run.kills >= run.killsNeeded) {
      // Floor cleared — purses, then the boon draft.
      const goldMult = delveModVal(run, 'goldMult', 1);
      for (const [pid, mm] of run.members) {
        if (!mm.alive) continue;
        const p = players.get(pid);
        if (!p) continue;
        let purse = Math.round((12 + 8 * run.floor) * goldMult);
        const digger = mm.boons.gravedigger || 0;
        if (digger) purse = Math.round(purse * (1 + DELVE_BOONS.gravedigger.goldBonus * digger));
        mm.gold += purse;
        if (p.accountKey) {
          ensureBankAccount(p.accountKey).balance += purse;
        }
        const choices = delveModVal(run, 'boonChoices', 3);
        const pool = [...DELVE_BOON_IDS];
        mm.offer = [];
        for (let i = 0; i < choices && pool.length; i++) {
          mm.offer.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        }
        mm.picked = false;
      }
      saveBankAccounts();
      run.state = 'draft';
      run.draftEndsAt = Date.now() + DELVE_DRAFT_MS;
      delveBroadcast(run);
    } else {
      delveBroadcast(run);
    }
  }

  function delveAdvanceFloor(run) {
    run.floor++;
    for (const mm of run.members.values()) { mm.offer = null; mm.picked = true; }
    delveSpawnFloor(run);
    for (const pid of run.members.keys()) {
      const p = players.get(pid);
      if (p) send(p.ws, { type: 'announce_soft', message: `🕳️ Floor ${run.floor} — ${DUNGEON_LORE[delveFloorTier(run)].name}'s creatures stir…` });
    }
    delveBroadcast(run);
  }

  function delveDepthOf(run) { return Math.max(0, run.floor - 1); }

  function delveLeave(player, reason) {
    const run = delveRunOf(player);
    if (!run) return;
    const member = run.members.get(player.id);
    const depth = delveDepthOf(run);
    lbSetMax('delve', player, depth);
    run.members.delete(player.id);
    player.delveRunId = null;
    const returnRoom = (member && member.returnRoom) || 'outside';
    // A disconnect's position is restored by the resume stash instead.
    if (reason !== 'disconnect') {
      const returnPos = returnRoom === 'wilds' ? WORLD2.spawn : WORLD.spawn;
      player.x = returnPos.x; player.y = returnPos.y;
      player.room = returnRoom;
      player.roomLockUntil = Date.now() + 1500;
      send(player.ws, {
        type: 'delve_over',
        depth,
        gold: member ? member.gold : 0,
        reason: reason || 'exit',
        room: returnRoom, x: player.x, y: player.y,
        best: player.accountKey ? (lbRankOf('delve', weekKey(Date.now()), player.accountKey) || null) : null
      });
    }
    if (run.members.size === 0) {
      delveRuns.delete(run.id);
      delveRunsByRoom.delete(run.room);
    } else {
      delveBroadcast(run);
    }
  }

  // Delve mob AI — same brain as tickDungeon, scoped to each run's floor,
  // with the week's stat twists applied. Dead delve mobs stay dead (a floor
  // is about clearing it); wipes end the run for whoever's left dead.
  function tickDelves(dt) {
    if (!delveRuns.size) return;
    const now = Date.now();
    const margin = 40;
    for (const run of delveRuns.values()) {
      if (run.state === 'draft') {
        const everyonePicked = [...run.members.values()].every(mm => !mm.alive || mm.picked);
        if (everyonePicked || now >= run.draftEndsAt) {
          // Time's up: the undecided get the first offer (never nothing).
          for (const mm of run.members.values()) {
            if (mm.alive && !mm.picked && mm.offer && mm.offer.length) {
              mm.boons[mm.offer[0]] = (mm.boons[mm.offer[0]] || 0) + 1;
              mm.picked = true; mm.offer = null;
            }
          }
          delveAdvanceFloor(run);
        }
        continue;
      }
      for (const m of run.mobs) {
        if (m.dead) continue;
        const preset = DUNGEON_MOB_TYPES[m.mobType];
        const speed = preset.speed * (m.spdMult || 1);
        const { player: nearestP, dist } = nearestDungeonPlayer(m.room, m.x, m.y);
        let vx = 0, vy = 0;
        if (m.scaredUntil > now && nearestP) {
          const dx = m.x - nearestP.x, dy = m.y - nearestP.y;
          const inv = dist > 0.01 ? 1 / dist : 0;
          vx = dx * inv * speed; vy = dy * inv * speed;
        } else if (nearestP && dist < preset.aggroRadius && !isEvading(nearestP)) {
          const dx = nearestP.x - m.x, dy = nearestP.y - m.y;
          const inv = dist > 0.01 ? 1 / dist : 0;
          vx = dx * inv * speed; vy = dy * inv * speed;
          if (dist < preset.strikeRange && (!m.lastHitAt || now - m.lastHitAt >= preset.hitCooldownMs)) {
            m.lastHitAt = now;
            const rolled = Math.round((preset.dmgMin + Math.floor(Math.random() * (preset.dmgMax - preset.dmgMin + 1))) * (m.dmgMult || 1));
            const dmg = absorbIncomingDamage(nearestP, rolled);
            nearestP.health = Math.max(0, nearestP.health - dmg);
            noteAttacked(nearestP);
            if (nearestP.health <= 0) {
              nearestP.health = 0;
              nearestP.isDead = true;
              send(nearestP.ws, { type: 'you_died', byName: preset.name, mobId: m.id });
              const mm = run.members.get(nearestP.id);
              if (mm) mm.alive = false;
              const anyAlive = [...run.members.values()].some(x => x.alive);
              if (!anyAlive) {
                // Full wipe: the run is over; each ghost's respawn (or exit)
                // walks them out through delveLeave with the depth recorded.
                for (const pid of run.members.keys()) {
                  const pp = players.get(pid);
                  if (pp) send(pp.ws, { type: 'announce_soft', message: `☠️ The Delve claims the whole party at floor ${run.floor}. Depth ${delveDepthOf(run)} stands.` });
                }
              } else {
                delveBroadcast(run);
              }
            } else {
              send(nearestP.ws, { type: 'struck', byName: preset.name, damage: dmg, mobId: m.id });
            }
          }
        } else {
          m.wanderTimer -= dt;
          if (m.wanderTimer <= 0) {
            m.wanderTimer = 1.5 + Math.random() * 2.5;
            m.paused = Math.random() < 0.3;
            m.wanderAngle = Math.random() * Math.PI * 2;
          }
          if (!m.paused) {
            vx = Math.sin(m.wanderAngle) * speed * 0.3;
            vy = Math.cos(m.wanderAngle) * speed * 0.3;
          }
        }
        const nx = m.x + vx * dt, ny = m.y + vy * dt;
        if (vx !== 0 && nx > margin && nx < DUNGEON_SIZE - margin) m.x = nx;
        if (vy !== 0 && ny > margin && ny < DUNGEON_SIZE - margin) m.y = ny;
        if (vx !== 0 || vy !== 0) m.facing = Math.atan2(vx, vy);
      }
    }
  }

  return { delveRuns, delveRunsByRoom, weeklyDelveMods, delveBoonContrib, delveTakenMult, delveMendingBonus, delveStart, delveLeave, tickDelves, noteDelveKill, delveMenuPayload, delveRunOf, allDelveMobs, delveSpawnFloor, delveStatePayloadFor, delveBroadcast, DELVE_MODS, DELVE_BOONS };
};
