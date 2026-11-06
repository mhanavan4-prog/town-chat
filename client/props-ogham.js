// ---------------------------------------------------------------------------
// The ogham grove — procedural models for the ten trees the Tree Alphabet
// lacked: alder, ash, hawthorn, apple, ivy, elder, gorse, heather, aspen, yew.
// Same low-poly language as props-nature.js (Lambert, a handful of primitives,
// camFade on the tall ones) and each made recognisable by the one thing a
// walker would know it by: the alder's cones, the ash's keys, the hawthorn's
// red haws, the apple's fruit, ivy climbing a stump, the elder's flat flower
// heads, gorse's yellow, heather's purple, the aspen's pale trunk and the yew's
// dark spire.
// ---------------------------------------------------------------------------
const OG_MATS = new Map();
function _ogLam(color, emissive) {
  const k = color + ':' + (emissive || 0);
  let m = OG_MATS.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial(emissive ? { color, emissive, emissiveIntensity: 0.35 } : { color }); OG_MATS.set(k, m); }
  return m;
}
function _trunk(g, s, h, r0, r1, color) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(r0 * s, r1 * s, h * s, 6), _ogLam(color));
  t.position.y = (h * s) / 2; g.add(t); return t;
}
function _blob(g, s, x, y, z, r, color, sy) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(r * s, 8, 7), _ogLam(color));
  b.position.set(x * s, y * s, z * s); if (sy) b.scale.y = sy; g.add(b); return b;
}
// Scatter n small fruit/flower spheres over the OUTER surface of a canopy
// (centre height cy, radius R) — upper two-thirds only, so they read from a
// walking camera instead of sinking into the foliage.
function _dots(g, s, n, cy, R, r, color, emissive) {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, yN = 1 - t * 1.35;           // from the top down to a little below the equator
    const ring = Math.sqrt(Math.max(0, 1 - yN * yN)), a = i * 2.39996;
    const d = new THREE.Mesh(new THREE.SphereGeometry(r * s, 6, 5), _ogLam(color, emissive));
    d.position.set(Math.cos(a) * ring * R * 1.02 * s, (cy + yN * R * 0.9) * s, Math.sin(a) * ring * R * 1.02 * s); g.add(d);
  }
}
function _done(g, x, z, tall) { g.position.set(x, 0, z); if (tall) g.userData.camFade = true; return g; }

