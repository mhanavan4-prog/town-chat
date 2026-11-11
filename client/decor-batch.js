// ---------------------------------------------------------------------------
// Batching the small decor: the town's and the Wilds' harvestable plants,
// flower patches, bushes and berry shrubs. Each was a group of little meshes
// (a stem, a leaf or two, a flower head), and the Wilds had hundreds of them,
// so most of a frame's draw calls went on identical small spheres, cones and
// stems, one at a time. (Measured with __testDrive.sceneBreakdown: 6,800
// meshes in the Wilds, 5,800 of them code-built shapes, 1,860 in view.)
//
// Here every mesh of every batchable group is gathered by what it would share
// (its shape, and its material apart from colour) and by which map chunk it
// stands in, and drawn as one InstancedMesh per gather. Each copy carries its
// own colour (the batch's material is white), so one sphere batch holds every
// flower colour. Chunks keep frustum culling working: each batch's bounding
// sphere covers only its own chunk.
//
// What stays the same:
//   • Harvesting: a harvested plant shrinks to 0.42 and goes a dull brown, by
//     rewriting its copies' matrices and colours (setDecorBatchHarvested).
//   • Clicking: the plant keeps an invisible stand-in group at its spot, with
//     its userData, and a hit box that raycasts but is never drawn.
//   • The camera's fade: a tree tagged userData.camFade (it ghosts when it
//     stands between the camera and you) is batched too, and its stand-in
//     carries the tag. When the fader picks it, its copies are hidden and a
//     whole copy of the tree (kept aside, sharing geometry and materials) is
//     put back in its place to be ghosted; once it has faded back, the copy
//     goes and the batched copies return (decorBatchFadeSwap).
//   • Anything with a light, sprite, skinned or already-instanced part, or a
//     faded part inside it, is left alone and drawn as before.
// THREE is a global. (Top-level names carry the decorBatch prefix.)
// ---------------------------------------------------------------------------
const DECOR_BATCH_CHUNK = 2400;
const DECOR_BATCH_MIN = 6; // a shape with fewer copies than this in a chunk stays as it was
// Sparse things (a dead tree here and there, a graveyard's few stones of each
// kind) rarely make six to a chunk; those are gathered again over a wider
// stretch, three chunks a side, before being left as they were.
const DECOR_BATCH_WIDE = DECOR_BATCH_CHUNK * 3;
const DECOR_BATCH_DULL = 0x6b5a45; // the harvested look (applyDecorHarvestedLook)
const DECOR_BATCH_SHRINK = 0.42;

// Can this group be batched? Plain meshes and groups only. The group itself
// may be one the camera fades; a faded part inside it may not.
export function decorBatchable(group) {
  if (!group) return false;
  let ok = true, meshes = 0;
  group.traverse((o) => {
    if (!ok) return;
    if (o !== group && o.userData && o.userData.camFade) { ok = false; return; }
    if (o.isMesh) {
      if (o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(o.material) || !o.geometry || !o.material) { ok = false; return; }
      meshes++;
    } else if (!(o.isGroup || o.type === 'Object3D' || o.type === 'Scene')) ok = false; // a light, sprite, line…
  });
  return ok && meshes > 0 && meshes <= 60;
}

