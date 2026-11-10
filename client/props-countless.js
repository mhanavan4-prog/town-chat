// ---------------------------------------------------------------------------
// The Nine-and-Twenty, a stone circle in the Wilds (data/countlessStones.js):
// standing stones, fallen ones lying in the turf, and low stumps that hide
// behind their neighbours, round a ring. Same low-poly granite as the
// Crick-stone. THREE is a global. (Top-level names carry the countless prefix:
// the client bundle shares one scope.)
// ---------------------------------------------------------------------------
const COUNTLESS_GREYS = [0x8a877c, 0x7d7a70, 0x96928a, 0x85826f];

export function makeCountlessRing(geo, walls) {
  const g = new THREE.Group();
  geo.stones.forEach(([deg, kind], k) => {
    const a = (deg * Math.PI) / 180;
    const x = geo.x + geo.radius * Math.cos(a), z = geo.y + geo.radius * Math.sin(a);
    const mat = new THREE.MeshLambertMaterial({ color: COUNTLESS_GREYS[k % COUNTLESS_GREYS.length] });
    let m;
    if (kind === 'f') { m = new THREE.Mesh(new THREE.BoxGeometry(54, 12, 18), mat); m.position.set(x, 6, z); m.rotation.y = -a + 0.3; }
    else if (kind === 'l') { m = new THREE.Mesh(new THREE.DodecahedronGeometry(8, 0), mat); m.scale.set(1.2, 0.8, 1); m.position.set(x, 5, z); }
    else { const h = 40 + ((k * 37) % 30); m = new THREE.Mesh(new THREE.BoxGeometry(18 + (k % 3) * 3, h, 13), mat); m.position.set(x, h / 2 - 2, z); m.rotation.y = -a + Math.PI / 2 + ((k % 5) - 2) * 0.08; m.rotation.z = ((k % 4) - 1.5) * 0.04; }
    g.add(m);
    if (walls && kind !== 'f') walls.push({ x: x - 9, y: z - 9, w: 18, h: 18 });
  });
  return g;
}
