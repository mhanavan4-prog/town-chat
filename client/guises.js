// Guising — the Samhain costume layer. For each present player carrying a
// `guise` id (data/guises.js), draw a disguise over their head.
//
// Mounting: the overlay is socketed on the player's KayKit **head bone** (via a
// dedicated slot_guise wrapper), so it rides the head's position, facing and
// bob rigidly — the same way equipped hats mount. That also means it sits in
// the head bone's local space (KayKit model units), not the old procedural
// CHAR space, which is what used to make the overlays float high above the
// KayKit body. A blocky pre-model stand-in (no v.kk) falls back to the old
// body-group mount so there's still *something* while the real body streams in.
//
// Three guises are real KayKit meshes cloned from the loaded asset set:
//   • skull   → guise_skull   (Halloween Bits skull)
//   • pumpkin → prop_pumpkin  (Halloween Bits jack-o'-lantern, already loaded)
//   • stag    → guise_antlers (Adventurers Druid hooded-antler head, baked to
//                              head-bone-local space so it sockets exactly)
// The other three (ghost, raven, witch hat) have no KayKit prop, so they stay
// procedural — but are scaled/placed into the same head-bone space so they no
// longer float.

export default function createGuises({ getPlayers, getVisuals, getKK }) {
  const HY = 62, HR = 8; // procedural CHAR head centre y / radius (builder space)
  const pool = {}; // playerId -> { group, type, glb, parent }

  function lambert(color, opts) { return new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {})); }
  function basic(color, opts) { return new THREE.MeshBasicMaterial(Object.assign({ color }, opts || {})); }

  // 💀 Bone Mask — a bleached skull covering the face.
  function makeSkull() {
    const g = new THREE.Group();
    const bone = lambert(0xece3cf);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(HR + 1.4, 14, 12), bone); skull.position.y = HY; skull.scale.y = 1.12; g.add(skull);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 6), bone); jaw.position.set(0, HY - 8.5, 3.2); g.add(jaw);
    const dark = lambert(0x16120e);
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(2.3, 8, 8), dark); eye.position.set(s * 3.4, HY + 1, HR); g.add(eye); }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.6, 4), dark); nose.position.set(0, HY - 2.6, HR + 0.6); nose.rotation.x = Math.PI; g.add(nose);
    for (let i = -2; i <= 2; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2, 1), bone); t.position.set(i * 1.5, HY - 7.5, HR - 0.3); g.add(t); }
    return g;
  }

  // 🎃 Jack-o'-Head — a carved, candle-lit pumpkin for a head.
  function makePumpkin() {
    const g = new THREE.Group();
    const rind = lambert(0xe3741a);
    const pk = new THREE.Mesh(new THREE.SphereGeometry(HR + 2, 14, 12), rind); pk.position.y = HY; pk.scale.set(1.12, 0.92, 1.12); g.add(pk);
    for (const s of [-1, 1]) { const rib = new THREE.Mesh(new THREE.SphereGeometry(HR + 2.1, 8, 10), lambert(0xc9600f)); rib.position.y = HY; rib.scale.set(0.28, 0.92, 1.1); rib.position.x = s * 4; g.add(rib); }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 4, 6), lambert(0x4f7a2a)); stem.position.set(0, HY + HR + 1.5, 0); stem.rotation.z = 0.2; g.add(stem);
    const glow = basic(0xffc63a);
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.2, 3), glow); eye.position.set(s * 3.6, HY + 1.5, HR + 0.4); eye.rotation.x = Math.PI / 2; g.add(eye); }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.4, 3), glow); nose.position.set(0, HY - 1.5, HR + 0.9); nose.rotation.x = Math.PI / 2; g.add(nose);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.2, 1), glow); mouth.position.set(0, HY - 5.5, HR + 0.4); g.add(mouth);
    for (let i = -1; i <= 1; i++) { const tooth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.2), rind); tooth.position.set(i * 2.4, HY - 5.5, HR + 0.7); g.add(tooth); }
    return g;
  }

  // 🐦‍⬛ Plague Raven — a long-beaked black bird mask.
  function makeRaven() {
    const g = new THREE.Group();
    const black = lambert(0x16141d);
    const head = new THREE.Mesh(new THREE.SphereGeometry(HR + 1, 14, 12), black); head.position.y = HY; head.scale.y = 1.1; g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(2.1, 15, 8), lambert(0x6a5212)); beak.position.set(0, HY - 1, HR + 5); beak.rotation.x = Math.PI / 2; g.add(beak);
    const glint = basic(0xffcf5a);
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(1.7, 8, 8), glint); eye.position.set(s * 4, HY + 2, HR - 0.5); g.add(eye); }
    for (const s of [-1, 0, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(1.1, 6, 5), black); f.position.set(s * 2.2, HY + HR, -2); f.rotation.x = -0.6; g.add(f); }
    return g;
  }

  // 🧙 Pointed Hat — the tall black hat, sitting on top of the head.
  function makeWitchHat() {
    const g = new THREE.Group();
    const felt = lambert(0x201a2c);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 1.4, 20), felt); brim.position.y = HY + HR - 1; g.add(brim);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(8.5, 26, 18), felt); cone.position.y = HY + HR + 12; cone.rotation.x = 0.08; g.add(cone);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(8.7, 9.2, 3, 18), lambert(0x4a2a6a)); band.position.y = HY + HR + 1.5; g.add(band);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 1), basic(0xe6c84a)); buckle.position.set(0, HY + HR + 1.5, 9); g.add(buckle);
    return g;
  }

  // Procedural builders — used for the raven (no KayKit prop) and as a fallback
  // for the KayKit ones until their asset has streamed in. (The devil is KayKit-
  // only; it simply doesn't draw until guise_devil loads.)
  const PROC = { skull: makeSkull, pumpkin: makePumpkin, raven: makeRaven, witch: makeWitchHat, stag: makeStag };
  const isGuise = (id) => !!(PROC[id] || GLB[id]);

  // 🦌 The Horned — procedural fallback crown of antlers (the real guise is the
  // KayKit Druid hood below; this only shows if that asset hasn't loaded yet).
  function makeStag() {
    const g = new THREE.Group();
    const horn = lambert(0xcbb089);
    function beam(side) {
      const b = new THREE.Group();
      const main = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 16, 6), horn); main.position.y = 8; main.rotation.z = side * -0.35; b.add(main);
      for (const [ty, tz] of [[6, 2], [11, -1], [15, 3]]) {
        const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 7, 5), horn);
        tine.position.set(side * 2.2, ty, tz); tine.rotation.z = side * -1.0; tine.rotation.x = -0.3; b.add(tine);
      }
      b.position.set(side * 4.5, HY + HR - 2, -1);
      return b;
    }
    g.add(beam(-1)); g.add(beam(1));
    return g;
  }

  // KayKit mesh guises — cloned from the loaded asset set and socketed on the
  // head bone. scale/y are in head-bone-local (model) units; tune if a head
  // sits too high/low or too big. antlers are baked exact, so scale 1 / y 0.
  const GLB = {
    skull:   { key: 'guise_skull',   scale: 1.15, y: 0.00, ry: 0 },
    pumpkin: { key: 'prop_pumpkin',  scale: 0.90, y: 0.00, ry: 0 },
    stag:    { key: 'guise_antlers', scale: 1.00, y: 0.00, ry: 0 },
    witch:   { key: 'guise_hat',     scale: 1.00, y: 0.00, ry: 0 }, // Series 5 Witch's hat, baked exact
    devil:   { key: 'guise_devil',   scale: 1.00, y: 0.00, ry: 0 }, // Series 5 Tiefling's horned head
  };
  // Procedural → head-bone-local transform: shrink CHAR-space builders (head at
  // y≈62, radius 8) down onto the KayKit head (radius ≈0.5, centre ≈0.4).
  const PROC_SCALE = 0.0625;
  const PROC_Y = 0.4 - HY * PROC_SCALE; // lands the builder's head centre on the bone's head

  // The per-player head-bone wrapper the guise hangs from (created lazily).
  function guiseSlot(v) {
    if (!v.kk || !v.kk.headBone) return null;
    if (!v.kk.slots) v.kk.slots = {};
    let w = v.kk.slots.slot_guise;
    if (!w) { w = new THREE.Group(); v.kk.headBone.add(w); v.kk.slots.slot_guise = w; }
    return w;
  }

  // Build the overlay object for a guise on a given visual. Returns { group, glb }.
  function makeGuise(type, v) {
    const KK = getKK && getKK();
    const onBone = !!(v.kk && v.kk.headBone);
    const spec = GLB[type];
    if (onBone && spec && KK && KK.has && KK.has(spec.key) && KK.models[spec.key]) {
      const inst = KK.models[spec.key].scene.clone(true);
      // a scaled clone's cached bounding sphere can be wrong → keep it drawn
      inst.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      const g = new THREE.Group(); g.add(inst);
      g.scale.setScalar(spec.scale); g.position.y = spec.y; g.rotation.y = spec.ry || 0;
      return { group: g, glb: true };
    }
    const mk = PROC[type]; if (!mk) return null;
    const built = mk();
    if (onBone) {
      // procedural builder lives in CHAR space — scale+shift it onto the head bone
      const w = new THREE.Group(); w.add(built);
      w.scale.setScalar(PROC_SCALE); w.position.y = PROC_Y;
      return { group: w, glb: false };
    }
    return { group: built, glb: false }; // blocky stand-in: old body-group coords
  }

  function removeRec(id) {
    const r = pool[id];
    if (r && r.group && r.group.parent) r.group.parent.remove(r.group);
    delete pool[id];
  }

  // Keep every present player's guise drawn, parented to their head bone (or
  // body group for a pre-model stand-in). Rebuilds when the guise changes, when
  // a KayKit asset finishes loading (proc → real mesh), or when the body rig is
  // rebuilt (appearance change / scene swap) and the slot must be re-seated.
  function updateGuises() {
    const players = getPlayers() || {};
    const visuals = getVisuals() || {};
    const KK = getKK && getKK();
    for (const id in pool) {
      const p = players[id]; const v = visuals[id];
      if (!p || !p.guise || !isGuise(p.guise) || !v || !v.group || v.group.visible === false) removeRec(id);
    }
    for (const id in players) {
      const p = players[id];
      if (!p.guise || !isGuise(p.guise)) continue;
      const v = visuals[id];
      if (!v || !v.group || v.group.visible === false) continue;
      const onBone = !!(v.kk && v.kk.headBone);
      const parent = onBone ? guiseSlot(v) : v.group;
      if (!parent) continue;
      const wantGlb = onBone && !!GLB[p.guise] && KK && KK.has && KK.has(GLB[p.guise].key);
      let r = pool[id];
      if (r && (r.type !== p.guise || r.glb !== wantGlb)) { removeRec(id); r = null; }
      if (!r) {
        const built = makeGuise(p.guise, v);
        if (!built) continue;
        parent.add(built.group);
        pool[id] = { group: built.group, type: p.guise, glb: built.glb, parent };
      } else if (r.group.parent !== parent) {
        if (r.group.parent) r.group.parent.remove(r.group);
        parent.add(r.group); r.parent = parent;
      }
    }
    syncHeadwear(players, visuals);
  }

  // A guise is a head/headwear replacement, so while one is worn the player's
  // own hat/helmet/hood would clash with it. Hide those accent meshes for the
  // duration and restore them — to their real Wardrobe-toggle state — when the
  // guise comes off. Purely visual, per-frame, and self-correcting: the base
  // visibility is captured off the freshly built model (the Wardrobe toggles
  // are already applied there), and v.kk is rebuilt on any appearance change,
  // so a hat toggled in the Wardrobe is picked up without a menu round-trip.
  function syncHeadwear(players, visuals) {
    for (const id in visuals) {
      const v = visuals[id];
      if (!v || !v.kk || !v.kk.inst) continue;
      let list = v.kk._headwear;
      if (!list) {
        list = [];
        v.kk.inst.traverse((o) => {
          if (o.isMesh && /_(Hat|Helmet|Hood)$/.test(o.name || '')) {
            if (o.userData._hwBase === undefined) o.userData._hwBase = o.visible; // Wardrobe state
            list.push(o);
          }
        });
        v.kk._headwear = list;
      }
      if (!list.length) continue;
      const p = players[id];
      const hide = !!(p && p.guise && isGuise(p.guise));
      for (const m of list) { const want = hide ? false : m.userData._hwBase; if (m.visible !== want) m.visible = want; }
    }
  }

  return { updateGuises };
}