// A shape, as a unit template plus the scale that makes it this one: a
// sphere of any radius, a cone or box of any size, a cylinder of any height
// share one template (the copy's matrix carries the size). Anything else
// (a loaded model's geometry) is its own key.
const decorBatchR = (x) => Math.round(x * 100) / 100;
function decorBatchNorm(g) {
  const P = g.parameters;
  if (!P) return { key: 'uuid:' + g.uuid, scale: [1, 1, 1], make: () => g.clone() };
  switch (g.type) {
    case 'SphereGeometry': case 'SphereBufferGeometry':
      return { key: ['S', P.widthSegments, P.heightSegments, decorBatchR(P.phiStart), decorBatchR(P.phiLength), decorBatchR(P.thetaStart), decorBatchR(P.thetaLength)].join(','), scale: [P.radius, P.radius, P.radius],
        make: () => new THREE.SphereGeometry(1, P.widthSegments, P.heightSegments, P.phiStart, P.phiLength, P.thetaStart, P.thetaLength) };
    case 'CylinderGeometry': case 'CylinderBufferGeometry': {
      const rb = P.radiusBottom || P.radiusTop || 1, ratio = decorBatchR(P.radiusTop / rb);
      return { key: ['C', ratio, P.radialSegments, P.heightSegments, P.openEnded].join(','), scale: [rb, P.height, rb],
        make: () => new THREE.CylinderGeometry(ratio, 1, 1, P.radialSegments, P.heightSegments, P.openEnded) };
    }
    case 'ConeGeometry': case 'ConeBufferGeometry':
      return { key: ['K', P.radialSegments, P.heightSegments, P.openEnded].join(','), scale: [P.radius, P.height, P.radius],
        make: () => new THREE.ConeGeometry(1, 1, P.radialSegments, P.heightSegments, P.openEnded) };
    case 'BoxGeometry': case 'BoxBufferGeometry':
      return { key: ['B', P.widthSegments, P.heightSegments, P.depthSegments].join(','), scale: [P.width, P.height, P.depth],
        make: () => new THREE.BoxGeometry(1, 1, 1, P.widthSegments, P.heightSegments, P.depthSegments) };
    case 'DodecahedronGeometry': case 'IcosahedronGeometry': case 'OctahedronGeometry': case 'TetrahedronGeometry':
      return { key: [g.type, P.detail].join(','), scale: [P.radius, P.radius, P.radius], make: () => new THREE[g.type](1, P.detail) };
    default:
      return { key: g.type + JSON.stringify(P), scale: [1, 1, 1], make: () => g.clone() };
  }
}
function decorBatchMatKey(m) {
  return [m.type, m.map ? m.map.uuid : '', m.emissive ? m.emissive.getHexString() : '', m.emissiveIntensity, m.transparent, m.opacity, m.side,
    m.flatShading, m.vertexColors, m.depthWrite, m.alphaTest].join('|');
}

