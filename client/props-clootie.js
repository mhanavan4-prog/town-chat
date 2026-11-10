// ---------------------------------------------------------------------------
// The clootie well in the Wilds: a spring in a ring of stones, and beside it a
// thorn hung with rags ("cloots") of wool and cotton in faded colours. Same
// low-poly language as props-ogham.js. THREE is a global. (Top-level names
// carry the clootie prefix: the client bundle shares one scope.)
// ---------------------------------------------------------------------------
const CLOOTIE_RAG_COLOURS = [0xe8e2d0, 0xb33a2e, 0x3d5a8a, 0x5d7a3a, 0xd9b34a, 0x8a4a6a, 0xcfc6b0, 0x6a8a9a];

export function makeClootieWell(x, z) {
  const g = new THREE.Group();
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  // The spring, and the stones round it.
  const water = new THREE.Mesh(new THREE.CircleGeometry(22, 20), new THREE.MeshLambertMaterial({ color: 0x4d6b78, emissive: 0x16242a, emissiveIntensity: 0.4 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 1.2; g.add(water);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(6 + (k % 3), 0), lam(k % 2 ? 0x7c786e : 0x8f8b80));
    st.position.set(Math.cos(a) * 28, 3, Math.sin(a) * 28); st.rotation.set(k, k * 2, 0); g.add(st);
  }
  // The thorn, a little north of the spring: a crooked trunk and spreading arms.
  const tx = 8, tz = -58;
  const bark = lam(0x4a3a2c);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 5.5, 46, 6), bark);
  trunk.position.set(tx, 23, tz); trunk.rotation.z = 0.12; g.add(trunk);
  const arms = [[-1, 0.5, 0.2], [1, 0.4, -0.3], [0.3, 0.6, 1], [-0.4, 0.5, -1], [0.9, 0.7, 0.8]];
  const tips = [];
  arms.forEach(([ax, ay, az], k) => {
    const len = 34 + (k % 2) * 8;
    const dir = new THREE.Vector3(ax, ay, az).normalize();
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, len, 5), bark);
    const base = new THREE.Vector3(tx, 40 + k * 2, tz);
    arm.position.copy(base.clone().addScaledVector(dir, len / 2));
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.add(arm);
    tips.push([base, dir, len]);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(9, 6, 5), lam(0x3c5a30));
    leaf.position.copy(base.clone().addScaledVector(dir, len)); leaf.scale.y = 0.7; g.add(leaf);
  });
  // The cloots, hung along the arms.
  let n = 0;
  for (const [base, dir, len] of tips) {
    for (let k = 1; k <= 4; k++) {
      const p = base.clone().addScaledVector(dir, (len * k) / 5);
      const rag = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 9 + (n % 3) * 2), new THREE.MeshLambertMaterial({ color: CLOOTIE_RAG_COLOURS[n % CLOOTIE_RAG_COLOURS.length], side: THREE.DoubleSide }));
      rag.position.set(p.x, p.y - 5, p.z); rag.rotation.y = n * 0.9; rag.rotation.z = (n % 2 ? 0.1 : -0.1);
      g.add(rag); n++;
    }
  }
  g.position.set(x, 0, z);
  return g;
}
