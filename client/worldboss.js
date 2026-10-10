// ---------------------------------------------------------------------------
// The World Boss (Session N) — the client face of the far-north public boss.
// One big humanoid in the Wilds with a prominent shared healthbar and a name
// banner, reconciled from the periodic 'wildlife_state' broadcast's worldBoss
// field (null when none is up). Modeled on the ember-mobs pool, but there is
// only ever one, so the state is a single holder rather than a map.
// ---------------------------------------------------------------------------

// Per-type look. Scaled well above a player so it reads as a monument from
// across the Hollow. Presets reuse the humanoid rig the whole game is built on.
const WB_VISUALS = {
  skeleton: { scale: 2.1, preset: { skin: 0xe8e2d0, hair: 0x2a2a2a, hairStyle: 'long',   eye: 0x66ffcc, shirt: 0x3a3020, pants: 0x242018 } },
  wyrm:     { scale: 2.3, preset: { skin: 0x3a4a6a, hair: 0x101828, hairStyle: 'mohawk', eye: 0x99ddff, shirt: 0x1a2440, pants: 0x101828 } },
  briar:    { scale: 2.0, preset: { skin: 0x4a6a3a, hair: 0x201808, hairStyle: 'long',   eye: 0xffdd66, shirt: 0x2a3a1a, pants: 0x1a2410 } },
};

export default function createWorldBoss({ createHumanoid, lerpAngle, makeHealthBarSprite, makeNpcNameSprite, mobAttackLungeAmount, updateHealthBar, getMobAttackLungeDist, getWildsScene }) {
  let wb = null; // { group, armL, armR, legL, legR, x, y, targetX, targetY, facing, targetFacing, initialized, walkPhase }

  function destroy() {
    if (wb && wb.group && wb.group.parent) wb.group.parent.remove(wb.group);
    wb = null;
  }

  // Reconcile against the server's worldBoss snapshot (object, or null/absent).
  function applyWorldBossState(boss) {
    const scene = getWildsScene();
    if (!boss) { destroy(); return; }
    if (!scene) return;
    if (!wb) {
      const look = WB_VISUALS[boss.visual] || WB_VISUALS.skeleton;
      const built = createHumanoid(0, look.preset);
      built.group.scale.setScalar(look.scale);
      built.group.userData = { kind: 'world_boss', targetId: boss.id };
      const bar = makeHealthBarSprite(170);
      bar.position.set(0, 150, 0);
      built.group.add(bar);
      const label = makeNpcNameSprite(`${boss.icon} ${boss.name}`);
      label.position.set(0, 172, 0);
      built.group.add(label);
      scene.add(built.group);
      wb = {
        group: built.group, armL: built.armL, armR: built.armR, legL: built.legL, legR: built.legR,
        x: boss.x, y: boss.y, targetX: boss.x, targetY: boss.y, facing: boss.facing, targetFacing: boss.facing,
        initialized: true, walkPhase: 0, visual: boss.visual,
      };
    }
    // A different boss than the one we're showing (window rolled) — rebuild.
    if (wb.visual !== boss.visual) { destroy(); return applyWorldBossState(boss); }
    wb.targetX = boss.x; wb.targetY = boss.y; wb.targetFacing = boss.facing;
    const bar = wb.group.getObjectByName('healthBar');
    if (bar && boss.health !== undefined) updateHealthBar(bar, boss.health, boss.maxHealth);
  }

  const WALK_RAD_PER_UNIT = 9 / 230;
  function updateWorldBossVisuals(dt) {
    if (!wb) return;
    const f = 1 - Math.exp(-dt * 8);
    const prevX = wb.x, prevY = wb.y;
    wb.x += (wb.targetX - wb.x) * f;
    wb.y += (wb.targetY - wb.y) * f;
    wb.facing = lerpAngle(wb.facing, wb.targetFacing, f);
    const actualSpeed = dt > 0 ? Math.hypot(wb.x - prevX, wb.y - prevY) / dt : 0;
    const atk = mobAttackLungeAmount(wb);
    const moving = actualSpeed > 4;
    if (atk === 0) wb.walkPhase += dt * actualSpeed * WALK_RAD_PER_UNIT;
    let bobY = 0;
    if (atk > 0) {
      wb.armR.rotation.x = -atk * 0.9; wb.armL.rotation.x = -atk * 0.2;
      wb.legL.rotation.x = 0; wb.legR.rotation.x = 0;
    } else if (moving) {
      const swing = Math.sin(wb.walkPhase) * 0.45;
      wb.armL.rotation.x = swing; wb.armR.rotation.x = -swing;
      wb.legL.rotation.x = -swing * 0.65; wb.legR.rotation.x = swing * 0.65;
      bobY = Math.abs(Math.sin(wb.walkPhase)) * 3;
    } else {
      wb.armL.rotation.x *= 0.85; wb.armR.rotation.x *= 0.85;
      wb.legL.rotation.x *= 0.85; wb.legR.rotation.x *= 0.85;
    }
    const lungeDist = atk * (getMobAttackLungeDist() * 0.5);
    wb.group.position.set(wb.x + Math.sin(wb.facing) * lungeDist, bobY, wb.y + Math.cos(wb.facing) * lungeDist);
    wb.group.rotation.y = wb.facing;
  }

  function worldBossVisualPos() { return wb ? { x: wb.x, y: wb.y } : null; }
  function worldBossGroup() { return wb ? wb.group : null; }

  return { applyWorldBossState, updateWorldBossVisuals, worldBossVisualPos, worldBossGroup };
}