// entries: [{ v, group }]. Each group is positioned (not yet in the scene);
// v is its decorVisuals record, given v.batch and an invisible stand-in group.
// Returns the number of InstancedMeshes made.
export function batchDecorGroups(scene, entries) {
  const inv = new THREE.Matrix4();
  // First pass: every part, keyed by shape, material-but-colour and chunk.
  const parts = [];
  const count = new Map();
  for (const { v, group } of entries) {
    group.updateMatrixWorld(true);
    // A tree the camera fades keeps a whole copy aside, for while it's ghosted.
    v.fadeGroup = null;
    if (group.userData.camFade) { v.fadeGroup = group.clone(); v.fadeGroup.userData.camFade = false; v.fadeShown = false; }
    inv.copy(group.matrixWorld).invert();
    const cx = Math.floor(group.position.x / DECOR_BATCH_CHUNK), cz = Math.floor(group.position.z / DECOR_BATCH_CHUNK);
    const wx = Math.floor(group.position.x / DECOR_BATCH_WIDE), wz = Math.floor(group.position.z / DECOR_BATCH_WIDE);
    group.traverse((o) => {
      if (!o.isMesh) return;
      const n = decorBatchNorm(o.geometry);
      const shape = n.key + '#' + decorBatchMatKey(o.material);
      const key = shape + '@' + cx + ',' + cz;
      count.set(key, (count.get(key) || 0) + 1);
      parts.push({ v, group, o, n, key, wide: shape + '@w' + wx + ',' + wz });
    });
  }
  // Too few in their chunk: try the wider stretch instead.
  for (const pt of parts) if (count.get(pt.key) < DECOR_BATCH_MIN) { pt.key = pt.wide; count.set(pt.key, (count.get(pt.key) || 0) + 1); }
  // Second pass: shapes common enough are gathered; the rest stay in their plant.
  const gathers = new Map();
  const unit = new THREE.Matrix4();
  for (const e of entries) { e.v.batch = []; e.v.rest = []; }
  for (const pt of parts) {
    if (count.get(pt.key) < DECOR_BATCH_MIN) { pt.v.rest.push(pt.o); continue; }
    let gt = gathers.get(pt.key);
    if (!gt) { gt = { n: pt.n, mat: pt.o.material, items: [] }; gathers.set(pt.key, gt); }
    inv.copy(pt.group.matrixWorld).invert();
    unit.makeScale(pt.n.scale[0] || 1e-6, pt.n.scale[1] || 1e-6, pt.n.scale[2] || 1e-6);
    // The part relative to its plant, times the template's size.
    const local = new THREE.Matrix4().multiplyMatrices(inv, pt.o.matrixWorld).multiply(unit);
    const world = new THREE.Matrix4().multiplyMatrices(pt.group.matrixWorld, local);
    const part = { index: gt.items.length, local, color: pt.o.material.color ? pt.o.material.color.getHex() : 0xffffff };
    gt.items.push({ part, world });
    pt.v.batch.push(part);
  }
  for (const { v, group } of entries) {
    // Whatever wasn't gathered stays in a slimmed copy of the plant.
    const batched = new Set();
    for (const pt of parts) if (pt.v === v && !v.rest.includes(pt.o)) batched.add(pt.o);
    for (const o of batched) if (o.parent) o.parent.remove(o);
    v.restGroup = v.rest.length ? group : null;
    v.restMaterials = v.rest.map((mesh) => ({ mesh, material: mesh.material }));
    // The stand-in: same place, same userData, an invisible box to click.
    const box = new THREE.Box3();
    for (const pt of parts) if (pt.v === v) { pt.o.geometry.computeBoundingBox(); box.union(pt.o.geometry.boundingBox.clone().applyMatrix4(pt.o.matrixWorld)); }
    const proxy = new THREE.Group();
    proxy.position.copy(group.position); proxy.quaternion.copy(group.quaternion); proxy.scale.copy(group.scale);
    proxy.userData = { ...group.userData, decorBatched: true };
    if (v.fadeGroup) {
      // The stand-in is what the fader finds; the plant's leftovers aren't.
      group.userData.camFade = false;
      v.fadeMaterials = [];
      v.fadeGroup.traverse((m) => { if (m.isMesh) v.fadeMaterials.push({ mesh: m, material: m.material }); });
      v.scene = scene;
      proxy.userData.decorFadeSwap = { group: v.fadeGroup, show: (on) => decorBatchFadeSwap(v, on) };
    }
    if (!box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
      const hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(size.x, 4), Math.max(size.y, 4), Math.max(size.z, 4)), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(ctr.x - group.position.x, ctr.y - group.position.y, ctr.z - group.position.z);
      hit.userData.decorHit = true;
      proxy.add(hit);
    }
    v.basePos = group.position.clone(); v.baseQuat = group.quaternion.clone(); v.baseScale = group.scale.clone();
    v.group = proxy;
    scene.add(proxy);
    if (v.restGroup) scene.add(v.restGroup);
  }
  let made = 0;
  const col = new THREE.Color(), p = new THREE.Vector3();
  for (const gt of gathers.values()) {
    const geo = gt.n.make(); // its own copy, so its bounding sphere can be the chunk's
    const mat = gt.mat.clone();
    if (mat.color) mat.color.set(0xffffff); // the colour rides on each copy
    const im = new THREE.InstancedMesh(geo, mat, gt.items.length);
    im.userData.decorBatch = true;
    geo.computeBoundingSphere();
    const r0 = geo.boundingSphere.radius;
    const ctr = new THREE.Vector3();
    gt.items.forEach((it) => { ctr.add(p.setFromMatrixPosition(it.world)); });
    ctr.divideScalar(gt.items.length);
    let maxR = 0;
    gt.items.forEach((it, i) => {
      im.setMatrixAt(i, it.world);
      im.setColorAt(i, col.setHex(it.part.color));
      maxR = Math.max(maxR, p.setFromMatrixPosition(it.world).distanceTo(ctr) + r0 * Math.max(it.world.getMaxScaleOnAxis(), 1e-6));
      it.part.im = im;
    });
    // Cull the batch as a whole chunk, not as one small shape at the origin.
    geo.boundingSphere = new THREE.Sphere(ctr.clone(), maxR);
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    scene.add(im);
    made++;
  }
  return made;
}

