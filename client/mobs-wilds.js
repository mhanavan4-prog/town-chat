// ---------------------------------------------------------------------------
// Wilds mobs — pool management (Tier 3.4 Phase C). Spawn/apply/update for the
// Wilds' two mob layers over the mobVisuals2 (hostiles) and mobVisuals3
// (neutrals) pools, driving the meshes built by makeMob2/makeMob3. The pools
// live in main (targeting, mob-pools, and the debug snapshot read them) and are
// injected via get/set; the Wilds scene + day/night flag are reassigned lets,
// injected as getters.
// ---------------------------------------------------------------------------
export default function createMobsWilds({ MOB2_VISUALS, MOB_ATTACK_LUNGE_DIST, lerpAngle, makeMob2, makeMob3, mobAttackLungeAmount, updateHealthBar, getWildsScene, getLastWildlifeIsNight, getMobVisuals2, setMobVisuals2, getMobVisuals3, setMobVisuals3 }) {
function addMobs2(scene) {
  for (const id in getMobVisuals2()) scene.remove(getMobVisuals2()[id].mesh);
  setMobVisuals2({});
}

function getOrCreateMob2Visual(id, mobType) {
  let v = getMobVisuals2()[id];
  if (!v) {
    const mesh = makeMob2(mobType);
    mesh.visible = false;
    mesh.userData = { kind: 'mob2', targetId: id };
    getWildsScene().add(mesh);
    const vis = MOB2_VISUALS[mobType] || {};
    v = getMobVisuals2()[id] = { mesh, mobType, fly: vis.fly || 0, wingPhase: Math.random() * 6.28, x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0, initialized: false, dead: false, hidden: false, attackAnimStartAt: null };
  }
  return v;
}

function applyMob2State(list) {
  if (!getWildsScene()) return;
  for (const m of list) {
    const v = getOrCreateMob2Visual(m.id, m.mobType);
    v.targetX = m.x; v.targetY = m.y; v.targetFacing = m.facing; v.dead = !!m.dead;
    v.hasLoot = !!m.hasLoot;
    v.hidden = !!m.hidden; // buried Barrow Maw / dormant Old Marrowe
    if (!v.initialized) { v.x = m.x; v.y = m.y; v.facing = m.facing; v.initialized = true; }
    if (m.health !== undefined) {
      const hpBar = v.mesh.getObjectByName('healthBar');
      if (hpBar) updateHealthBar(hpBar, m.health, m.maxHealth);
    }
  }
}

function updateMob2Visuals(dt) {
  const f = 1 - Math.exp(-dt * 8);
  for (const id in getMobVisuals2()) {
    const v = getMobVisuals2()[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);
    const lungeFactor = mobAttackLungeAmount(v);
    const lungeDist = lungeFactor * MOB_ATTACK_LUNGE_DIST;
    // Flyers (Gloom Bat, Fen Hexer) ride above the ground with a lazy bob.
    let hover = 0;
    if (v.fly) { v.wingPhase += dt * 6; hover = v.fly + Math.sin(v.wingPhase) * 3; }
    v.mesh.position.set(v.x + Math.sin(v.facing) * lungeDist, hover, v.y + Math.cos(v.facing) * lungeDist);
    v.mesh.rotation.y = v.facing;
    v.mesh.rotation.x = -0.5 * lungeFactor;
    v.mesh.visible = getLastWildlifeIsNight() && !v.dead && !v.hidden;
  }
}

// ── Neutral pool (mobs3) visuals — same shape as mobs2 but ALWAYS rendered
// (out day and night; only aggressive when provoked). ──
function addMobs3(scene) { for (const id in getMobVisuals3()) scene.remove(getMobVisuals3()[id].mesh); setMobVisuals3({}); }
function getOrCreateMob3Visual(id, mobType) {
  let v = getMobVisuals3()[id];
  if (!v) {
    const mesh = makeMob3(mobType);
    mesh.visible = false;
    mesh.userData = { kind: 'mob3', targetId: id };
    getWildsScene().add(mesh);
    v = getMobVisuals3()[id] = { mesh, mobType, x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0, initialized: false, dead: false, provoked: false, attackAnimStartAt: null };
  }
  return v;
}
function applyMob3State(list) {
  if (!getWildsScene()) return;
  for (const m of list) {
    const v = getOrCreateMob3Visual(m.id, m.mobType);
    v.targetX = m.x; v.targetY = m.y; v.targetFacing = m.facing; v.dead = !!m.dead; v.provoked = !!m.provoked; v.hasLoot = !!m.hasLoot;
    if (!v.initialized) { v.x = m.x; v.y = m.y; v.facing = m.facing; v.initialized = true; }
    if (m.health !== undefined) {
      const hpBar = v.mesh.getObjectByName('healthBar');
      if (hpBar) updateHealthBar(hpBar, m.health, m.maxHealth);
    }
  }
}
function updateMob3Visuals(dt) {
  const f = 1 - Math.exp(-dt * 8);
  for (const id in getMobVisuals3()) {
    const v = getMobVisuals3()[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);
    const lungeFactor = mobAttackLungeAmount(v);
    const lungeDist = lungeFactor * MOB_ATTACK_LUNGE_DIST;
    const hover = v.mobType === 'gravewing_crow' ? 4 : 0;
    v.mesh.position.set(v.x + Math.sin(v.facing) * lungeDist, hover, v.y + Math.cos(v.facing) * lungeDist);
    v.mesh.rotation.y = v.facing;
    v.mesh.rotation.x = -0.5 * lungeFactor;
    v.mesh.visible = !v.dead;
  }
}

  return { addMobs2, addMobs3, applyMob2State, applyMob3State, updateMob2Visuals, updateMob3Visuals };
}
