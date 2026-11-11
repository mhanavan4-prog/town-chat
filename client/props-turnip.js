// ---------------------------------------------------------------------------
// Turnip lanterns ("moots" on the Isle of Man) for the town's doors at
// Samhain. Before the American pumpkin, the carved Hallowe'en lantern in
// Ireland and Man was a turnip, now and then a potato: the National Museum of
// Ireland keeps a "ghost turnip" from Donegal (see data/mythOrRecord.js,
// 'pumpkin_lanterns', and the Hop-tu-Naa caller). KayKit has no turnip, so it
// is drawn here: a cream root with a purple shoulder, a cut lid, a carved face
// lit from inside, and a root tail.
//
// Every lantern in the town shares one InstancedMesh per part (a handful of
// draw calls for all the doors together, rather than several per lantern).
// THREE is a global. (Top-level names carry the turnip prefix: one bundle.)
// ---------------------------------------------------------------------------
const TURNIP_CREAM = 0xeddfba;
const TURNIP_PURPLE = 0x7b3f72;
const TURNIP_LID = 0x5e2f57;
const TURNIP_GLOW = 0xffb347;
const TURNIP_STALK = 0x5d7a3a;
const TURNIP_EYE_Z = 0.94; // the face's depth, out from the root's centre
const TURNIP_MOUTH_Z = 0.98;

// The parts of one turnip, radius 1, its foot at y = 0, carved face toward +z.
function turnipParts() {
  const parts = [];
  const add = (geo, color, basic, x, y, z, rx, sx, sy, sz) => {
    if (x || y || z || rx || sx || sy || sz) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, 0, 0));
      m.compose(new THREE.Vector3(x || 0, y || 0, z || 0), q, new THREE.Vector3(sx || 1, sy || 1, sz || 1));
      geo.applyMatrix4(m);
    }
    parts.push({ geo, mat: basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color }) });
  };
  // The root: squat, cream below…
  add(new THREE.SphereGeometry(1, 14, 10), TURNIP_CREAM, false, 0, 0.88, 0, 0, 1, 0.88, 1);
  // …purple where it stood out of the ground.
  add(new THREE.SphereGeometry(1.015, 14, 6, 0, Math.PI * 2, 0, 1.0), TURNIP_PURPLE, false, 0, 0.88, 0, 0, 1, 0.88, 1);
  // The cut lid, set back on, and two stalks left on it.
  add(new THREE.CylinderGeometry(0.42, 0.46, 0.12, 12), TURNIP_LID, false, 0, 1.72, 0);
  add(new THREE.ConeGeometry(0.07, 0.42, 5), TURNIP_STALK, false, -0.08, 1.95, 0, 0.25);
  add(new THREE.ConeGeometry(0.06, 0.36, 5), TURNIP_STALK, false, 0.1, 1.92, 0.02, -0.3);
  // The root tail underneath, mostly hidden.
  add(new THREE.ConeGeometry(0.18, 0.5, 6), TURNIP_CREAM, false, 0, 0.1, 0, Math.PI);
  // The carved face, glowing: two eyes and a mouth, standing just proud of the
  // skin. (The root is squashed to 0.88 high, so its skin at the eyes is about
  // 0.92 out and at the mouth about 0.97: set any further in and the face is
  // buried in the turnip, as it was until a real-GPU look showed it missing.)
  add(new THREE.BoxGeometry(0.28, 0.22, 0.14), TURNIP_GLOW, true, -0.32, 1.08, TURNIP_EYE_Z);
  add(new THREE.BoxGeometry(0.28, 0.22, 0.14), TURNIP_GLOW, true, 0.32, 1.08, TURNIP_EYE_Z);
  add(new THREE.BoxGeometry(0.62, 0.15, 0.14), TURNIP_GLOW, true, 0, 0.66, TURNIP_MOUTH_Z);
  return parts;
}

// spots: [{ x, z, size, rot }], size the lantern's width in world units.
export function makeTurnipLanterns(spots) {
  const g = new THREE.Group();
  g.userData.turnipLanterns = spots.length;
  if (!spots.length) return g;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), yUp = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  for (const part of turnipParts()) {
    const im = new THREE.InstancedMesh(part.geo, part.mat, spots.length);
    im.frustumCulled = false; // spread across the town; never cull it whole
    spots.forEach((p, i) => {
      const r = p.size / 2;
      q.setFromAxisAngle(yUp, p.rot || 0);
      pos.set(p.x, 0, p.z);
      scl.set(r, r, r);
      m4.compose(pos, q, scl);
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  }
  return g;
}
