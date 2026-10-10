// ---------------------------------------------------------------------------
// The Necromancer's undead (Session N) — client rendering for summoned
// minions, reconciled from the periodic 'wildlife_state' broadcast's `minions`
// field (only the player's own room is ever sent). Each undead CLAWS UP out of
// the ground on a rise animation (it starts sunk and rises over its risenAt
// window), hunts on the humanoid rig everything else uses, and CRUMBLES — sinks
// and fades — when it's slain. Rides whatever room's floor it stands on.
// ---------------------------------------------------------------------------
const MINION_VISUALS = {
  skeleton:    { scale: 0.95, sink: 70,  preset: { skin: 0xe8e4d6, hair: 0x2a2620, hairStyle: 'bald', eye: 0x7cff9a, shirt: 0x3a3630, pants: 0x2a2620 } },
  bone_knight: { scale: 1.15, sink: 85,  preset: { skin: 0xdcd6c4, hair: 0x1c1a14, hairStyle: 'buzz', eye: 0x8cffb0, shirt: 0x35312a, pants: 0x242018 } },
  grave_wight: { scale: 1.35, sink: 100, preset: { skin: 0xb8c0b0, hair: 0x101410, hairStyle: 'long', eye: 0xaaff88, shirt: 0x1e2a1e, pants: 0x141c14 } },
};

export default function createMinions({ createHumanoid, lerpAngle, makeHealthBarSprite, updateHealthBar, getActiveScene, getFloorHeight, getMe }) {
let pool = {}; // id -> { group, armL, armR, legL, legR, x, y, targetX, targetY, facing, targetFacing, type, risenAt, dead, crumbleT, walkPhase, lastHit, init }

function destroyAll() {
  const scene = getActiveScene();
  for (const id in pool) { if (scene && pool[id].group.parent) pool[id].group.parent.remove(pool[id].group); }
  pool = {};
}

function getOrCreate(m) {
  let v = pool[m.id];
  if (!v) {
    const look = MINION_VISUALS[m.type] || MINION_VISUALS.skeleton;
    const built = createHumanoid(0, look.preset);
    built.group.scale.setScalar(look.scale);
    built.group.userData = { kind: 'minion', minionId: m.id };
    const bar = makeHealthBarSprite(70);
    bar.position.set(0, 112, 0);
    built.group.add(bar);
    const scene = getActiveScene();
    if (scene) scene.add(built.group);
    v = pool[m.id] = {
      group: built.group, armL: built.armL, armR: built.armR, legL: built.legL, legR: built.legR,
      x: m.x, y: m.y, targetX: m.x, targetY: m.y, facing: m.facing, targetFacing: m.facing,
      type: m.type, risenAt: m.risenAt, dead: false, crumbleT: 0, walkPhase: Math.random() * 10,
      lastHit: 0, sink: look.sink, init: true,
    };
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
  // Anything no longer in the room's list has been reaped server-side — drop it.
  for (const id in pool) if (!seen[id]) { if (pool[id].group.parent) pool[id].group.parent.remove(pool[id].group); delete pool[id]; }
}

const WALK_RAD_PER_UNIT = 9 / 230;
function updateMinionVisuals(dt) {
  const me = getMe();
  const room = me ? me.room : null;
  const f = 1 - Math.exp(-dt * 8);
  const now = Date.now();
  for (const id in pool) {
    const v = pool[id];
    const prevX = v.x, prevY = v.y;
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);
    const floor = (typeof getFloorHeight === 'function' && room) ? getFloorHeight(room, v.x, v.y) : 0;

    // Rise: start sunk, climb to ground level over the risenAt window.
    let riseOffset = 0;
    const riseLeft = v.risenAt - now;
    if (riseLeft > 0) { const t = Math.max(0, Math.min(1, riseLeft / 900)); riseOffset = -v.sink * t; }

    // Crumble: once dead, sink and shrink away.
    if (v.dead) {
      v.crumbleT += dt;
      const k = Math.min(1, v.crumbleT / 1.0);
      riseOffset -= v.sink * k * 0.9;
      v.group.scale.setScalar((MINION_VISUALS[v.type] || MINION_VISUALS.skeleton).scale * (1 - k * 0.5));
    }

    const actualSpeed = dt > 0 ? Math.hypot(v.x - prevX, v.y - prevY) / dt : 0;
    const swinging = v.swingT > 0;
    if (swinging) { v.swingT = Math.max(0, v.swingT - dt * 3); }
    let bobY = 0;
    if (swinging) {
      const a = Math.sin((1 - v.swingT) * Math.PI);
      v.armR.rotation.x = -a * 1.0; v.armL.rotation.x = -a * 0.3;
      v.legL.rotation.x = 0; v.legR.rotation.x = 0;
    } else if (actualSpeed > 4 && !v.dead) {
      v.walkPhase += dt * actualSpeed * WALK_RAD_PER_UNIT;
      const swing = Math.sin(v.walkPhase) * 0.5;
      v.armL.rotation.x = swing; v.armR.rotation.x = -swing;
      v.legL.rotation.x = -swing * 0.6; v.legR.rotation.x = swing * 0.6;
      bobY = Math.abs(Math.sin(v.walkPhase)) * 2;
    } else {
      v.armL.rotation.x *= 0.85; v.armR.rotation.x *= 0.85;
      v.legL.rotation.x *= 0.85; v.legR.rotation.x *= 0.85;
    }

    v.group.position.set(v.x, floor + bobY + riseOffset, v.y);
    v.group.rotation.y = v.facing;
  }
}

  return { applyMinionState, updateMinionVisuals, destroyMinions: destroyAll };
}
