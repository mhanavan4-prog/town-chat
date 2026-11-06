// ---------------------------------------------------------------------------
// Crotal stones — grey boulders crusted with lichen, the source of crotal
// (crottle), the Highland dye-lichen behind the red-brown of homespun and
// Harris tweed. Same low-poly language as props-ogham.js: a faceted boulder,
// a few flattened lichen rosettes in grey-green (the crotal itself) and a
// couple of orange ones (the yellow wall-lichen that shares the rock), so the
// stone reads as "something grows on this" from the path.
// ---------------------------------------------------------------------------
const STONE_MATS = new Map();
function _stLam(color) {
  let m = STONE_MATS.get(color);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, flatShading: true }); STONE_MATS.set(color, m); }
  return m;
}

const _stRay = new THREE.Raycaster();
export function makeCrotalStone(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(16 * s, 0), _stLam(0x6f6e69));
  rock.scale.set(1.25, 0.72, 1); rock.position.y = 9 * s; rock.rotation.y = 0.6; g.add(rock);
  const side = new THREE.Mesh(new THREE.DodecahedronGeometry(9 * s, 0), _stLam(0x64635e));
  side.scale.set(1, 0.7, 1.1); side.position.set(15 * s, 5 * s, 6 * s); g.add(side);
  // Lichen rosettes stuck to the real rock surface: cast a ray in from outside
  // toward the boulder's heart, sit a flat disc on the hit, facing out.
  g.updateMatrixWorld(true);
  const centre = new THREE.Vector3(0, 7 * s, 0), dir = new THREE.Vector3(), from = new THREE.Vector3();
  const spots = [ // [azimuth, elevation, radius, colour]: grey-green crotal, two orange wall-lichens
    [0.2, 1.3, 6, 0x74855c], [1.4, 0.7, 5, 0x6c7d55], [2.6, 0.9, 5.5, 0x7b8c62], [3.8, 0.6, 4.5, 0x74855c],
    [4.9, 0.9, 5, 0x6f8058], [5.8, 0.5, 4, 0x7b8c62], [0.9, 0.35, 3.4, 0xd88a24], [3.2, 0.35, 3, 0xcf7f22],
  ];
  for (const [az, el, r, c] of spots) {
    dir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    from.copy(centre).addScaledVector(dir, 60 * s);
    _stRay.set(from, dir.clone().negate());
    const hit = _stRay.intersectObjects([rock, side], false)[0];
    if (!hit) continue;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * s, r * s * 0.9, 0.7 * s, 9), _stLam(c));
    disc.position.copy(hit.point).addScaledVector(n, 0.35 * s);
    disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    g.add(disc);
  }
  g.position.set(x, 0, z);
  return g;
}

export const STONE_BUILDERS = {
  crotal_stone: { make: (d) => makeCrotalStone(d.x, d.y, d.scale), collide: () => ({ w: 34, h: 26 }) },
};
export const STONE_TYPES_CLIENT = Object.keys(STONE_BUILDERS);
