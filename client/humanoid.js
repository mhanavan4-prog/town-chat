// ---------------------------------------------------------------------------
// Humanoid mesh builders (Tier 3.4 Phase C). The character rigs behind
// createHumanoid: createHumanoidClassic (the hand-built low-poly rig, with its
// addFace/addHair helpers) and createKayKitHumanoid (the KayKit skinned rig).
// createHumanoid picks between them. Injected into every scene/mob/NPC builder
// that spawns a humanoid. THREE/LEGEND_FX are globals; the character data tables
// (CHAR/CHARACTER_PRESETS/KK) and the KayKit state helper are injected.
// ---------------------------------------------------------------------------
export default function createHumanoidBuilder({ CHAR, CHARACTER_PRESETS, KK, kkSetState }) {
// ---------------------------------------------------------------------------
// Eyes/brows/mouth, placed at a fixed local +Z offset on the head sphere —
// +Z is "forward" at rotation.y = 0 in this engine's convention (matches
// how facing angles are derived elsewhere, e.g. Math.atan2(dx, dz)), so
// these always end up on the front of the face once the whole group is
// rotated to the character's actual facing.
function addFace(group, headY, headR, eyeColor) {
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
  const browMat = new THREE.MeshLambertMaterial({ color: 0x2a1a12 });
  const mouthMat = new THREE.MeshLambertMaterial({ color: 0x6b3a3a });
  const eyeR = headR * 0.16;
  const eyeY = headY + headR * 0.08;
  const eyeZ = headR * 0.88;
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 8, 8), eyeMat);
    eye.position.set(side * headR * 0.38, eyeY, eyeZ);
    group.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.32, headR * 0.08, headR * 0.08), browMat);
    brow.position.set(side * headR * 0.38, eyeY + headR * 0.32, eyeZ - headR * 0.05);
    group.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.5, headR * 0.1, headR * 0.08), mouthMat);
  mouth.position.set(0, headY - headR * 0.42, eyeZ - headR * 0.02);
  group.add(mouth);
}

// Five distinct silhouettes (not just recolors) so characters read as
// different from across the room, not just up close.
function addHair(group, headY, headR, style, color) {
  if (style === 'bald') return;
  const mat = new THREE.MeshLambertMaterial({ color });
  if (style === 'short' || style === 'long' || style === 'ponytail') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 1.05, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      mat
    );
    cap.position.y = headY + headR * 0.15;
    group.add(cap);
  }
  if (style === 'buzz') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 1.02, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.4),
      mat
    );
    cap.position.y = headY + headR * 0.25;
    group.add(cap);
  }
  if (style === 'long') {
    const drape = new THREE.Mesh(
      new THREE.CylinderGeometry(headR * 0.9, headR * 0.6, headR * 1.8, 8),
      mat
    );
    drape.position.set(0, headY - headR * 0.6, -headR * 0.3);
    group.add(drape);
  }
  if (style === 'ponytail') {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.35, headR * 1.6, 8), mat);
    tail.position.set(0, headY - headR * 0.3, -headR * 1.1);
    tail.rotation.x = Math.PI * 0.55;
    group.add(tail);
  }
  if (style === 'mohawk') {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.35, headR * 0.9, headR * 1.7), mat);
    ridge.position.y = headY + headR * 0.9;
    group.add(ridge);
  }
  if (style === 'witchhat') {
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(headR * 1.6, headR * 1.6, headR * 0.18, 16),
      mat
    );
    brim.position.y = headY + headR * 0.5;
    group.add(brim);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.8, headR * 2.4, 10), mat);
    cone.position.y = headY + headR * 0.5 + headR * 1.2;
    group.add(cone);
  }
  if (style === 'wolf') {
    // Pointed wolf ears — two upright cones on top of the head
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.28, headR * 0.9, 5), mat);
      ear.position.set(side * headR * 0.52, headY + headR * 0.85, -headR * 0.12);
      group.add(ear);
    }
    // Protruding snout / muzzle
    const snout = new THREE.Mesh(
      new THREE.CylinderGeometry(headR * 0.3, headR * 0.38, headR * 0.6, 8),
      mat
    );
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, headY - headR * 0.1, headR * 0.92);
    group.add(snout);
    // Dark nose at the tip
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 0.12, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x1a0a0a })
    );
    nose.position.set(0, headY - headR * 0.1, headR * 1.22);
    group.add(nose);
  }
}

