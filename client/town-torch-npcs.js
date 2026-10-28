// ---------------------------------------------------------------------------
// Town torch NPCs (Tier 3.4 Phase C). The hooded Torchkeepers who tend the four
// ritual torches at night: build-on-first-sight + interpolate over the private
// townTorchNpcVisuals pool, plus applyTownTorchState which lights/extinguishes the
// torch flames (the townTorchVisuals map that initScene populates, injected by
// reference). createHumanoid + floor/rig/angle/name-sprite helpers injected;
// the town scene via getter.
// ---------------------------------------------------------------------------
export default function createTownTorchNpcs({ createHumanoid, getFloorHeight, kkSetState, lerpAngle, makeNpcNameSprite, townTorchVisuals, getOutdoorScene, KK }) {
  let townTorchNpcVisuals = {};

// Build the rig + name label and drop it into the scene. Returns the visual's
// render fields (group/limb pivots and the KayKit handle, when the model is up).
function buildTorchNpcRig(charId, name) {
  const built = createHumanoid(charId);
  built.group.visible = false;
  // Local (0, 90, 0) — rotating the group around Y (facing) never moves
  // a point that sits exactly on the Y axis, so this stays put above
  // their head and doesn't swing around as they turn, without needing
  // to be repositioned every frame like a scene-level label would.
  const label = makeNpcNameSprite(name, 'Keeper of the Flame');
  label.position.set(0, 90, 0);
  built.group.add(label);
  if (getOutdoorScene()) getOutdoorScene().add(built.group);
  return { group: built.group, armL: built.armL, armR: built.armR, legL: built.legL, legR: built.legR, kk: built.kk };
}

function getOrCreateTownTorchNpcVisual(id, charId, name) {
  if (!townTorchNpcVisuals[id]) {
    const rig = buildTorchNpcRig(charId, name);
    townTorchNpcVisuals[id] = {
      ...rig, charId, name,
      x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0,
      working: false, praying: false, walkPhase: 0, initialized: false
    };
  }
  return townTorchNpcVisuals[id];
}

// KayKit recovery (mirrors the player-visuals upgrade): a Torchkeeper drawn
// before the ~18MB of models finish loading gets the classic fallback rig and
// would otherwise be stuck on it. The moment KK settles, rebuild any Keeper
// still on the fallback so they all upgrade to the KayKit model in place.
function upgradeTorchNpcsToKK() {
  for (const id in townTorchNpcVisuals) {
    const v = townTorchNpcVisuals[id];
    if (v.kk || !KK.charReady(v.charId)) continue; // already KayKit, or model not ready
    if (v.group && v.group.parent) v.group.parent.remove(v.group);
    const rig = buildTorchNpcRig(v.charId, v.name);
    v.group = rig.group; v.armL = rig.armL; v.armR = rig.armR; v.legL = rig.legL; v.legR = rig.legR; v.kk = rig.kk;
  }
}

function applyTownTorchNpcState(npcs) {
  if (!getOutdoorScene()) return;
  for (const n of npcs) {
    const v = getOrCreateTownTorchNpcVisual(n.id, n.charId, n.name);
    v.targetX = n.x; v.targetY = n.y; v.targetFacing = n.facing; v.working = n.working;
    v.praying = !!n.praying;
    if (!v.initialized) { v.x = n.x; v.y = n.y; v.facing = n.facing; v.initialized = true; }
  }
  // Self-heal: KayKit character models stream in after the critical set settles,
  // so each broadcast re-checks and upgrades any Keeper still on the fallback rig
  // now that its model is ready. A no-op once everyone's on KayKit.
  if (KK) upgradeTorchNpcsToKK();
}

function updateTownTorchNpcVisuals(dt) {
  if (!getOutdoorScene()) return;
  const f = 1 - Math.exp(-dt * 8);
  for (const id in townTorchNpcVisuals) {
    const v = townTorchNpcVisuals[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);
    v.group.rotation.y = v.facing;

    // Kneeling by day happens up on the Temple's raised platform now — same
    // ramped height a player standing there gets (see getFloorHeight);
    // everywhere else (out at the torches, walking between the two) is
    // ground level, same as before. Chased, not snapped, same as players —
    // their patrol lines can cross building stair ramps.
    const baseYT = getFloorHeight('outside', v.x, v.y);
    if (v.baseYS === undefined || Math.abs(baseYT - v.baseYS) > 34) v.baseYS = baseYT;
    else v.baseYS += (baseYT - v.baseYS) * f;
    const baseY = v.baseYS;

    const moving = Math.hypot(v.targetX - v.x, v.targetY - v.y) > 3;
    v.walkPhase += dt * (moving ? 5.5 : (v.working || v.praying) ? 3 : 0);
    // The Skeletons-pack character models have no 'Interact' clip, and kkSetState
    // no-ops on a missing clip — so a keeper tending its torch kept playing the
    // previous Walking_A and walked in place. Stand Idle at the torch instead
    // (Sit_Floor_Idle does exist, so the daytime temple prayer still works).
    if (v.kk) kkSetState(v.kk, moving ? 'Walking_A' : v.praying ? 'Sit_Floor_Idle' : 'Idle');

    let poseY = 0;
    if (moving) {
      const swing = Math.sin(v.walkPhase) * 0.45;
      v.armL.rotation.x = swing;
      v.armR.rotation.x = -swing;
      v.legL.rotation.x = -swing * 0.65;
      v.legR.rotation.x = swing * 0.65;
      poseY = Math.abs(Math.sin(v.walkPhase)) * 2;
    } else if (v.working) {
      // Slow reach-and-tend motion once they've arrived at their torch.
      const tend = Math.abs(Math.sin(v.walkPhase)) * 0.5;
      v.armL.rotation.x = -tend;
      v.armR.rotation.x = -tend * 0.7;
      v.legL.rotation.x = 0;
      v.legR.rotation.x = 0;
    } else if (v.praying) {
      // Kneeling at the altar by day — legs bent under, arms raised in a
      // slow chant-like sway. Only a small settle (the bent legs already read
      // as kneeling); the old -9 drop sank them through the raised Temple
      // platform's top (baseY is the platform surface, not the ground below).
      const sway = Math.sin(v.walkPhase * 0.6) * 0.18;
      v.armL.rotation.x = -1.9 + sway;
      v.armR.rotation.x = -1.9 - sway;
      v.legL.rotation.x = -1.3;
      v.legR.rotation.x = -1.3;
      poseY = -1 + Math.sin(v.walkPhase * 0.6) * 0.6;
    } else {
      v.armL.rotation.x *= 0.85;
      v.armR.rotation.x *= 0.85;
      v.legL.rotation.x *= 0.85;
      v.legR.rotation.x *= 0.85;
    }

    v.group.position.set(v.x, baseY + poseY, v.y);
    v.group.visible = true;
  }
}

function applyTownTorchState(torches) {
  for (const t of torches) {
    const v = townTorchVisuals[t.id];
    if (!v) continue;
    v.flame.visible = t.lit;
    v.light.intensity = t.lit ? 1.3 : 0;
    // Perf: an unlit torch's PointLight sits at intensity 0 but Three.js still
    // iterates it per-pixel in every lit material's shader. Hiding it drops it
    // from the light loop entirely — a real mobile win by day, when all four
    // ritual torches are dark. (Toggling visibility recompiles the lighting
    // shader once, at dusk/dawn when they actually light — not per frame.)
    v.light.visible = t.lit;
  }
}

  return { applyTownTorchNpcState, updateTownTorchNpcVisuals, applyTownTorchState };
}
