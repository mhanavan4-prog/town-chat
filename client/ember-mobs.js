// ---------------------------------------------------------------------------
// Ember Wastes mobs — pool management (Tier 3.4 Phase C). apply/update over the
// emberMobVisuals pool for the Ember Wastes' hostiles, plus the boss-kiosk
// refresh (EMBER_KIOSKS = static + alive-boss kiosks). The pool, the kiosk
// arrays, and the ember scene live in main (shared with ember-scene) and are
// injected via get/set; EMBER_MOB_VISUALS + humanoid/sprite helpers by ref;
// MOB_ATTACK_LUNGE_DIST via getter (declared after this module's ctor point).
// ---------------------------------------------------------------------------
export default function createEmberMobs({ EMBER_MOB_VISUALS, createHumanoid, lerpAngle, makeHealthBarSprite, makeNpcNameSprite, mobAttackLungeAmount, updateHealthBar, createKayKitByKey, kkSetState, kkOneShot, hasKK, getMobAttackLungeDist, getEmberScene, getEmberMobVisuals, getEmberStaticKiosks, setEmberKiosks, emberHeightAt }) {
const groundY = (x, z) => (typeof emberHeightAt === 'function' ? emberHeightAt(x, z) : 0);

// Ember-scorch a KayKit skeleton: multiply the bone-white materials toward the
// type's ember hue and give them a dim molten emissive so they read as risen
// from the ash, not a bright pack skeleton. Materials are already cloned by
// createKayKitByKey, so this is safe to mutate in place.
function emberScorch(group, tint) {
  if (!tint) return;
  const mul = new THREE.Color(tint.mul || 0xffffff);
  const em = new THREE.Color(tint.emissive || 0x000000);
  group.traverse(c => {
    if (!c.isMesh && !c.isSkinnedMesh) return;
    const mats = Array.isArray(c.material) ? c.material : [c.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.color) m.color.multiply(mul);
      if ('emissive' in m) { m.emissive = em.clone(); if ('emissiveIntensity' in m) m.emissiveIntensity = (tint.ei != null ? tint.ei : 0.4); }
    }
  });
}

function getOrCreateEmberMobVisual(id, mobType) {
  let v = getEmberMobVisuals()[id];
  if (!v) {
    const visual = EMBER_MOB_VISUALS[mobType] || EMBER_MOB_VISUALS.ash_wraith;
    // Preferred: an animated KayKit skeleton (same shared-rig path the
    // Necromancer's summons use). Falls back to the classic humanoid until the
    // skeleton body has streamed in (BG_KEYS), so mobs never go invisible.
    if (visual.kkKey && hasKK && hasKK(visual.kkKey) && createKayKitByKey) {
      const h = visual.kkHeight || 68;
      const built = createKayKitByKey(visual.kkKey, h);
      if (built) {
        emberScorch(built.group, visual.kkTint);
        built.group.visible = false;
        built.group.userData = { kind: 'ember_mob', targetId: id };
        const bar = makeHealthBarSprite(78); bar.position.set(0, h + 26, 0); built.group.add(bar);
        const label = makeNpcNameSprite(visual.name); label.position.set(0, h + 42, 0); built.group.add(label);
        if (getEmberScene()) getEmberScene().add(built.group);
        return (getEmberMobVisuals()[id] = {
          isKK: true, group: built.group, kk: built.kk, dispose: built.dispose, attackClip: visual.kkAttack,
          x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0,
          initialized: false, dead: false, hasLoot: false, attackAnimStartAt: null, _lastAtkFired: null
        });
      }
    }
    const built = createHumanoid(0, visual.preset);
    built.group.scale.setScalar(visual.scale);
    built.group.visible = false;
    built.group.userData = { kind: 'ember_mob', targetId: id };
    built.group.add(makeHealthBarSprite(78));
    const label = makeNpcNameSprite(visual.name);
    label.position.set(0, 96, 0);
    built.group.add(label);
    if (getEmberScene()) getEmberScene().add(built.group);
    v = getEmberMobVisuals()[id] = {
      isKK: false, group: built.group, armL: built.armL, armR: built.armR, legL: built.legL, legR: built.legR,
      x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0,
      initialized: false, dead: false, hasLoot: false, attackAnimStartAt: null, walkPhase: Math.random() * 10
    };
  }
  return v;
}

