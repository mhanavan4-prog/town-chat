// Guising — the Samhain costume layer. For each present player carrying a
// `guise` id (data/guises.js), draw a procedural disguise over their body. The
// overlay is parented directly to the player's own body group (the shared
// `visuals` map), so it rides their position and facing rigidly with no
// per-frame math — purely cosmetic, visible to everyone, the gameplay-free
// cousin of client/familiars.js.
//
// Head geometry mirrors client/main.js CHAR: head centre at y≈62, radius≈8,
// forward = +z. Overlays that stand in for the head are a touch larger and
// opaque so they cover the original; hats and antlers simply sit on top.

export default function createGuises({ getPlayers, getVisuals }) {
  const HY = 62, HR = 8; // head centre y, head radius (CHAR.headY / CHAR.headR)
  const pool = {}; // playerId -> { group, type }

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
    // faint vertical ribs
    for (const s of [-1, 1]) { const rib = new THREE.Mesh(new THREE.SphereGeometry(HR + 2.1, 8, 10), lambert(0xc9600f)); rib.position.y = HY; rib.scale.set(0.28, 0.92, 1.1); rib.position.x = s * 4; g.add(rib); }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 4, 6), lambert(0x4f7a2a)); stem.position.set(0, HY + HR + 1.5, 0); stem.rotation.z = 0.2; g.add(stem);
    const glow = basic(0xffc63a);
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.2, 3), glow); eye.position.set(s * 3.6, HY + 1.5, HR + 0.4); eye.rotation.x = Math.PI / 2; g.add(eye); }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.4, 3), glow); nose.position.set(0, HY - 1.5, HR + 0.9); nose.rotation.x = Math.PI / 2; g.add(nose);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.2, 1), glow); mouth.position.set(0, HY - 5.5, HR + 0.4); g.add(mouth);
    for (let i = -1; i <= 1; i++) { const tooth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.2), rind); tooth.position.set(i * 2.4, HY - 5.5, HR + 0.7); g.add(tooth); }
    return g;
  }

  // 👻 Sheet Ghost — a pale winding-sheet draped over head and shoulders.
  function makeGhost() {
    const g = new THREE.Group();
    const sheet = new THREE.Mesh(
      new THREE.ConeGeometry(16, 40, 14, 1, true),
      new THREE.MeshLambertMaterial({ color: 0xf2f0e8, transparent: true, opacity: 0.82, side: THREE.DoubleSide })
    );
    sheet.position.y = HY - 8; g.add(sheet);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xf2f0e8, transparent: true, opacity: 0.82, side: THREE.DoubleSide }));
    cap.position.y = HY + 12; g.add(cap);
    const dark = basic(0x1b1b22);
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.CircleGeometry(2.2, 12), dark); eye.position.set(s * 3.6, HY + 2, 13.6); g.add(eye); }
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
    // a couple of swept crest feathers
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

  // 🦌 The Horned — a crown of antlers rising from the head.
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

  const BUILDERS = {
    skull: makeSkull,
    pumpkin: makePumpkin,
    ghost: makeGhost,
    raven: makeRaven,
    witch: makeWitchHat,
    stag: makeStag,
  };

  function removeRec(id) {
    const r = pool[id];
    if (r && r.group && r.group.parent) r.group.parent.remove(r.group);
    delete pool[id];
  }

  // Keep every present player's guise drawn on their body. Parented to the
  // player's own group, so it follows position + facing with no math here.
  function updateGuises() {
    const players = getPlayers() || {};
    const visuals = getVisuals() || {};
    // Drop guises whose owner left, doffed the costume, or left the scene.
    for (const id in pool) {
      const p = players[id]; const v = visuals[id];
      if (!p || !p.guise || !BUILDERS[p.guise] || !v || !v.group || v.group.visible === false) removeRec(id);
    }
    for (const id in players) {
      const p = players[id];
      if (!p.guise || !BUILDERS[p.guise]) continue;
      const v = visuals[id];
      if (!v || !v.group || v.group.visible === false) continue;
      let r = pool[id];
      if (r && r.type !== p.guise) { removeRec(id); r = null; }
      if (!r) {
        const group = BUILDERS[p.guise]();
        v.group.add(group);
        pool[id] = { group, type: p.guise };
      } else if (r.group.parent !== v.group) {
        // The body group was rebuilt (appearance change / scene swap) — re-seat.
        if (r.group.parent) r.group.parent.remove(r.group);
        v.group.add(r.group);
      }
    }
  }

  return { updateGuises };
}