// Each batched copy of a plant, hidden (scaled to nothing) or put back.
function decorBatchHideCopies(v) {
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const touched = new Set();
  for (const part of v.batch) { if (part.im) { part.im.setMatrixAt(part.index, zero); touched.add(part.im); } }
  for (const im of touched) im.instanceMatrix.needsUpdate = true;
}

// The whole copy of a faded tree, given the plant's look (harvested or not).
function decorBatchFadeLook(v) {
  const k = v.batchHarvested ? DECOR_BATCH_SHRINK : 1;
  v.fadeGroup.position.copy(v.basePos); v.fadeGroup.quaternion.copy(v.baseQuat);
  v.fadeGroup.scale.copy(v.baseScale).multiplyScalar(k);
  for (const { mesh, material } of v.fadeMaterials) {
    if (v.batchHarvested) {
      if (!mesh.userData.decorDull) { const dull = material.clone(); if (dull.color) dull.color.set(DECOR_BATCH_DULL); mesh.userData.decorDull = dull; }
      mesh.material = mesh.userData.decorDull;
    } else mesh.material = material;
  }
}

// The camera's fader wants this tree ghosted (on) or done with it (off): swap
// the batched copies for the whole copy, or back. Returns the group to fade.
export function decorBatchFadeSwap(v, on) {
  if (!v || !v.fadeGroup) return null;
  if (on && !v.fadeShown) {
    decorBatchHideCopies(v);
    if (v.restGroup) v.restGroup.visible = false;
    decorBatchFadeLook(v);
    v.scene.add(v.fadeGroup);
    v.fadeShown = true;
  } else if (!on && v.fadeShown) {
    if (v.fadeGroup.parent) v.fadeGroup.parent.remove(v.fadeGroup);
    if (v.restGroup) v.restGroup.visible = true;
    v.fadeShown = false;
    setDecorBatchHarvested(v, !!v.batchHarvested);
  }
  return v.fadeGroup;
}

// The harvested look, on a batched plant: shrunk, and dulled to brown.
export function setDecorBatchHarvested(v, harvested) {
  if (!v || !v.batch) return false;
  v.batchHarvested = harvested;
  // While the tree is ghosted its whole copy stands in; that takes the look,
  // and the batched copies stay hidden until it's swapped back.
  if (v.fadeShown) { decorBatchFadeLook(v); return true; }
  const k = harvested ? DECOR_BATCH_SHRINK : 1;
  const base = new THREE.Matrix4().compose(v.basePos, v.baseQuat, v.baseScale.clone().multiplyScalar(k));
  const m = new THREE.Matrix4(), c = new THREE.Color();
  const touched = new Set();
  for (const part of v.batch) {
    if (!part.im) continue;
    part.im.setMatrixAt(part.index, m.multiplyMatrices(base, part.local));
    part.im.setColorAt(part.index, c.setHex(harvested ? DECOR_BATCH_DULL : part.color));
    touched.add(part.im);
  }
  for (const im of touched) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  // The parts left in the plant itself: shrunk with it, dulled the old way.
  if (v.restGroup) {
    v.restGroup.scale.copy(v.baseScale).multiplyScalar(k);
    for (const { mesh, material } of v.restMaterials) {
      if (harvested) { const dull = material.clone(); if (dull.color) dull.color.set(DECOR_BATCH_DULL); mesh.material = dull; } else mesh.material = material;
    }
  }
  return true;
}
