// ---------------------------------------------------------------------------
// The Necromancer's undead (Session N) — client rendering for summoned
// minions, reconciled from the periodic 'wildlife_state' broadcast's `minions`
// field (only the player's own room is ever sent). The three summon tiers map
// to KayKit Skeletons-pack models (CC0): Risen Skeleton → Skeleton Minion,
// Bone Knight → Skeleton Warrior, Grave Wight → Skeleton Rogue (hooded). Each
// CLAWS UP out of the ground on a rise animation, walks/attacks on the shared
// KayKit rig (borrowed clips), and CRUMBLES — sinks and shrinks — when slain.
// If the KayKit assets aren't ready it falls back to the procedural rig.
// ---------------------------------------------------------------------------

// Per-tier KayKit model + sizing. sink = how far below ground it starts the
// rise. attack = the clip one-shot when it lands a blow.
const MINION_KK = {
  skeleton:    { key: 'skel_minion',  height: 58, sink: 58, attack: 'Unarmed_Melee_Attack_Punch_A' },
  bone_knight: { key: 'skel_warrior', height: 74, sink: 74, attack: '2H_Melee_Attack_Slice' },
  grave_wight: { key: 'skel_rogue',   height: 66, sink: 66, attack: '1H_Melee_Attack_Slice_Diagonal' },
};
// Procedural fallback presets (used only if the KayKit models failed to load).
const MINION_VISUALS = {
  skeleton:    { scale: 0.95, sink: 70,  preset: { skin: 0xe8e4d6, hair: 0x2a2620, hairStyle: 'bald', eye: 0x7cff9a, shirt: 0x3a3630, pants: 0x2a2620 } },
  bone_knight: { scale: 1.15, sink: 85,  preset: { skin: 0xdcd6c4, hair: 0x1c1a14, hairStyle: 'buzz', eye: 0x8cffb0, shirt: 0x35312a, pants: 0x242018 } },
  grave_wight: { scale: 1.35, sink: 100, preset: { skin: 0xb8c0b0, hair: 0x101410, hairStyle: 'long', eye: 0xaaff88, shirt: 0x1e2a1e, pants: 0x141c14 } },
};