function applyEmberMobState(list) {
  if (!getEmberScene()) return;
  const aliveKiosks = [];
  const seen = new Set();
  for (const m of list) {
    seen.add(m.id);
    const v = getOrCreateEmberMobVisual(m.id, m.mobType);
    v.targetX = m.x; v.targetY = m.y; v.targetFacing = m.facing; v.dead = !!m.dead;
    v.hasLoot = !!m.hasLoot;
    if (!v.initialized) { v.x = m.x; v.y = m.y; v.facing = m.facing; v.initialized = true; }
    if (m.health !== undefined) {
      const hpBar = v.group.getObjectByName('healthBar');
      if (hpBar) updateHealthBar(hpBar, m.health, m.maxHealth);
    }
    if (!m.dead) aliveKiosks.push({ x: m.x, z: m.y, npc: 'ember_mob', targetId: m.id });
  }
  // AOI cull: a mob that dropped out of this update (now beyond the server's
  // per-player range) is removed so it doesn't linger as a frozen ghost — and
  // its KayKit mixer disposed so culling/un-culling never leaks animators. It
  // re-creates cleanly if it comes back into range.
  const pool = getEmberMobVisuals();
  for (const id in pool) {
    if (seen.has(id)) continue;
    const v = pool[id];
    if (v.group && getEmberScene()) getEmberScene().remove(v.group);
    if (typeof v.dispose === 'function') { try { v.dispose(); } catch (e) {} }
    delete pool[id];
  }
  setEmberKiosks(getEmberStaticKiosks().concat(aliveKiosks));
}

// Same walk-cycle pattern as the Wilds' village NPCs, plus an arm-swing
// "punch" (reusing mobAttackLungeAmount's existing 0->1->0 timing, just
// applied to a limb instead of a whole-body lunge+pitch — that reads fine
// on the blob-monster rig but would look like a face-plant on a humanoid)
// and a much smaller forward step than the blob mobs get, for the same reason.
//
// Unlike every other humanoid in this game (players, village NPCs,
// Torchkeepers), ember mob TYPES move at wildly different speeds
// (24-85, vs. a player's constant 230) — a fixed walkPhase rate looked
// like the legs were pumping independently of how fast the body was
// actually covering ground ("robotic" foot-sliding, worst on the slow
// Cinder Brute). Deriving the rate from how far this mob's own rendered
// position actually moved this frame, using the same rad-per-unit ratio
// the player's fixed 9/230 already implies, scales the cadence to match
// whatever it's really doing (wandering slowly or sprinting at a rival).
const MOB_WALK_RADIANS_PER_UNIT = 9 / 230;

function updateEmberMobVisuals(dt) {
  const f = 1 - Math.exp(-dt * 8);
  for (const id in getEmberMobVisuals()) {
    const v = getEmberMobVisuals()[id];
    const prevX = v.x, prevY = v.y;
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);
    const actualSpeed = dt > 0 ? Math.hypot(v.x - prevX, v.y - prevY) / dt : 0;

    // ── Animated KayKit skeleton: drive the shared-rig clips (KK.tick advances
    // the mixer globally) instead of hand-rotating limbs. ──
    if (v.isKK) {
      const now = performance.now();
      // A fresh attack (server stamped attackAnimStartAt) fires a one-shot swing.
      if (v.attackAnimStartAt != null && v.attackAnimStartAt !== v._lastAtkFired) {
        v._lastAtkFired = v.attackAnimStartAt;
        if (v.attackClip) kkOneShot(v.kk, v.attackClip);
      }
      if (!v.dead) {
        if (now >= (v.kk.busyUntil || 0)) {
          v.animSpeed = (v.animSpeed || 0) * 0.8 + actualSpeed * 0.2;
          const spd = v.animSpeed;
          const moving = spd > 3;
          const state = moving ? (spd > 130 ? 'Running_A' : 'Walking_A') : 'Idle';
          kkSetState(v.kk, state);
          // Match clip rate to ground speed so slow mobs don't moon-walk/float.
          if (moving) { const a = v.kk.act(state); if (a) a.timeScale = Math.max(0.5, Math.min(1.9, spd / (state === 'Running_A' ? 170 : 58))); }
        }
      }
      v.group.position.set(v.x, groundY(v.x, v.y), v.y);
      v.group.rotation.y = v.facing;
      v.group.visible = !v.dead;
      continue;
    }

    const atk = mobAttackLungeAmount(v);
    const moving = actualSpeed > 4;
    if (atk === 0) v.walkPhase += dt * actualSpeed * MOB_WALK_RADIANS_PER_UNIT;

    let bobY = 0;
    if (atk > 0) {
      v.armR.rotation.x = -atk * 0.9;
      v.armL.rotation.x = -atk * 0.2;
      v.legL.rotation.x = 0; v.legR.rotation.x = 0;
    } else if (moving) {
      const swing = Math.sin(v.walkPhase) * 0.45;
      v.armL.rotation.x = swing;
      v.armR.rotation.x = -swing;
      v.legL.rotation.x = -swing * 0.65;
      v.legR.rotation.x = swing * 0.65;
      bobY = Math.abs(Math.sin(v.walkPhase)) * 2;
    } else {
      v.armL.rotation.x *= 0.85;
      v.armR.rotation.x *= 0.85;
      v.legL.rotation.x *= 0.85;
      v.legR.rotation.x *= 0.85;
    }

    const lungeDist = atk * (getMobAttackLungeDist() * 0.5);
    const px = v.x + Math.sin(v.facing) * lungeDist, pz = v.y + Math.cos(v.facing) * lungeDist;
    v.group.position.set(px, bobY + groundY(px, pz), pz); // ride the scorched dunes
    v.group.rotation.y = v.facing;
    v.group.visible = !v.dead;
  }
}

  return { applyEmberMobState, updateEmberMobVisuals };
}
