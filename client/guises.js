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
// The turnip (the Moot) has no KayKit prop either, and is always drawn here.
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

  // 🏮 The Moot — a hollowed turnip for a head, the older Hallowe'en lantern of
  // Ireland and Man: cream below, purple at the shoulder where it stood out of
  // the ground, the cut lid set back on with its stalks, a face carved through
  // and lit from inside. (The door lanterns in town are the same turnip:
  // client/props-turnip.js.) KayKit has no turnip, so it is always drawn here.
  function makeTurnip() {
    const g = new THREE.Group();
    const cream = lambert(0xeddfba);
    const root = new THREE.Mesh(new THREE.SphereGeometry(HR + 2, 14, 12), cream); root.position.y = HY; root.scale.set(1.05, 0.95, 1.05); g.add(root);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(HR + 2.15, 14, 6, 0, Math.PI * 2, 0, 1.0), lambert(0x7b3f72));
    shoulder.position.y = HY; shoulder.scale.set(1.05, 0.95, 1.05); g.add(shoulder);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 1.2, 12), lambert(0x5e2f57)); lid.position.y = HY + HR + 1.2; g.add(lid);
    const leaf = lambert(0x5d7a3a);
    for (const [x, rz] of [[-0.8, 0.25], [1, -0.3]]) { const st = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.2, 5), leaf); st.position.set(x, HY + HR + 3.4, 0); st.rotation.z = rz; g.add(st); }
    const glow = basic(0xffb347);
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2, 1.2), glow); eye.position.set(s * 3.3, HY + 1.6, HR + 1.2); g.add(eye); }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.5, 1.2), glow); mouth.position.set(0, HY - 3.6, HR + 1.1); g.add(mouth);
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
  const PROC = { skull: makeSkull, pumpkin: makePumpkin, turnip: makeTurnip, raven: makeRaven, witch: makeWitchHat, stag: makeStag };
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
    // ── The Monsters' Masque (collectible). Unlike the baked head props above,
    // these clone just the named head mesh out of a full KayKit character
    // already loaded for its NPC (`node`), anchor it on that character's own
    // head bone (`center:true`), and are then fitted to HEAD_FIT below — they
    // carry no hand-tuned scale/y, because hand-tuned numbers are exactly what
    // left them sitting low and small next to the free ones.
    werewolf:     { key: 'npc_werewolf', node: 'Werewolf_Wolf_Head', center: true, ry: 0 },
    vampire:      { key: 'npc_vampire',  node: 'Vampire_Head',       center: true, ry: 0 },
    frankenstein: { key: 'guise_frank',  node: 'Monstrosity_Head',   center: true, ry: 0 },
  };
  // Where a head sits on the head bone, in head-bone-local units.
  //
  // Every free guise is a baked prop authored to drop straight onto the bone,
  // and all three full-head ones land in the same place — box centre y 0.537 /
  // 0.582 / 0.492 and height 1.03 / 1.17 / 1.20 for the skull, pumpkin and
  // devil. The masque heads are carved out of character rigs instead, where
  // the head is authored wherever that character's neck happens to be, so a
  // fixed scale/offset could only ever be right for one of them: measured on
  // the head bone they came out at centre y 0.25 / 0.19 / 0.08 and about 20%
  // undersized — reading as sunken into the chest.
  //
  // So they are fitted to the free props' own box instead of guessed at. A new
  // masque head lines up with no measuring, and "it sits where the free ones
  // sit" is a number this can be held to (see guiseFit in the test hooks).
  // backZ is where the free props' skulls END at the back (their min.z runs
  // -0.53 / -0.63 / -0.50). Anchoring the back of the head there rather than
  // centring it means a muzzle or a beak still projects forward, while a head
  // the source rig authored out past its own neck — the Monstrosity sat 0.36
  // forward on a head only 0.87 deep, i.e. floating in front of the face —
  // gets seated back onto it.
  const HEAD_FIT = { centerY: 0.537, height: 1.136, backZ: -0.55 };
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
      const src = KK.models[spec.key].scene;
      const g = new THREE.Group();
      if (spec.node) {
        // Collectible character-head guise: pull just the named head mesh(es) out
        // of the full character rig and draw them un-skinned at bind pose (a plain
        // Mesh sharing the source geometry/material — no skeleton, no deform), then
        // auto-centre on the head bone so a head authored up at the model's neck
        // sits on the wearer's head without a hand-measured offset.
        const names = Array.isArray(spec.node) ? spec.node : [spec.node];
        src.traverse((o) => {
          if ((o.isMesh || o.isSkinnedMesh) && names.indexOf(o.name) !== -1) {
            // Clone the material with skinning off so the shared KayKit atlas still
            // textures it, but it draws as a static mesh (no skeleton to deform it).
            const mat = (o.material && o.material.clone) ? o.material.clone() : o.material;
            if (mat) { mat.skinning = false; }
            const m = new THREE.Mesh(o.geometry, mat);
            m.frustumCulled = false;
            g.add(m);
          }
        });
        if (!g.children.length) return null; // asset not fully streamed yet — retry next frame
        if (spec.center) {
          // Anchor the head on the SOURCE character's own head bone, so it mounts
          // on the wearer's head bone exactly as it sits on the body. Centring on
          // the head's geometric middle instead dropped it into the chest (the
          // middle of a head is well below where the neck joins it).
          src.updateMatrixWorld(true);
          let anchor = null;
          src.traverse((o) => { if (!anchor && o.name === 'head') anchor = o.getWorldPosition(new THREE.Vector3()); });
          if (!anchor) { const box = new THREE.Box3().setFromObject(g); anchor = box.getCenter(new THREE.Vector3()); } // fallback
          for (const m of g.children) m.position.sub(anchor);
          // Now measure what we actually have and sit it where the free props
          // sit. The children carry plain position offsets at this point, so
          // their geometry boxes shifted by those offsets give the real extent.
          const fit = new THREE.Box3();
          for (const m of g.children) {
            if (!m.geometry) continue;
            if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
            fit.union(m.geometry.boundingBox.clone().translate(m.position));
          }
          if (!fit.isEmpty()) {
            const size = fit.getSize(new THREE.Vector3());
            const ctr = fit.getCenter(new THREE.Vector3());
            const s = size.y > 1e-6 ? HEAD_FIT.height / size.y : 1;
            // x centres on the bone (a head is symmetrical), y matches the free
            // props' centre, z seats the BACK of the head where theirs ends.
            g.scale.setScalar(s);
            g.position.set(
              -ctr.x * s,
              HEAD_FIT.centerY - ctr.y * s,
              HEAD_FIT.backZ - fit.min.z * s
            );
            g.rotation.y = spec.ry || 0;
            return { group: g, glb: true };
          }
        }
      } else {
        const inst = src.clone(true);
        // a scaled clone's cached bounding sphere can be wrong → keep it drawn
        inst.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
        g.add(inst);
      }
      g.scale.setScalar(spec.scale == null ? 1 : spec.scale);
      g.position.y = spec.y || 0;
      g.rotation.y = spec.ry || 0;
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
        // Tag every mesh in the overlay as guise-owned. The overlay is socketed
        // on the head bone, which lives *inside* v.kk.inst — so syncHeadwear's
        // inst.traverse would otherwise sweep up the guise's own meshes. The
        // antlered-HOOD guise has a '..._Hood' mesh that matches RE_HEADWEAR, so
        // without this tag syncHeadwear hid the guise itself on top of the base
        // head → a fully headless player (only on warm/cached loads, where the
        // guise attaches before the headwear list is first cached).
        built.group.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.userData._guiseMesh = true; });
        parent.add(built.group);
        pool[id] = { group: built.group, type: p.guise, glb: built.glb, parent, onBone };
      } else if (r.group.parent !== parent) {
        if (r.group.parent) r.group.parent.remove(r.group);
        parent.add(r.group); r.parent = parent; r.onBone = onBone;
      }
    }
    syncHeadwear(players, visuals);
  }

  // Guises that REPLACE the whole head (vs. just adding headwear like the hat).
  // For these, the player's own head — skull/jaw/eyes on a skeleton body, the
  // face/hair mesh on the others — must hide too, or it bleeds through the
  // smaller guise head. The witch hat sits ON your head, so it is NOT here.
  const COVERS_HEAD = new Set(['skull', 'pumpkin', 'devil', 'stag', 'raven', 'werewolf', 'vampire', 'frankenstein']);
  const RE_HEADWEAR = /_(Hat|Helmet|Hood)$/;                 // your own hat — hidden by ANY guise (and by a worn hat with a model of its own: _gearHides)
  const RE_HEADCORE = /(_Head(_Hooded)?|_Skull|_Jaw|_Eyes)$/; // your own head — hidden by a head-covering guise

  // While a guise is worn, hide the player's own headwear (always) and — for a
  // full-head guise — their own head, so nothing clips through. Restore both to
  // their real built state when the guise comes off. Purely visual, per-frame,
  // self-correcting: base visibility is captured off the freshly built model
  // (Wardrobe toggles already applied), and v.kk rebuilds on any appearance
  // change, so a hat toggled in the Wardrobe is honoured with no menu round-trip.
  function syncHeadwear(players, visuals) {
    for (const id in visuals) {
      const v = visuals[id];
      if (!v || !v.kk || !v.kk.inst) continue;
      let hw = v.kk._headwear, hc = v.kk._headcore;
      if (!hw || !hc) {
        hw = []; hc = [];
        v.kk.inst.traverse((o) => {
          if (!o.isMesh) return;
          if (o.userData._guiseMesh) return; // the socketed guise overlay is not the player's own headwear
          const nm = o.name || '';
          if (RE_HEADWEAR.test(nm)) { if (o.userData._hwBase === undefined) o.userData._hwBase = o.visible; hw.push(o); }
          else if (RE_HEADCORE.test(nm)) { if (o.userData._hcBase === undefined) o.userData._hcBase = o.visible; hc.push(o); }
        });
        v.kk._headwear = hw; v.kk._headcore = hc;
      }
      const p = players[id];
      const g = p && p.guise;
      const worn = !!(g && isGuise(g));
      // Only hide your real head once the full-head guise is actually drawn on
      // the head bone. On a cold refresh the guise asset loads a beat after the
      // player data arrives — hiding the head before the guise mesh exists (or
      // while it's still a mislocated pre-rig stand-in) left you headless and
      // stuck there for the whole load window.
      const rec = pool[id];
      const guiseOnBone = !!(rec && rec.type === g && rec.onBone && rec.group && rec.group.parent);
      const hideHead = worn && COVERS_HEAD.has(g) && guiseOnBone;
      for (const m of hw) { const want = (worn || m.userData._gearHides) ? false : m.userData._hwBase; if (m.visible !== want) m.visible = want; }
      for (const m of hc) { const want = hideHead ? false : m.userData._hcBase; if (m.visible !== want) m.visible = want; }
    }
  }

  return { updateGuises };
}
