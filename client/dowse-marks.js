// ---------------------------------------------------------------------------
// Where you dug for Tobias Hext's well (lib/callers.js, the 'dowse' step):
// a patch of turned earth at each hole, and a bucket of the water you struck
// beside it, in the Wilds. The KayKit Farmers dirt plot and the Medieval
// water bucket (CC0, Kay Lousberg); plain shapes if they haven't loaded.
// Yours only, and kept for the session once dug, so the two holes (the one
// where the twig dipped and the test hole well away) stay to be looked at.
// THREE is a global. (Top-level names carry the dowseMarks prefix.)
// ---------------------------------------------------------------------------
export default function createDowseMarks({ KK, getWildsScene, heightAt }) {
  const dowseMarksSeen = new Map(); // "x,y" -> { x, y, dipped, feet, group }
  function build(m) {
    const g = new THREE.Group();
    const kk = KK && KK.has && KK.staticInstance;
    const plot = kk && KK.has('dig_plot') ? KK.staticInstance('dig_plot', 38, 'fit') : null;
    if (plot) g.add(plot);
    else {
      const earth = new THREE.Mesh(new THREE.CylinderGeometry(17, 19, 3, 10), new THREE.MeshLambertMaterial({ color: 0x5a3f2a }));
      earth.position.y = 1.5; g.add(earth);
    }
    const bucket = kk && KK.has('dig_bucket') ? KK.staticInstance('dig_bucket', 13, 'height') : null;
    if (bucket) { bucket.position.set(24, 0, 10); g.add(bucket); }
    else {
      const pail = new THREE.Mesh(new THREE.CylinderGeometry(5, 4, 9, 10), new THREE.MeshLambertMaterial({ color: 0x7a5434 }));
      pail.position.set(24, 4.5, 10); g.add(pail);
      const water = new THREE.Mesh(new THREE.CircleGeometry(4.6, 10), new THREE.MeshLambertMaterial({ color: 0x4d6b78 }));
      water.rotation.x = -Math.PI / 2; water.position.set(24, 8.6, 10); g.add(water);
    }
    g.position.set(m.x, heightAt ? heightAt(m.x, m.y) : 0, m.y);
    g.rotation.y = ((m.x * 7 + m.y * 13) % 628) / 100;
    g.userData.dowseMark = m.dipped ? 'dipped' : 'test';
    return g;
  }
  // Read the digs out of a callers_state message and draw any new ones.
  function update(state) {
    const steps = (state && state.active && state.active.steps) || [];
    for (const s of steps) {
      for (const d of (s.dowse && s.dowse.dug) || []) {
        if (typeof d.x !== 'number' || typeof d.y !== 'number') continue;
        const key = d.x + ',' + d.y;
        if (!dowseMarksSeen.has(key)) dowseMarksSeen.set(key, { x: d.x, y: d.y, dipped: !!d.dipped, feet: d.feet, group: null });
      }
    }
    place();
  }
  // Put every mark in the Wilds scene (it is built lazily, and may be rebuilt).
  function place() {
    const scene = getWildsScene && getWildsScene();
    if (!scene) return;
    for (const m of dowseMarksSeen.values()) {
      if (!m.group) m.group = build(m);
      if (m.group.parent !== scene) scene.add(m.group);
    }
  }
  return { update, place, marks: () => [...dowseMarksSeen.values()].map(({ x, y, dipped, feet }) => ({ x, y, dipped, feet })) };
}
