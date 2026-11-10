// ---------------------------------------------------------------------------
// The Crick-stone (a Mên-an-Tol) in the Wilds: a holed stone set on its edge
// between two uprights, in a line running east and west, the hole facing
// north and south, and a fallen stone at the foot of the western upright.
// Drawn twice life size so a player fits the hole (data/menAnTol.js). The
// holed stone's two halves and the uprights collide; the hole does not.
// THREE is a global. (Top-level names carry the menAnTol prefix: one bundle.)
//
// With the KayKit Forest Nature stones streamed in (CC0, Kay Lousberg), the
// two uprights and the fallen stone are the same rounded pillar (Rock_6_D) as
// the Nine-and-Twenty, so the two places read as one moor; the holed stone is
// still drawn here (KayKit has no holed stone), in a grey to match. Without
// them, plain boxes. Collision is the same either way.
// ---------------------------------------------------------------------------
const MEN_AN_TOL_GRANITE = 0x8a877c;
const MEN_AN_TOL_KK_GREY = 0x7f8a90; // the KayKit rocks' grey, for the holed stone beside them

// A KayKit pillar, h tall, thinned to w across and d through; null without it.
function menAnTolPillar(KK, h, w, d) {
  if (!(KK && KK.has && KK.has('stone_pillar') && KK.staticInstance)) return null;
  const s = KK.staticInstance('stone_pillar', h, 'height');
  if (!s) return null;
  s.scale.set(w, 1, d);
  return s;
}

export function makeMenAnTol(geo, walls, makeSignSprite, KK) {
  const g = new THREE.Group();
  const kk = !!(KK && KK.has && KK.has('stone_pillar'));
  const granite = new THREE.MeshLambertMaterial({ color: kk ? MEN_AN_TOL_KK_GREY : MEN_AN_TOL_GRANITE });
  const ringR = (geo.stone + geo.hole) / 2, tube = (geo.stone - geo.hole) / 2;
  // Beside the KayKit rocks, a rough-hewn ring: fewer facets, each vertex
  // nudged a little (the same every time), so it reads as weathered granite.
  const torus = new THREE.TorusGeometry(ringR, tube, kk ? 7 : 10, kk ? 16 : 26);
  if (kk && torus.attributes && torus.attributes.position) {
    const pos = torus.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      // Keyed on where the vertex is, not its index, so the seam's twin vertices move together.
      const n = Math.sin(Math.round(pos.getX(i)) * 12.9898 + Math.round(pos.getY(i)) * 78.233 + Math.round(pos.getZ(i)) * 37.719) * 43758.5453;
      const j = (n - Math.floor(n) - 0.5) * tube * 0.22;
      pos.setXYZ(i, pos.getX(i) + j, pos.getY(i) + j * 0.7, pos.getZ(i) - j * 0.5);
    }
    torus.computeVertexNormals();
  }
  const holed = new THREE.Mesh(torus, kk ? new THREE.MeshLambertMaterial({ color: MEN_AN_TOL_KK_GREY, flatShading: true }) : granite);
  holed.scale.z = 0.75;                      // thinner than round: a slab set on edge
  holed.position.set(geo.x, geo.hole + 4, geo.y); // sunk, so the hole's foot is near the turf
  g.add(holed);
  for (const side of [-1, 1]) {
    const up = menAnTolPillar(KK, 88, 0.5, 0.42) || new THREE.Mesh(new THREE.BoxGeometry(24, 88, 20), granite);
    if (up.isMesh) up.position.set(geo.x + side * geo.upright, 44, geo.y); else up.position.set(geo.x + side * geo.upright, -2, geo.y);
    up.rotation.y = side * 0.08; g.add(up);
  }
  // The fallen stone at the foot of the western upright: the pillar laid down.
  const laid = menAnTolPillar(KK, 70, 0.8, 0.5);
  if (laid) {
    laid.rotation.x = Math.PI / 2; laid.position.z = -35;
    const fallen = new THREE.Group(); fallen.add(laid);
    fallen.position.set(geo.x - geo.upright - 10, 6, geo.y + 34); fallen.rotation.y = 0.4 + Math.PI / 2; g.add(fallen);
  } else {
    const fallen = new THREE.Mesh(new THREE.BoxGeometry(70, 16, 26), granite);
    fallen.position.set(geo.x - geo.upright - 10, 8, geo.y + 34); fallen.rotation.y = 0.4; g.add(fallen);
  }
  if (makeSignSprite) { const s = makeSignSprite('🪨 The Crick-stone'); if (s) { s.position.set(geo.x, 120, geo.y); g.add(s); } }
  // Walls: either side of the hole, and the uprights.
  if (walls) {
    walls.push({ x: geo.x - geo.stone, y: geo.y - 12, w: geo.stone - geo.hole, h: 24 });
    walls.push({ x: geo.x + geo.hole, y: geo.y - 12, w: geo.stone - geo.hole, h: 24 });
    for (const side of [-1, 1]) walls.push({ x: geo.x + side * geo.upright - 12, y: geo.y - 10, w: 24, h: 20 });
  }
  return g;
}
