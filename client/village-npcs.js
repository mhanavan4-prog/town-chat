// ---------------------------------------------------------------------------
// Wilds village NPCs (Tier 3.4 Phase C). The friendly humanoid villagers in the
// Wilds — build-on-first-sight + interpolate toward server broadcasts, same flow
// as remote players. The villageNpcVisuals pool is private to this module (no
// external readers, never reset by reassignment), so it lives here; createHumanoid,
// the KayKit state helper, and lerpAngle are injected, the Wilds scene via getter.
// ---------------------------------------------------------------------------
export default function createVillageNpcs({ createHumanoid, kkSetState, lerpAngle, getWildsScene }) {
  let villageNpcVisuals = {};

function getOrCreateVillageNpcVisual(id, charId) {
  if (!villageNpcVisuals[id]) {
    const built = createHumanoid(charId);
    built.group.visible = false;
    if (getWildsScene()) getWildsScene().add(built.group);
    villageNpcVisuals[id] = {
      group: built.group, armL: built.armL, armR: built.armR, legL: built.legL, legR: built.legR,
      x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0,
      working: false, walkPhase: 0, initialized: false
    };
  }
  return villageNpcVisuals[id];
}

function applyVillageNpcState(npcs) {
  if (!getWildsScene()) return;
  for (const n of npcs) {
    const v = getOrCreateVillageNpcVisual(n.id, n.charId);
    v.targetX = n.x; v.targetY = n.y; v.targetFacing = n.facing; v.working = n.working;
    if (!v.initialized) { v.x = n.x; v.y = n.y; v.facing = n.facing; v.initialized = true; }
  }
}

function updateVillageNpcVisuals(dt) {
  if (!getWildsScene()) return;
  const f = 1 - Math.exp(-dt * 8);
  for (const id in villageNpcVisuals) {
    const v = villageNpcVisuals[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);
    v.group.position.set(v.x, 0, v.y);
    v.group.rotation.y = v.facing;

    const moving = Math.hypot(v.targetX - v.x, v.targetY - v.y) > 3;
    v.walkPhase += dt * (moving ? 5.5 : v.working ? 4 : 0);
    if (v.kk) kkSetState(v.kk, moving ? 'Walking_A' : (v.working ? 'Interact' : 'Idle'));

    if (moving) {
      const swing = Math.sin(v.walkPhase) * 0.45;
      v.armL.rotation.x = swing;
      v.armR.rotation.x = -swing;
      v.legL.rotation.x = -swing * 0.65;
      v.legR.rotation.x = swing * 0.65;
      v.group.position.y = v.kk ? 0 : Math.abs(Math.sin(v.walkPhase)) * 2;
    } else if (v.working) {
      // Hammering motion — arms pump down, slight body bob
      const hammer = Math.abs(Math.sin(v.walkPhase * 2)) * 0.65;
      v.armL.rotation.x = -hammer;
      v.armR.rotation.x = -hammer;
      v.legL.rotation.x = 0;
      v.legR.rotation.x = 0;
      v.group.position.y = Math.abs(Math.sin(v.walkPhase)) * 2.5;
    } else {
      v.armL.rotation.x *= 0.85;
      v.armR.rotation.x *= 0.85;
      v.legL.rotation.x *= 0.85;
      v.legR.rotation.x *= 0.85;
      v.group.position.y = 0;
    }
    v.group.visible = true;
  }
}

  return { applyVillageNpcState, updateVillageNpcVisuals };
}
