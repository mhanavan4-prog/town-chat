// ---------------------------------------------------------------------------
// The Crick-stone (a Mên-an-Tol) in the Wilds: a holed stone set on its edge
// between two uprights, in a line running east and west, the hole facing
// north and south, and a fallen stone at the foot of the western upright.
// Drawn twice life size so a player fits the hole (data/menAnTol.js). The
// holed stone's two halves and the uprights collide; the hole does not.
// THREE is a global. (Top-level names carry the menAnTol prefix: one bundle.)
// ---------------------------------------------------------------------------
const MEN_AN_TOL_GRANITE = 0x8a877c;

export function makeMenAnTol(geo, walls, makeSignSprite) {
  const g = new THREE.Group();
  const granite = new THREE.MeshLambertMaterial({ color: MEN_AN_TOL_GRANITE });
  const ringR = (geo.stone + geo.hole) / 2, tube = (geo.stone - geo.hole) / 2;
  const holed = new THREE.Mesh(new THREE.TorusGeometry(ringR, tube, 10, 26), granite);
  holed.scale.z = 0.75;                      // thinner than round: a slab set on edge
  holed.position.set(geo.x, geo.hole + 4, geo.y); // sunk, so the hole's foot is near the turf
  g.add(holed);
  for (const side of [-1, 1]) {
    const up = new THREE.Mesh(new THREE.BoxGeometry(24, 88, 20), granite);
    up.position.set(geo.x + side * geo.upright, 44, geo.y); up.rotation.y = side * 0.08; g.add(up);
  }
  const fallen = new THREE.Mesh(new THREE.BoxGeometry(70, 16, 26), granite);
  fallen.position.set(geo.x - geo.upright - 10, 8, geo.y + 34); fallen.rotation.y = 0.4; g.add(fallen);
  if (makeSignSprite) { const s = makeSignSprite('🪨 The Crick-stone'); if (s) { s.position.set(geo.x, 120, geo.y); g.add(s); } }
  // Walls: either side of the hole, and the uprights.
  if (walls) {
    walls.push({ x: geo.x - geo.stone, y: geo.y - 12, w: geo.stone - geo.hole, h: 24 });
    walls.push({ x: geo.x + geo.hole, y: geo.y - 12, w: geo.stone - geo.hole, h: 24 });
    for (const side of [-1, 1]) walls.push({ x: geo.x + side * geo.upright - 12, y: geo.y - 10, w: 24, h: 20 });
  }
  return g;
}