// presetOverride lets a caller supply a full custom {skin,hair,hairStyle,
// eye,shirt,pants} object instead of looking one up by charId — used for
// the Ember Wastes' hostile mobs, which need their own menacing color
// schemes rather than looking like one of the 5 playable characters.
function createHumanoidClassic(charId, presetOverride) {
  const preset = presetOverride || CHARACTER_PRESETS[charId] || CHARACTER_PRESETS[0];
  const group = new THREE.Group();

  const skinMat  = () => new THREE.MeshLambertMaterial({ color: preset.skin });
  const shirtMat = () => new THREE.MeshLambertMaterial({ color: preset.shirt });
  const pantsMat = () => new THREE.MeshLambertMaterial({ color: preset.pants });

  // ── Torso: three stacked segments give waist, chest, and shoulder silhouette
  const hips = new THREE.Mesh(
    new THREE.CylinderGeometry(9.5, 10, 7, 8),
    pantsMat()
  );
  hips.position.y = CHAR.hipY + 3.5;
  group.add(hips);

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 8.5, 20, 8),
    shirtMat()
  );
  torso.position.y = CHAR.hipY + 7 + 10;
  group.add(torso);

  // Collar bone / neck ridge — a thin disc at shoulder level
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(10.5, 10.5, 2, 8),
    shirtMat()
  );
  collar.position.y = CHAR.shoulderY - 1;
  group.add(collar);

  // Neck
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 4.5, 5, 8),
    skinMat()
  );
  neck.position.y = CHAR.shoulderY + 2.5;
  group.add(neck);

  // ── Head: slightly taller than wide for a less "ball" feel
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(CHAR.headR, 16, 14),
    skinMat()
  );
  head.scale.y = 1.1;
  head.position.y = CHAR.headY;
  group.add(head);

  addFace(group, CHAR.headY, CHAR.headR, preset.eye);
  addHair(group, CHAR.headY, CHAR.headR, preset.hairStyle, preset.hair);

  // Shoulder caps — joint connectors between arm and torso; skin-toned so
  // they don't bleed the shirt color into a visible floating sphere.
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 8, 8),
      skinMat()
    );
    cap.scale.set(1, 0.6, 1);
    cap.position.set(side * 11, CHAR.shoulderY - 2, 0);
    group.add(cap);
  }

  // ── Arms: upper arm + elbow joint + forearm + hand
  function makeArm(side) {
    const pivot = new THREE.Group();

    // Upper arm (thicker near shoulder, tapers to elbow)
    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 2.8, 12, 7),
      shirtMat()
    );
    upper.position.y = -6;
    pivot.add(upper);

    // Elbow joint sphere
    const elbow = new THREE.Mesh(
      new THREE.SphereGeometry(2.9, 8, 8),
      skinMat()
    );
    elbow.position.y = -12;
    pivot.add(elbow);

    // Forearm (slightly thinner)
    const lower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.2, 9, 7),
      skinMat()
    );
    lower.position.y = -12 - 4.5;
    pivot.add(lower);

    // Hand — a small rounded box
    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 3, 3),
      skinMat()
    );
    hand.position.y = -12 - 9 - 1.5;
    pivot.add(hand);

    pivot.position.set(side * 12, CHAR.shoulderY - 1, 0);
    return pivot;
  }

  // ── Legs: thigh + knee joint + calf + foot
  function makeLeg(side) {
    const pivot = new THREE.Group();

    // Thigh (wide at top, tapers to knee)
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(4.8, 3.8, 14, 7),
      pantsMat()
    );
    thigh.position.y = -7;
    pivot.add(thigh);

    // Knee cap — a visible rounded sphere
    const knee = new THREE.Mesh(
      new THREE.SphereGeometry(3.9, 8, 8),
      pantsMat()
    );
    knee.position.y = -14;
    pivot.add(knee);

    // Calf (tapers toward ankle)
    const calf = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 2.5, 11, 7),
      pantsMat()
    );
    calf.position.y = -14 - 5.5;
    pivot.add(calf);

    // Foot — a wedge box: wider front-to-back than side, slightly angled
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(5, 2.5, 8),
      skinMat()
    );
    foot.position.set(0, -26, 2);  // slightly forward to read as a foot
    pivot.add(foot);

    pivot.position.set(side * 5.5, CHAR.hipY, 0);
    return pivot;
  }

  const armL = makeArm(-1), armR = makeArm(1);
  const legL = makeLeg(-1), legR = makeLeg(1);
  group.add(armL, armR, legL, legR);

  return { group, armL, armR, legL, legR, torso, head, baseShirtColor: preset.shirt };
}

