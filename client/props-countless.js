// ---------------------------------------------------------------------------
// The Nine-and-Twenty, a stone circle in the Wilds (data/countlessStones.js):
// standing stones, fallen ones lying in the turf, and low stumps that hide
// behind their neighbours, round a ring. THREE is a global. (Top-level names
// carry the countless prefix: the client bundle shares one scope.)
//
// With the KayKit Forest Nature stones streamed in (CC0, Kay Lousberg), each
// stone is a real weathered rock: a rounded pillar (Rock_6_D) or the slimmer
// one (Rock_6_C) standing, the pillar laid in the turf when fallen, a squat
// boulder (Rock_3_E) for a stump. Narrowed and thinned to the old footprint so
// the ring stays countable, one object per stone. Without them, the plain
// low-poly granite below is drawn instead. Collision is the same either way.
// ---------------------------------------------------------------------------
const COUNTLESS_GREYS = [0x8a877c, 0x7d7a70, 0x96928a, 0x85826f];
const COUNTLESS_STANDING_KEYS = ['stone_pillar', 'rock3'];

// One KayKit stone, or null if the models aren't here.
function countlessKK(KK, kind, k, h, x, z, a) {
  if (!(KK && KK.has && KK.staticInstance)) return null;
  if (kind === 'f') {
    if (!KK.has('stone_pillar')) return null;
    // The pillar laid along the ring, half its thickness, resting on the turf.
    const s = KK.staticInstance('stone_pillar', 54, 'height');
    if (!s) return null;
    s.scale.set(0.8, 1, 0.5);
    s.rotation.x = Math.PI / 2;
    s.position.z = -27;
    const g = new THREE.Group();
    g.add(s);
    g.rotation.y = -a + 0.3;
    g.position.set(x, 5, z);
    return g;
  }
  if (kind === 'l') {
    if (!KK.has('stone_low')) return null;
    const s = KK.staticInstance('stone_low', 18, 'fit');
    if (!s) return null;
    s.scale.y = 0.7;
    s.rotation.y = k * 1.7;
    s.position.set(x, 0, z);
    return s;
  }
  const key = COUNTLESS_STANDING_KEYS[k % 3 === 2 ? 1 : 0];
  if (!KK.has(key)) return null;
  const s = KK.staticInstance(key, h, 'height');
  if (!s) return null;
  // Narrower across and thinner through than the rock as authored, so a
  // stone stays a stone and its neighbours stay apart.
  s.scale.set(key === 'rock3' ? 0.75 : 0.6, 1, 0.45);
  s.rotation.y = -a + Math.PI / 2 + ((k % 5) - 2) * 0.08;
  s.rotation.z = ((k % 4) - 1.5) * 0.04;
  s.position.set(x, -2, z);
  return s;
}

export function makeCountlessRing(geo, walls, KK) {
  const g = new THREE.Group();
  geo.stones.forEach(([deg, kind], k) => {
    const a = (deg * Math.PI) / 180;
    const x = geo.x + geo.radius * Math.cos(a), z = geo.y + geo.radius * Math.sin(a);
    const h = 40 + ((k * 37) % 30);
    let m = countlessKK(KK, kind, k, h, x, z, a);
    if (!m) {
      const mat = new THREE.MeshLambertMaterial({ color: COUNTLESS_GREYS[k % COUNTLESS_GREYS.length] });
      if (kind === 'f') { m = new THREE.Mesh(new THREE.BoxGeometry(54, 12, 18), mat); m.position.set(x, 6, z); m.rotation.y = -a + 0.3; }
      else if (kind === 'l') { m = new THREE.Mesh(new THREE.DodecahedronGeometry(8, 0), mat); m.scale.set(1.2, 0.8, 1); m.position.set(x, 5, z); }
      else { m = new THREE.Mesh(new THREE.BoxGeometry(18 + (k % 3) * 3, h, 13), mat); m.position.set(x, h / 2 - 2, z); m.rotation.y = -a + Math.PI / 2 + ((k % 5) - 2) * 0.08; m.rotation.z = ((k % 4) - 1.5) * 0.04; }
    }
    m.userData.countlessStone = kind;
    g.add(m);
    if (walls && kind !== 'f') walls.push({ x: x - 9, y: z - 9, w: 18, h: 18 });
  });
  return g;
}
