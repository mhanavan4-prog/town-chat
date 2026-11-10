// ---------------------------------------------------------------------------
// The Shepherd's Race in the Wilds: the turf maze's walls drawn as grooves cut
// in the turf (one merged mesh of flat ribbons along the server's wall lines,
// data/troyTown.js), the four dots as small sods, and two marker stones either
// side of the gate. Nothing here collides: a turf maze stops no one, and the
// server, not a wall, knows when you have stepped over a bank. THREE is a
// global. (Top-level names carry the troyTown prefix: the bundle is one scope.)
// ---------------------------------------------------------------------------
const TROY_TOWN_GROOVE = 0x4a3826;
const TROY_TOWN_STONE = 0x8d8a80;

function troyTownRibbons(lines, width, y) {
  const pos = [], idx = [];
  for (const line of lines) {
    for (let s = 1; s < line.length; s++) {
      const [x0, z0] = line[s - 1], [x1, z1] = line[s];
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1;
      const nx = (-dz / L) * width / 2, nz = (dx / L) * width / 2;
      // a little past each end, so the joints close
      const ex = (dx / L) * width / 2, ez = (dz / L) * width / 2;
      const b = pos.length / 3;
      pos.push(x0 - ex + nx, y, z0 - ez + nz, x0 - ex - nx, y, z0 - ez - nz, x1 + ex + nx, y, z1 + ez + nz, x1 + ex - nx, y, z1 + ez - nz);
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function makeTroyTown(geo, makeSignSprite) {
  const group = new THREE.Group();
  const groove = new THREE.Mesh(
    troyTownRibbons(geo.walls, Math.max(6, geo.unit * 0.2), 0.8),
    new THREE.MeshLambertMaterial({ color: TROY_TOWN_GROOVE, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  groove.userData.noShadow = true;
  group.add(groove);
  // The four dots of the seed, as small sods.
  for (const [x, z] of geo.dots) {
    const sod = new THREE.Mesh(new THREE.CylinderGeometry(geo.unit * 0.14, geo.unit * 0.16, 2, 10), new THREE.MeshLambertMaterial({ color: TROY_TOWN_GROOVE }));
    sod.position.set(x, 1, z); group.add(sod);
  }
  // Two marker stones either side of the gate, and its name over them.
  const [gx, gz] = geo.gate, [hx, hz] = geo.hub;
  const ux = (gx - hx), uz = (gz - hz), L = Math.hypot(ux, uz) || 1;
  const sx = -uz / L, sz = ux / L; // across the gate
  for (const side of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(9, 0), new THREE.MeshLambertMaterial({ color: TROY_TOWN_STONE }));
    st.scale.set(1, 1.6, 1);
    st.position.set(gx + (ux / L) * 26 + sx * side * geo.unit * 0.75, 12, gz + (uz / L) * 26 + sz * side * geo.unit * 0.75);
    group.add(st);
  }
  if (makeSignSprite) {
    const sign = makeSignSprite("🌀 The Shepherd's Race");
    if (sign) { sign.position.set(gx + (ux / L) * 30, 70, gz + (uz / L) * 30); group.add(sign); }
  }
  return group;
}
