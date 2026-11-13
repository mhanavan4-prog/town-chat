// An old road's stones (public/kk/home/road_setts.glb, road_kerb.glb), laid
// along its runs: kerb stones down each edge, with gaps where they have gone,
// and patches of worn flags in the way. One InstancedMesh a model, so a whole
// road is two draw calls. Used by the drove road in the Wilds
// (client/wilds-scene.js) and the track across the Ember Wastes
// (client/ember-scene.js).
//
// `runs` is [[[x, y], ...], ...]; `half` the road's half-width; `heightAt(x, y)`
// the ground there; `prep(unit)` may darken the size-1 reference before it is
// copied (the Wastes scorch theirs). Returns false until both models are in.
import { bakeGeometry } from './bake-geometry.js';

export function roadStoneSpots(runs, half, heightAt, seed) {
  let s = seed || 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const H = heightAt || (() => 0), setts = [], kerbs = [];
  for (const run of runs) for (let i = 0; i < run.length - 1; i++) {
    const [ax, ay] = run[i], [bx, by] = run[i + 1], len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len, turn = -Math.atan2(uy, ux);
    for (let d = 40; d < len; d += 105) for (const side of [-1, 1]) {
      if (rnd() < 0.38) continue;   // a kerb stone gone
      const x = ax + ux * d - uy * side * (half + 6), y = ay + uy * d + ux * side * (half + 6);
      kerbs.push({ x, y, h: H(x, y), scale: 70 + rnd() * 22, roty: turn + (rnd() - 0.5) * 0.3 + (side > 0 ? Math.PI : 0) });
    }
    for (let d = 60; d < len; d += 150) {
      if (rnd() < 0.3) continue;
      const off = (rnd() - 0.5) * half * 1.3, x = ax + ux * d - uy * off, y = ay + uy * d + ux * off;
      setts.push({ x, y, h: H(x, y) + 2, scale: 105 + rnd() * 45, roty: turn + (rnd() - 0.5) * 0.8 });
    }
  }
  return { setts, kerbs };
}

export function layRoadStones(scene, KK, runs, half, heightAt, prep, seed) {
  if (scene.userData.roadStones) return true;
  if (!(KK && KK.has && KK.staticInstance && KK.has('rd_setts') && KK.has('rd_kerb'))) return false;
  scene.userData.roadStones = true;
  const { setts, kerbs } = roadStoneSpots(runs, half, heightAt, seed);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), yUp = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  for (const [key, items] of [['rd_kerb', kerbs], ['rd_setts', setts]]) {
    const unit = KK.staticInstance(key, 1, 'fit');   // a size-1 reference, its base at y = 0
    if (!unit || !items.length) continue;
    if (prep) prep(unit);
    unit.updateMatrixWorld(true);
    unit.traverse((o) => {
      if (!o.isMesh) return;
      const geo = bakeGeometry(o.geometry, o.matrixWorld);
      const im = new THREE.InstancedMesh(geo, o.material, items.length);
      im.frustumCulled = false; im.receiveShadow = true;
      items.forEach((it, i) => { q.setFromAxisAngle(yUp, it.roty); pos.set(it.x, it.h, it.y); scl.set(it.scale, it.scale, it.scale); m4.compose(pos, q, scl); im.setMatrixAt(i, m4); });
      im.instanceMatrix.needsUpdate = true;
      scene.add(im);
    });
  }
  return true;
}
