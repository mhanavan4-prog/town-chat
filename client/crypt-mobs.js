// ---------------------------------------------------------------------------
// Crypt guardian visuals (Phase 2). The lone Crypt Warden that stands over the
// sarcophagus of the instanced crypt room. Modeled on the dungeon-mob pool
// (scene-scoped, room-gated visibility — NOT night-gated), driving the animated
// KayKit skel_warrior rig built by makeMob2('crypt_warden'). The pool itself
// lives in main (targeting / FX lookups read it); the crypt scene + `me` are
// reassigned lets injected as getters.
// ---------------------------------------------------------------------------
export default function createCryptMobs({ lerpAngle, makeMob2, kkSetState, kkOneShot, updateHealthBar, mobAttackLungeAmount, MOB_ATTACK_LUNGE_DIST, getCryptScene, getCryptMobVisuals, getMe }) {
  function getOrCreateCryptMobVisual(id, mobType) {
    let v = getCryptMobVisuals()[id];
    if (!v) {
      const mesh = makeMob2(mobType);
      mesh.visible = false;
      mesh.userData = { kind: 'crypt_mob', targetId: id };
      mesh.traverse(c => { if (c !== mesh) c.userData = mesh.userData; });
      if (getCryptScene()) getCryptScene().add(mesh);
      v = getCryptMobVisuals()[id] = {
        mesh, mobType, x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0,
        initialized: false, dead: false, dormant: false, attackAnimStartAt: null,
        isKK: !!(mesh.userData && mesh.userData.isKK), kk: mesh.userData && mesh.userData.kk,
        kkAttack: mesh.userData && mesh.userData.kkAttack, _lastAtkFired: null,
      };
    }
    return v;
  }

  function applyCryptMobState(list) {
    if (!getCryptScene()) return;
    for (const m of list) {
      const v = getOrCreateCryptMobVisual(m.id, m.mobType);
      v.targetX = m.x; v.targetY = m.y; v.targetFacing = m.facing;
      v.dead = !!m.dead; v.dormant = !!m.dormant; v.hasLoot = !!m.hasLoot;
      if (!v.initialized) { v.x = m.x; v.y = m.y; v.facing = m.facing; v.initialized = true; }
      if (m.health !== undefined) {
        const hpBar = v.mesh.getObjectByName('healthBar');
        if (hpBar) updateHealthBar(hpBar, m.health, m.maxHealth);
      }
    }
  }

  function updateCryptMobVisuals(dt) {
    const cryptScene = getCryptScene();
    const inCrypt = cryptScene && getMe() && getMe().room === 'crypt';
    const f = 1 - Math.exp(-dt * 8);
    for (const id in getCryptMobVisuals()) {
      const v = getCryptMobVisuals()[id];
      const prevX = v.x, prevY = v.y;
      v.x += (v.targetX - v.x) * f;
      v.y += (v.targetY - v.y) * f;
      v.facing = lerpAngle(v.facing, v.targetFacing, f);
      const shouldShow = !!inCrypt && !v.dead;

      if (v.isKK) {
        // Animated KayKit body — drive the shared-rig clips. While dormant the
        // Warden holds Idle at its post; once roused it walks/runs after you,
        // with a one-shot on attack and a Hit_A flinch when struck.
        const actualSpeed = dt > 0 ? Math.hypot(v.x - prevX, v.y - prevY) / dt : 0;
        const now = performance.now();
        if (v.attackAnimStartAt != null && v.attackAnimStartAt !== v._lastAtkFired) {
          v._lastAtkFired = v.attackAnimStartAt;
          if (v.kkAttack && kkOneShot) kkOneShot(v.kk, v.kkAttack);
        }
        if (v.hitAnimStartAt != null && v.hitAnimStartAt !== v._lastHitFired) {
          v._lastHitFired = v.hitAnimStartAt;
          if (!v.dead && kkOneShot) kkOneShot(v.kk, 'Hit_A', { timeScale: 1.2 });
        }
        if (now >= (v.kk && v.kk.busyUntil || 0) && kkSetState) {
          v.animSpeed = (v.animSpeed || 0) * 0.8 + actualSpeed * 0.2;
          const spd = v.dormant ? 0 : v.animSpeed;
          const moving = spd > 3;
          const state = moving ? (spd > 130 ? 'Running_A' : 'Walking_A') : 'Idle';
          kkSetState(v.kk, state);
          if (moving) { const a = v.kk.act(state); if (a) a.timeScale = Math.max(0.5, Math.min(1.9, spd / (state === 'Running_A' ? 170 : 58))); }
        }
        v.mesh.position.set(v.x, 0, v.y);
        v.mesh.rotation.y = v.facing;
        v.mesh.visible = shouldShow;
        continue;
      }

      // Fallback (model still streaming): blob lunge-tilt.
      const lungeFactor = mobAttackLungeAmount(v);
      const lungeDist = lungeFactor * MOB_ATTACK_LUNGE_DIST;
      v.mesh.position.set(v.x + Math.sin(v.facing) * lungeDist, 0, v.y + Math.cos(v.facing) * lungeDist);
      v.mesh.rotation.y = v.facing;
      v.mesh.rotation.x = -0.5 * lungeFactor;
      v.mesh.visible = shouldShow;
    }
  }

  return { applyCryptMobState, updateCryptMobVisuals };
}
