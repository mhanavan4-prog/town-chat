// ---------------------------------------------------------------------------
// The World Boss (Session N) — the client face of the far-north public boss.
// One big creature in the Wilds with a prominent shared healthbar and a name
// banner, reconciled from the periodic 'wildlife_state' broadcast's worldBoss
// field (null when none is up). Modeled on the ember-mobs pool, but there is
// only ever one, so the state is a single holder rather than a map.
// ---------------------------------------------------------------------------

// Per-type look. Each boss is an animated KayKit creature (shared-rig, borrows
// the Mage's clips like the ember army) tinted to its flavour, scaled well
// above a player so it reads as a monument. The classic `preset` humanoid stays
// as the cold-load fallback until the body streams in.
// kkKey → model, kkHeight → world-unit height, kkAttack → borrowed attack clip,
// kkTint → { mul, emissive, ei }.
const WB_VISUALS = {
  skeleton: { scale: 2.1, kkKey: 'skel_golem', kkHeight: 300, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0xaab89a, amt: 0.4, emissive: 0x163a2c, ei: 0.3 }, preset: { skin: 0xe8e2d0, hair: 0x2a2a2a, hairStyle: 'long',   eye: 0x66ffcc, shirt: 0x3a3020, pants: 0x242018 } },
  wyrm:     { scale: 2.3, kkKey: 'mon_beast',  kkHeight: 280, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0x3f74c0, amt: 0.72, emissive: 0x16305e, ei: 0.45 }, preset: { skin: 0x3a4a6a, hair: 0x101828, hairStyle: 'mohawk', eye: 0x99ddff, shirt: 0x1a2440, pants: 0x101828 } },
  briar:    { scale: 2.0, kkKey: 'mon_beast',  kkHeight: 260, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0x5aa038, amt: 0.5, emissive: 0x2a4a10, ei: 0.4 }, preset: { skin: 0x4a6a3a, hair: 0x201808, hairStyle: 'long',   eye: 0xffdd66, shirt: 0x2a3a1a, pants: 0x1a2410 } },
};

export default function createWorldBoss({ createHumanoid, lerpAngle, makeHealthBarSprite, makeNpcNameSprite, mobAttackLungeAmount, updateHealthBar, createKayKitByKey, kkSetState, kkOneShot, hasKK, getMobAttackLungeDist, getWildsScene }) {
  let wb = null; // { group, isKK, kk | armL.., x, y, target.., facing, walkPhase }

  function destroy() {
    if (wb && wb.group && wb.group.parent) wb.group.parent.remove(wb.group);
    if (wb && wb.dispose) { try { wb.dispose(); } catch (e) { /* noop */ } }
    wb = null;
  }

  // Deep-tint a KayKit boss body toward its flavour hue + a dim emissive glow.
  // Recolor toward the flavour hue by LERP (not multiply) so a green pack body
  // can become a blue wyrm without darkening to mud, plus a dim emissive glow.
  function tintBoss(group, tint) {
    if (!tint) return;
    const to = new THREE.Color(tint.to != null ? tint.to : 0xffffff);
    const amt = tint.amt != null ? tint.amt : 0.5;
    const em = new THREE.Color(tint.emissive || 0x000000);
    group.traverse(c => {
      if (!c.isMesh && !c.isSkinnedMesh) return;
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      for (const m of mats) {
        if (!m) continue;
        if (m.color) m.color.lerp(to, amt);
        if ('emissive' in m) { m.emissive = em.clone(); if ('emissiveIntensity' in m) m.emissiveIntensity = (tint.ei != null ? tint.ei : 0.4); }
      }
    });
  }

  // Reconcile against the server's worldBoss snapshot (object, or null/absent).
  function applyWorldBossState(boss) {
    const scene = getWildsScene();
    if (!boss) { destroy(); return; }
    if (!scene) return;
    if (!wb) {
      const look = WB_VISUALS[boss.visual] || WB_VISUALS.skeleton;
      let group, isKK = false, kk = null, dispose = null, armL, armR, legL, legR, barY = 150, labelY = 172;
      if (look.kkKey && hasKK && hasKK(look.kkKey) && createKayKitByKey) {
        const h = look.kkHeight || 260;
        const built = createKayKitByKey(look.kkKey, h);
        if (built) {
          tintBoss(built.group, look.kkTint);
          group = built.group; isKK = true; kk = built.kk; dispose = built.dispose;
          barY = h + 34; labelY = h + 58;
        }
      }
      if (!group) { // procedural fallback
        const built = createHumanoid(0, look.preset);
        built.group.scale.setScalar(look.scale);
        group = built.group; armL = built.armL; armR = built.armR; legL = built.legL; legR = built.legR;
      }
      group.userData = { kind: 'world_boss', targetId: boss.id };
      const bar = makeHealthBarSprite(170);
      bar.position.set(0, barY, 0);
      bar.visible = true; // a raid boss shows its health from the first glance,
      bar._alwaysVisible = true; // not only after it's been hit (see updateHealthBar)
      group.add(bar);
      const label = makeNpcNameSprite(`${boss.icon} ${boss.name}`);
      label.position.set(0, labelY, 0);
      label.visible = true;
      label.userData._alwaysOn = true; // persistent banner, not hover-only
      group.add(label);
      scene.add(group);
      wb = {
        group, isKK, kk, dispose, armL, armR, legL, legR, attackClip: look.kkAttack,
        x: boss.x, y: boss.y, targetX: boss.x, targetY: boss.y, facing: boss.facing, targetFacing: boss.facing,
        initialized: true, walkPhase: 0, visual: boss.visual, attackAnimStartAt: null, _lastAtkFired: null,
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

    // ── Animated KayKit boss: drive the shared-rig clips. ──
    if (wb.isKK) {
      const now = performance.now();
      if (wb.attackAnimStartAt != null && wb.attackAnimStartAt !== wb._lastAtkFired) {
        wb._lastAtkFired = wb.attackAnimStartAt;
        if (wb.attackClip && kkOneShot) kkOneShot(wb.kk, wb.attackClip);
      }
      if (now >= (wb.kk.busyUntil || 0) && kkSetState) {
        const moving = actualSpeed > 4;
        kkSetState(wb.kk, moving ? (actualSpeed > 120 ? 'Running_A' : 'Walking_A') : 'Idle');
      }
      wb.group.position.set(wb.x, 0, wb.y);
      wb.group.rotation.y = wb.facing;
      return;
    }

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