// Tier-3 dispatcher: KayKit model when loaded, classic build otherwise.
// presetOverride callers (Ember Wastes mobs with custom palettes) always
// get the classic builder — their look is bespoke by design.
function createHumanoid(charId, presetOverride) {
  if (presetOverride || !KK.charReady(charId)) return createHumanoidClassic(charId, presetOverride);
  return createKayKitHumanoid(charId);
}

function createKayKitHumanoid(charId) {
  const preset = CHARACTER_PRESETS[charId] || CHARACTER_PRESETS[0];
  const t = KK.models[KK.charKey(charId)];
  const inst = THREE.SkeletonUtils.clone(t.scene);
  const s = 68 / t.size.y;
  inst.scale.setScalar(s);
  const group = new THREE.Group();
  group.add(inst);

  // curate the embedded hand props for this class
  const keep = KK.KEEP[charId] || [];
  const embeddedWeapons = [];
  inst.traverse(o => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    if (KK.PROP_MESHES.includes(o.name)) {
      o.visible = keep.includes(o.name);
      if (o.visible && KK.WEAPONISH.includes(o.name)) embeddedWeapons.push(o);
    }
    // the Mage's full hat brim fills the whole behind-the-shoulder camera
    // view — trim it so the witch's body stays visible
    if (o.name === 'Mage_Hat') { o.scale.multiplyScalar(0.8); o.position.y -= 0.03; }
  });

  // animation rig
  const mixer = new THREE.AnimationMixer(inst);
  KK.mixers.add(mixer);
  const actions = {};
  function act(name) {
    if (actions[name] !== undefined) return actions[name];
    const clip = t.animations.find(a => a.name === name) || null;
    actions[name] = clip ? mixer.clipAction(clip) : null;
    return actions[name];
  }
  const kk = {
    mixer, act, inst, baseScale: s, cur: null, busyUntil: 0, lastAttackAt: null,
    embeddedWeapons,
    handR: inst.getObjectByName('handslotr') || null,
    handL: inst.getObjectByName('handslotl') || null,
    headBone: inst.getObjectByName('head') || null,
    footL: inst.getObjectByName('footl') || null,
    footR: inst.getObjectByName('footr') || null,
    slots: {},
    setEmbeddedWeaponsVisible(vis) { for (const m of embeddedWeapons) m.visible = vis; }
  };
  kkSetState(kk, 'Idle');

  // Contract dummies: classic animation code (gated off for kk visuals)
  // and any stray callers still get groups at the classic pivot spots.
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-12, CHAR.shoulderY - 1, 0); armR.position.set(12, CHAR.shoulderY - 1, 0);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-5.5, CHAR.hipY, 0); legR.position.set(5.5, CHAR.hipY, 0);
  const torso = new THREE.Group(); torso.position.set(0, CHAR.hipY + 17, 0);
  const head = new THREE.Group(); head.position.set(0, CHAR.headY, 0);
  group.add(armL, armR, legL, legR, torso, head);

  return { group, armL, armR, legL, legR, torso, head, baseShirtColor: preset.shirt, kk };
}

  return { createHumanoid };
}