export default function createMinions({ createHumanoid, lerpAngle, makeHealthBarSprite, updateHealthBar, getActiveScene, getFloorHeight, getMe, createKayKitByKey, kkSetState, kkOneShot, hasKK }) {
let pool = {}; // id -> visual record

function removeRec(v) {
  if (v.group && v.group.parent) v.group.parent.remove(v.group);
  if (v.dispose) { try { v.dispose(); } catch (e) {} }
}
function destroyAll() { for (const id in pool) removeRec(pool[id]); pool = {}; }

function getOrCreate(m) {
  let v = pool[m.id];
  if (!v) {
    const scene = getActiveScene();
    const cfg = MINION_KK[m.type] || MINION_KK.skeleton;
    let v2;
    if (createKayKitByKey && hasKK && hasKK(cfg.key)) {
      const built = createKayKitByKey(cfg.key, cfg.height);
      built.group.userData = { kind: 'minion', minionId: m.id };
      const bar = makeHealthBarSprite(70); bar.position.set(0, cfg.height + 22, 0); built.group.add(bar);
      if (scene) scene.add(built.group);
      v2 = { isKK: true, group: built.group, kk: built.kk, dispose: built.dispose, base: 1, sink: cfg.sink, attackClip: cfg.attack };
    } else {
      const look = MINION_VISUALS[m.type] || MINION_VISUALS.skeleton;
      const b = createHumanoid(0, look.preset);
      b.group.scale.setScalar(look.scale);
      b.group.userData = { kind: 'minion', minionId: m.id };
      const bar = makeHealthBarSprite(70); bar.position.set(0, 112, 0); b.group.add(bar);
      if (scene) scene.add(b.group);
      v2 = { isKK: false, group: b.group, armL: b.armL, armR: b.armR, legL: b.legL, legR: b.legR, base: look.scale, sink: look.sink, walkPhase: Math.random() * 10 };
    }
    v = pool[m.id] = Object.assign(v2, {
      x: m.x, y: m.y, targetX: m.x, targetY: m.y, facing: m.facing, targetFacing: m.facing,
      type: m.type, risenAt: m.risenAt, dead: false, crumbleT: 0, swingT: 0, lastHit: 0,
    });
  }
  return v;
}

function applyMinionState(list) {
  if (!getActiveScene()) return;
  const seen = {};
  for (const m of (list || [])) {
    seen[m.id] = true;
    const v = getOrCreate(m);
    v.targetX = m.x; v.targetY = m.y; v.targetFacing = m.facing; v.risenAt = m.risenAt;
    if (m.lastHit && m.lastHit !== v.lastHit) { v.lastHit = m.lastHit; v.swingT = 1; }
    if (m.dead && !v.dead) { v.dead = true; v.crumbleT = 0; }
    const bar = v.group.getObjectByName('healthBar');
    if (bar && m.health !== undefined) updateHealthBar(bar, m.health, m.maxHealth);
  }
  for (const id in pool) if (!seen[id]) { removeRec(pool[id]); delete pool[id]; }
}

const WALK_RAD_PER_UNIT = 9 / 230;
function updateMinionVisuals(dt) {
  const me = getMe();
  const room = me ? me.room : null;
  const f = 1 - Math.exp(-dt * 8);
  const now = Date.now(), nowP = performance.now();
  for (const id in pool) {
    const v = pool[id];
    const prevX = v.x, prevY = v.y;
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);
    const floor = (typeof getFloorHeight === 'function' && room) ? getFloorHeight(room, v.x, v.y) : 0;
    const actualSpeed = dt > 0 ? Math.hypot(v.x - prevX, v.y - prevY) / dt : 0;
    const moving = actualSpeed > 4;

    // Rise: start sunk, climb to ground over the risenAt window.
    let riseOffset = 0;
    const riseLeft = v.risenAt - now;
    if (riseLeft > 0) { const t = Math.max(0, Math.min(1, riseLeft / 900)); riseOffset = -v.sink * t; }
    // Crumble: once dead, sink and shrink away.
    let crumbleK = 0;
    if (v.dead) { v.crumbleT += dt; crumbleK = Math.min(1, v.crumbleT / 1.0); riseOffset -= v.sink * crumbleK * 0.9; }
    v.group.scale.setScalar(v.base * (1 - crumbleK * 0.5));

    let bobY = 0;
    if (v.isKK) {
      // Drive the shared-rig animation; KK.tick() advances the mixer globally.
      const kk = v.kk;
      if (v.dead) kkSetState(kk, 'Death_A_Pose');
      else if (nowP < kk.busyUntil) { /* attack one-shot playing */ }
      else if (v.swingT > 0) { kkOneShot(kk, v.attackClip); v.swingT = 0; }
      else if (riseLeft > 0) kkSetState(kk, 'Idle');
      else kkSetState(kk, moving ? (actualSpeed > 160 ? 'Running_A' : 'Walking_A') : 'Idle');
    } else {
      // Procedural fallback: hand-rotate the limbs.
      const swinging = v.swingT > 0;
      if (swinging) v.swingT = Math.max(0, v.swingT - dt * 3);
      if (swinging) {
        const a = Math.sin((1 - v.swingT) * Math.PI);
        v.armR.rotation.x = -a * 1.0; v.armL.rotation.x = -a * 0.3;
        v.legL.rotation.x = 0; v.legR.rotation.x = 0;
      } else if (moving && !v.dead) {
        v.walkPhase += dt * actualSpeed * WALK_RAD_PER_UNIT;
        const swing = Math.sin(v.walkPhase) * 0.5;
        v.armL.rotation.x = swing; v.armR.rotation.x = -swing;
        v.legL.rotation.x = -swing * 0.6; v.legR.rotation.x = swing * 0.6;
        bobY = Math.abs(Math.sin(v.walkPhase)) * 2;
      } else {
        v.armL.rotation.x *= 0.85; v.armR.rotation.x *= 0.85;
        v.legL.rotation.x *= 0.85; v.legR.rotation.x *= 0.85;
      }
    }

    v.group.position.set(v.x, floor + bobY + riseOffset, v.y);
    v.group.rotation.y = v.facing;
  }
}

  return { applyMinionState, updateMinionVisuals, destroyMinions: destroyAll };
}
