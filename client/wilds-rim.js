// ---------------------------------------------------------------------------
// The rim of the Wilds.
//
// The moor ended at a straight edge with nothing beyond it: walk to the border
// and you looked off the side of the world (and the far grass was drawn out
// over the drop). Now the ground does not stop there. All round the map it
// climbs into a wall of dark fell, low at first and then steeply, running off
// into the fog: the Wilds read as a wide basin among hills, and the border is
// the foot of a slope you cannot climb rather than a line in the air.
//
// It is scenery only: you still stop where you always stopped. Nothing here is
// a lore claim.
// ---------------------------------------------------------------------------

// How far out each row of the rim stands from the edge of the ground, and how high it has climbed there.
export const WR_ROWS = [[-60, -8], [140, 26], [380, 120], [760, 300], [1250, 520], [1900, 700], [2700, 780]];
const wrHash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// The edge of the ground as a closed run of points with the way out from each: the four sides, and the corners turned
// in a few steps so the fell goes round them. `pad` is how far the ground runs past the playable world.
export function rimPerimeter(width, height, pad = 100, step = 260, turn = 5) {
  const out = [], x0 = -pad, x1 = width + pad, z0 = -pad, z1 = height + pad;
  const side = (ax, az, bx, bz, nx, nz) => { const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / step)); for (let i = 0; i < n; i++) out.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n, nx, nz]); };
  const corner = (x, z, a0) => { for (let i = 0; i <= turn; i++) { const a = a0 + (Math.PI / 2) * i / turn; out.push([x, z, Math.cos(a), Math.sin(a)]); } };
  side(x0, z0, x1, z0, 0, -1); corner(x1, z0, -Math.PI / 2);      // north side, going east; then round the north-east corner
  side(x1, z0, x1, z1, 1, 0); corner(x1, z1, 0);
  side(x1, z1, x0, z1, 0, 1); corner(x0, z1, Math.PI / 2);
  side(x0, z1, x0, z0, -1, 0); corner(x0, z0, Math.PI);
  return out;
}

// Positions and indices of the rim. `heightAt(x, z)` is the ground (asked inside the world only).
export function rimGeometry(width, height, heightAt, pad = 100) {
  const per = rimPerimeter(width, height, pad), R = WR_ROWS.length, P = [], I = [];
  const clampX = (x) => Math.max(0, Math.min(width, x)), clampZ = (z) => Math.max(0, Math.min(height, z));
  for (let i = 0; i < per.length; i++) {
    const [px, pz, nx, nz] = per[i], base = heightAt(clampX(px), clampZ(pz));
    for (let r = 0; r < R; r++) {
      const [out, up] = WR_ROWS[r], x = px + nx * out, z = pz + nz * out;
      const rough = r < 2 ? 1 : 0.72 + 0.56 * wrHash(Math.round(x / 300), Math.round(z / 300) + r * 7);   // each fell its own height; the foot is smooth
      P.push(x, base + up * rough, z);
    }
  }
  for (let i = 0; i < per.length; i++) {
    const j = (i + 1) % per.length;
    for (let r = 0; r < R - 1; r++) { const a = i * R + r, b = j * R + r, c = j * R + r + 1, d = i * R + r + 1; I.push(a, d, b, b, d, c); }
  }
  return { positions: P, indices: I, rows: R, around: per.length };
}

export function buildWildsRim(THREE, scene, world, heightAt, tint) {
  const g = rimGeometry(world.width, world.height, heightAt);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.positions, 3));
  // green at the foot like the moor it rises from, going over to dark heath and then bare fell as it climbs
  { const C = [], R = g.rows; for (let v = 0; v < g.positions.length / 3; v++) { const r = v % R, t = r / (R - 1), k = 0.82 + 0.3 * wrHash(v * 3, r);
      C.push((0.24 + 0.10 * t) * k, (0.31 - 0.11 * t) * k, (0.15 + 0.03 * t) * k); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); }
  geo.setIndex(g.indices); geo.computeVertexNormals();
  if (geo.attributes.normal.getY(1) < 0) { for (let k = 0; k < g.indices.length; k += 3) { const t = g.indices[k + 1]; g.indices[k + 1] = g.indices[k + 2]; g.indices[k + 2] = t; } geo.setIndex(g.indices); geo.computeVertexNormals(); }
  const mat = new THREE.MeshLambertMaterial({ color: tint || 0xffffff, vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'wildsRim'; mesh.receiveShadow = false; mesh.castShadow = false; mesh.userData.noShadowCaster = true; mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}
