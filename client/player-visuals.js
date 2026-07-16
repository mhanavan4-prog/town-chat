// ---------------------------------------------------------------------------
// Player visuals (Tier 3.4 Phase C — the core character render/animation layer).
// ensurePlayerVisual builds a player's rig on first sight (via createHumanoid) and
// registers it in the shared `visuals` map; destroyPlayerVisual tears it down;
// syncVisuals drives every rig each frame (position lerp, walk cycle, facing,
// jump arc, seated pose, night-arms, KayKit clips); updateStatusVisuals +
// updateWerewolfNpc layer status FX + the Lexton werewolf. The `visuals` registry
// is a mutate-in-place const injected by reference (main's many readers share it);
// reassigned world state (me/players/scenes/seatedAt/jump/lexton) via getters.
// ---------------------------------------------------------------------------
export default function createPlayerVisuals({ CHAR, JUMP_DURATION, JUMP_HEIGHT, KK, applyEquipVisual, applyStatusVisual, contextMatches, createHumanoid, getDayNightState, getFloorHeight, getRenderPos, kkDrivePlayer, kkSetState, lerpAngle, makeGhostMesh, setUnlockToast, visuals, getActiveScene, getGroundY, getJumpActive, getJumpT, getLextonNpc, getMe, getMyId, getPlayers, getSeatedAt, getWildsScene }) {
function updateStatusVisuals(dt) {
  const now = performance.now();
  for (const id in visuals) {
    const v = visuals[id];
    if (v.statusType === 'bats' && v.batsGroup) {
      v.batsGroup.rotation.y += dt * 2.2;
      for (const bat of v.batsGroup.children) {
        bat.position.y = CHAR.headY + 8 + Math.sin(now * 0.004 + bat.userData.offset) * 4;
      }
    } else if (v.statusType === 'colorcycle' && v.torso && v.torso.material) {
      v.torso.material.color.setHSL((now * 0.0006) % 1, 0.7, 0.55);
    } else if (v.statusType === 'colorcycle' && v.colorcycleSprite) {
      // KayKit rigs can't tint the shared shirt material — hue-cycle the
      // aura sprite added in applyStatusVisual instead.
      v.colorcycleSprite.material.color.setHSL((now * 0.0006) % 1, 0.8, 0.6);
    } else if (v.statusType === 'ravencloak' && v.cloakMesh) {
      v.cloakMesh.rotation.z = Math.sin(now * 0.003) * 0.15;
    } else if (v.statusType === 'wolfmark' && v.wolfMarkMesh) {
      v.wolfMarkMesh.rotation.y += dt * 1.6;
    } else if (v.statusType === 'wolfpact' && v.wolfPactMesh) {
      v.wolfPactMesh.rotation.y += dt * 2.0;
    } else if (v.statusType === 'ward' && v.wardMesh) {
      v.wardMesh.material.opacity = 0.14 + Math.sin(now * 0.004) * 0.06;
      v.wardMesh.rotation.y += dt * 0.6;
    }
  }
}

// Animate Lexton Greyfur: arms raised and head tilted during night, idle by day.
// A "Awooooo!" chat bubble is shown near him every ~45 s at night.
let _lastLextonHowlNotice = 0;
function updateWerewolfNpc(dt) {
  if (!getLextonNpc()) return;
  const { isNight } = getDayNightState();
  const now = performance.now();
  // Smooth arm animation: raised (howling) at night, lowered in day
  const TARGET_ARM_Z = isNight ? -Math.PI * 0.72 : 0;
  const SPEED = 2.0;
  if (getLextonNpc().armL) {
    getLextonNpc().armL.rotation.z += (TARGET_ARM_Z - getLextonNpc().armL.rotation.z) * Math.min(1, SPEED * dt);
  }
  if (getLextonNpc().armR) {
    getLextonNpc().armR.rotation.z += (-TARGET_ARM_Z - getLextonNpc().armR.rotation.z) * Math.min(1, SPEED * dt);
  }
  // Head tilts back during howl
  if (getLextonNpc().head) {
    const TARGET_HEAD_X = isNight ? -0.55 : 0;
    getLextonNpc().head.rotation.x += (TARGET_HEAD_X - getLextonNpc().head.rotation.x) * Math.min(1, SPEED * dt);
  }
  // Periodic howl notice — only visible while in the Wilds
  if (isNight && getActiveScene() === getWildsScene() && now - _lastLextonHowlNotice > 45000) {
    _lastLextonHowlNotice = now;
    setUnlockToast('🌕 A mournful howl echoes from the Ancient One... "Awooooo!"');
  }
}

function ensurePlayerVisual(p) {
  if (visuals[p.id]) return;
  const built = createHumanoid(p.charId || 0);

  const nameEl = document.createElement('div');
  nameEl.className = 'nameTag';
  nameEl.textContent = p.name;
  document.body.appendChild(nameEl);

  const ghostGroup = makeGhostMesh();

  // Not parented into any scene yet — syncVisuals() adds/removes it from
  // whichever scene matches the player's current room each frame.
  // weaponMesh/armorMesh start null and are created/removed lazily by
  // applyEquipVisual() the first time this player actually has something
  // equipped, rather than built upfront for every character.
  visuals[p.id] = {
    ...built, nameEl, inScene: false, parentScene: null,
    ghostGroup, ghostInScene: false, ghostParentScene: null,
    deathAnimStartAt: null,
    attackAnimStartAt: null, attackAnimType: 'punch',
    weaponMesh: null, chestMesh: null, headMesh: null, feetMeshL: null, feetMeshR: null, ringMesh: null,
    statusType: null, pumpkinMesh: null, batsGroup: null, cloakMesh: null, wolfMarkMesh: null, wolfPactMesh: null
  };
  // Tags the root group so raycastHitAt() can identify what got clicked —
  // see the attack/harvest targeting section below.
  built.group.userData = { kind: 'player', targetId: p.id };
  applyEquipVisual(p.id, p);
  applyStatusVisual(p.id, p.activeStatus);
}

function destroyPlayerVisual(id) {
  const v = visuals[id];
  if (!v) return;
  if (v.kk) KK.mixers.delete(v.kk.mixer);
  if (v.inScene && v.parentScene) v.parentScene.remove(v.group);
  if (v.ghostInScene && v.ghostParentScene) v.ghostParentScene.remove(v.ghostGroup);
  v.nameEl.remove();
  if (v.bubbleEl) v.bubbleEl.remove();
  delete visuals[id];
}

// KayKit recovery: the ~18MB of character models load asynchronously, so a
// player drawn before they finish gets the classic fallback rig (built once —
// ensurePlayerVisual short-circuits after). The moment KK settles, rebuild
// anyone still on the fallback so every character upgrades to the KayKit model
// instead of being stuck on the old rig until a page reload.
if (KK && KK.promise && typeof KK.promise.then === 'function') {
  KK.promise.then(() => {
    const players = getPlayers() || {};
    const meP = getMe();
    for (const id of Object.keys(visuals)) {
      const v = visuals[id];
      if (!v || v.kk) continue; // already a KayKit model — leave it
      const p = players[id] || (meP && meP.id === id ? meP : null);
      if (!p) continue;
      destroyPlayerVisual(id);
      ensurePlayerVisual(p);
    }
  });
}

function syncVisuals(dt) {
  // Holly Wand ambience, shared by every bearer this frame
  const _dn = getDayNightState();
  const wandNight = 1 - _dn.lightAmount;
  const wandPulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.0024);
  for (const id in getPlayers()) {
    const p = getPlayers()[id];
    const v = visuals[id];
    if (!v) continue;

    if (v.wandAura) v.wandAura.material.opacity = 0.15 + wandNight * 0.3 + wandPulse * 0.07;
    if (v.weaponMesh && v.weaponMesh.userData.wandTipGlow) {
      v.weaponMesh.userData.wandTipGlow.opacity = 0.38 + wandNight * 0.42 + wandPulse * 0.12;
    }

    const moveDx = p.x - p.renderPrevX, moveDy = p.y - p.renderPrevY;
    const moveDist = Math.hypot(moveDx, moveDy);
    const isMoving = moveDist > 0.08;

    // The local player's facing is driven directly by turn input (see update()).
    // Remote getPlayers() never send us a facing angle over the wire — only x/y —
    // so for them we infer a facing from how their position is drifting.
    // (Uniform scaling for indoor rendering preserves this angle, so raw
    // world-space deltas work whether the player is indoors or outdoors.)
    if (id !== getMyId() && isMoving) {
      const targetFacing = Math.atan2(moveDx, moveDy);
      p.facing = lerpAngle(p.facing, targetFacing, Math.min(1, dt * 10));
    }

    if (v.kk) kkDrivePlayer(v, p, id, dt, isMoving, moveDist);
    // Attack animation — overrides walk/idle arms for ~0.35s
    const ATTACK_DUR = 0.35;
    if (!v.kk) {
    const attackElapsed = v.attackAnimStartAt ? (performance.now() - v.attackAnimStartAt) / 1000 : null;
    const attackActive = attackElapsed !== null && attackElapsed < ATTACK_DUR;
    if (attackActive) {
      const t = attackElapsed / ATTACK_DUR;
      v.legL.rotation.x = 0; v.legR.rotation.x = 0;
      if (v.attackAnimType === 'slash') {
        // Wind-up then overhead slam: arm sweeps back then cracks forward
        const ang = t < 0.35
          ? -Math.PI * 0.65 * (t / 0.35)           // swing back
          : -Math.PI * 0.65 + (t - 0.35) / 0.65 * Math.PI * 0.9; // crack forward
        v.armR.rotation.x = ang;
        v.armL.rotation.x = ang * 0.3;
        v.armR.rotation.z = -0.15;
      } else if (v.attackAnimType === 'cast') {
        // Both arms thrust forward, body follows
        const thrust = Math.sin(t * Math.PI) * -1.0;
        v.armR.rotation.x = thrust; v.armL.rotation.x = thrust;
        v.armR.rotation.z = 0; v.armL.rotation.z = 0;
        if (v.group) v.group.rotation.z = Math.sin(t * Math.PI) * 0.08;
      } else {
        // Punch: right jab forward
        const jab = Math.sin(t * Math.PI) * -0.85;
        v.armR.rotation.x = jab;
        v.armL.rotation.x = jab * 0.2;
        v.armR.rotation.z = 0;
      }
    } else if (!attackActive && attackElapsed !== null) {
      // Reset z-rotation after attack
      v.armR.rotation.z = 0;
      if (v.group) v.group.rotation.z = 0;
      v.attackAnimStartAt = null;
    }

    if (attackActive) {
      // skip walk/idle arm logic below
    } else if (v.statusType === 'meditate' || (id === getMyId() && getSeatedAt())) {
      const ease = Math.min(1, dt * 8);
      const legBend = -Math.PI / 2.1, armBend = 0.15;
      v.legL.rotation.x += (legBend - v.legL.rotation.x) * ease;
      v.legR.rotation.x += (legBend - v.legR.rotation.x) * ease;
      v.armL.rotation.x += (armBend - v.armL.rotation.x) * ease;
      v.armR.rotation.x += (armBend - v.armR.rotation.x) * ease;
      v.group.position.y += (0 - v.group.position.y) * ease;
    } else if (isMoving) {
      p.walkPhase += dt * 9;
      const swing = Math.sin(p.walkPhase) * 0.6;
      v.armL.rotation.x = swing; v.armR.rotation.x = -swing;
      v.legL.rotation.x = -swing; v.legR.rotation.x = swing;
      // Bob the whole body up/down so feet visibly lift off the ground each step
      v.group.position.y = Math.abs(Math.sin(p.walkPhase)) * 3.5;
    } else {
      const ease = Math.min(1, dt * 8);
      v.armL.rotation.x += (0 - v.armL.rotation.x) * ease;
      v.armR.rotation.x += (0 - v.armR.rotation.x) * ease;
      v.legL.rotation.x += (0 - v.legL.rotation.x) * ease;
      v.legR.rotation.x += (0 - v.legR.rotation.x) * ease;
      v.group.position.y += (0 - v.group.position.y) * ease;
    }
    } // end classic (non-kk) animation block

    const isDead = !!p.isDead;
    const shouldShow = contextMatches(p.room);

    // Normal body — hidden when dead (for remote getPlayers(), or after death anim completes for local)
    const bodyVisible = shouldShow && !isDead;
    if (bodyVisible && !v.inScene) {
      getActiveScene().add(v.group);
      v.inScene = true; v.parentScene = getActiveScene();
    } else if (!bodyVisible && v.inScene) {
      v.parentScene.remove(v.group);
      v.inScene = false; v.parentScene = null;
    } else if (bodyVisible && v.inScene && v.parentScene !== getActiveScene()) {
      v.parentScene.remove(v.group);
      getActiveScene().add(v.group);
      v.parentScene = getActiveScene();
    }

    // Death animation for local player (tip forward over 0.8s)
    if (id === getMyId() && isDead && v.deathAnimStartAt !== null) {
      const elapsed = (performance.now() - v.deathAnimStartAt) / 800;
      const t = Math.min(1, elapsed);
      if (v.kk) { if (t === 0 || v.kk.cur !== 'Death_A') kkSetState(v.kk, 'Death_A'); }
      else v.group.rotation.x = -Math.PI / 2 * t;
      if (t >= 1) {
        // Body done falling — now hide the body, show ghost
        if (v.inScene && v.parentScene) { v.parentScene.remove(v.group); v.inScene = false; }
        v.deathAnimStartAt = null;
      }
    }

    // Ghost mesh — shown when dead and in the right room
    const ghostVisible = shouldShow && isDead && v.deathAnimStartAt === null;
    if (ghostVisible && !v.ghostInScene) {
      getActiveScene().add(v.ghostGroup);
      v.ghostInScene = true; v.ghostParentScene = getActiveScene();
    } else if (!ghostVisible && v.ghostInScene) {
      if (v.ghostParentScene) v.ghostParentScene.remove(v.ghostGroup);
      v.ghostInScene = false; v.ghostParentScene = null;
    } else if (ghostVisible && v.ghostInScene && v.ghostParentScene !== getActiveScene()) {
      if (v.ghostParentScene) v.ghostParentScene.remove(v.ghostGroup);
      getActiveScene().add(v.ghostGroup);
      v.ghostParentScene = getActiveScene();
    }

    if (shouldShow) {
      const rp = getRenderPos(p);
      const seatedYOffset = (id === getMyId() && getSeatedAt()) ? -8 : 0;
      const featherMult = (id === getMyId() && getMe().activeStatus && getMe().activeStatus.type === 'feather') ? 2.4 : 1;
      const jumpYOffset = (id === getMyId() && getJumpActive()) ? Math.sin(Math.PI * getJumpT() / JUMP_DURATION) * JUMP_HEIGHT * featherMult : 0;
      // Floor height rides a short critically-damped chase instead of
      // snapping — stray profile knees, ramp edges and zone boundaries all
      // land as a glide, not a pop. Room changes and teleports snap (you
      // should not visibly "rise" out of a door you just stepped through).
      const floorYTarget = getFloorHeight(p.room, rp.x, rp.z);
      if (v.floorYS === undefined || v.floorRoomS !== p.room || Math.abs(floorYTarget - v.floorYS) > 34) v.floorYS = floorYTarget;
      else v.floorYS += (floorYTarget - v.floorYS) * (1 - Math.exp(-dt * 13));
      v.floorRoomS = p.room;
      const floorYOffset = v.floorYS;
      // Deep Meditation: sits at ground level, then rises into a hover over
      // the first couple seconds and gently bobs there for the rest of the
      // duration — x/z still track the player's real position every frame,
      // so they can walk/float around freely while up there.
      let meditateYOffset = 0;
      if (v.statusType === 'meditate') {
        const elapsedMs = performance.now() - (v.meditateStartedAt || performance.now());
        const riseT = Math.min(1, elapsedMs / 2000);
        const riseEase = riseT * riseT * (3 - 2 * riseT);
        const hoverHeight = 22;
        const bob = riseT >= 1 ? Math.sin(performance.now() * 0.0012) * 2 : 0;
        meditateYOffset = riseEase * hoverHeight + bob;
      }
      const posY = getGroundY() + seatedYOffset + jumpYOffset + floorYOffset + meditateYOffset;
      if (!isDead || v.deathAnimStartAt !== null) {
        v.group.position.set(rp.x, posY, rp.z);
        v.group.rotation.y = p.facing;
      }
      // Ghost floats slightly above ground with a gentle bob
      if (ghostVisible) {
        const ghostBob = Math.sin(performance.now() * 0.002) * 6;
        v.ghostGroup.position.set(rp.x, posY + 10 + ghostBob, rp.z);
        v.ghostGroup.rotation.y = p.facing;
      }
    }

    p.renderPrevX = p.x; p.renderPrevY = p.y;
  }
}

  return { updateStatusVisuals, updateWerewolfNpc, ensurePlayerVisual, destroyPlayerVisual, syncVisuals };
}