// Fearn — alder: dark fissured trunk by the water, a rounded crown, little woody cones.
export function makeAlder(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  _trunk(g, s, 54, 5, 7, 0x3a2c24);
  _blob(g, s, 0, 66, 0, 26, 0x2f5a34, 0.9); _blob(g, s, -14, 58, 6, 16, 0x356238); _blob(g, s, 14, 60, -6, 16, 0x2b5230);
  _dots(g, s, 12, 66, 24, 2.6, 0x4a3122);
  return _done(g, x, z, true);
}
// Nion — ash: tall, open, light-grey bark; feathery canopy hung with bunches of keys.
export function makeAshTree(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  _trunk(g, s, 70, 4.5, 6.5, 0x8e8a80);
  _blob(g, s, 0, 84, 0, 24, 0x6f9a4c, 0.7); _blob(g, s, -18, 76, 4, 15, 0x7aa556, 0.7); _blob(g, s, 18, 78, -4, 15, 0x65904a, 0.7);
  _dots(g, s, 14, 84, 16, 2.6, 0xc7b46a);
  return _done(g, x, z, true);
}
// Úath — hawthorn: a squat, crooked thorn with bright red haws.
export function makeHawthorn(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  const t = _trunk(g, s, 30, 3.5, 5, 0x4a3628); t.rotation.z = 0.18;
  _blob(g, s, 2, 36, 0, 18, 0x355e30); _blob(g, s, -12, 30, 6, 12, 0x2f5530); _blob(g, s, 12, 32, -4, 12, 0x3a6634);
  _dots(g, s, 18, 36, 17, 2.6, 0xd0202a, 0x601010);
  return _done(g, x, z, false);
}
// Ceirt — apple: a low round crab apple, its fruit yellow-green and blushed.
export function makeWildApple(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  _trunk(g, s, 34, 4.5, 6.5, 0x5a4030);
  _blob(g, s, 0, 46, 0, 24, 0x3f7a3a, 0.85); _blob(g, s, -16, 40, 8, 14, 0x468440);
  _dots(g, s, 12, 46, 20, 3.6, 0xc9c14a); _dots(g, s, 6, 44, 19, 3.6, 0xc2502e);
  return _done(g, x, z, false);
}
// Gort — ivy: a dead stump wrapped and buried in dark glossy ivy.
export function makeIvyBank(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  _trunk(g, s, 26, 7, 9, 0x4a3a2c);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9, y = 6 + i * 3.4;
    _blob(g, s, Math.cos(a) * 8, y, Math.sin(a) * 8, 6.5, i % 2 ? 0x1f4a2a : 0x245533);
  }
  _blob(g, s, 0, 28, 0, 10, 0x1f4a2a, 0.7);
  return _done(g, x, z, false);
}
// Ruis — elder: a many-stemmed shrubby tree with flat cream flower heads and dark berries.
export function makeElder(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  for (const [tx, tz, th, lean] of [[-5, 0, 36, -0.2], [4, 3, 40, 0.15], [1, -5, 32, 0.05]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(2.2 * s, 3 * s, th * s, 5), _ogLam(0x6b5a46));
    t.position.set(tx * s, th * s / 2, tz * s); t.rotation.z = lean; g.add(t);
  }
  _blob(g, s, 0, 42, 0, 20, 0x3e6e3a, 0.75);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05, rr = 15;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(4.5 * s, 4.5 * s, 1.4 * s, 10), _ogLam(0xf1ead2));
    head.position.set(Math.cos(a) * rr * s, (50 + (i % 2) * 3) * s, Math.sin(a) * rr * s); g.add(head);
  }
  _dots(g, s, 10, 42, 15, 2.2, 0x2a1b3a);
  return _done(g, x, z, false);
}
// Onn — gorse: a spiny low bush blazing with yellow.
export function makeGorse(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  _blob(g, s, 0, 12, 0, 15, 0x2f5a2c); _blob(g, s, -12, 10, 4, 11, 0x335f2e); _blob(g, s, 11, 11, -4, 12, 0x2c552a);
  _dots(g, s, 30, 13, 14, 2.4, 0xf2c623, 0x6a5208);
  return _done(g, x, z, false);
}
// Úr — heather: a low mat of purple.
export function makeHeather(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1, rr = 6 + (i % 3) * 5;
    _blob(g, s, Math.cos(a) * rr, 5, Math.sin(a) * rr, 9, i % 2 ? 0x7a3f86 : 0x8e4d98, 0.6);
  }
  _dots(g, s, 16, 7, 10, 1.8, 0xc58ad6, 0x40184a);
  return _done(g, x, z, false);
}
// Edad — aspen: slender pale trunk, round leaves already turning gold.
export function makeAspen(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  _trunk(g, s, 78, 3, 4.2, 0xcfd2c4);
  for (let m = 0; m < 4; m++) {
    const mk = new THREE.Mesh(new THREE.BoxGeometry(6 * s, 1.6 * s, 1 * s), _ogLam(0x3c3a36));
    mk.position.set(0, (16 + m * 15) * s, 3.6 * s); g.add(mk);
  }
  _blob(g, s, 0, 84, 0, 17, 0xd6b13a, 0.95); _blob(g, s, -9, 72, 4, 11, 0x9ab24a); _blob(g, s, 9, 74, -4, 11, 0xcfa83a);
  return _done(g, x, z, true);
}
// Idad — yew: a dark, dense, ancient spire with a few red arils.
export function makeYew(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  _trunk(g, s, 20, 9, 12, 0x5a3426);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry((30 - i * 7) * s, 34 * s, 8), _ogLam([0x14301e, 0x18361f, 0x1b3c24][i]));
    c.position.y = (34 + i * 20) * s; g.add(c);
  }
  _dots(g, s, 10, 40, 18, 2.4, 0xd0303a, 0x5a0c10);
  return _done(g, x, z, true);
}

export const OGHAM_GROVE_BUILDERS = {
  alder: { make: (d) => makeAlder(d.x, d.y, d.scale), collide: () => ({ w: 18, h: 18 }) },
  ash_tree: { make: (d) => makeAshTree(d.x, d.y, d.scale), collide: () => ({ w: 16, h: 16 }) },
  hawthorn: { make: (d) => makeHawthorn(d.x, d.y, d.scale), collide: () => null },
  wild_apple: { make: (d) => makeWildApple(d.x, d.y, d.scale), collide: () => ({ w: 16, h: 16 }) },
  ivy_bank: { make: (d) => makeIvyBank(d.x, d.y, d.scale), collide: () => ({ w: 18, h: 18 }) },
  elder: { make: (d) => makeElder(d.x, d.y, d.scale), collide: () => null },
  gorse: { make: (d) => makeGorse(d.x, d.y, d.scale), collide: () => null },
  heather: { make: (d) => makeHeather(d.x, d.y, d.scale), collide: () => null },
  aspen: { make: (d) => makeAspen(d.x, d.y, d.scale), collide: () => ({ w: 12, h: 12 }) },
  yew: { make: (d) => makeYew(d.x, d.y, d.scale), collide: () => ({ w: 22, h: 22 }) },
};
export const OGHAM_GROVE_TYPES_CLIENT = Object.keys(OGHAM_GROVE_BUILDERS);
