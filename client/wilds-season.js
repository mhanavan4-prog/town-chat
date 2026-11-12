// ---------------------------------------------------------------------------
// The Wilds wear the season. The cottage already turns with the Wheel of the
// Year (client/sabbat-dressing.js); this is the land's own dress: the colour
// of the ground, the colour of the leaf, and what is in the air. Cosmetic and
// automatic; it follows the live sabbat (calendarState.season.key).
//
//   ground  — multiplies the forest floor (white leaves it as it is)
//   frost   — a pale wash added over the ground, for hoar-frost and snow
//   leaf    — the colour the foliage leans toward, and how far (0..1)
//   leafGlow — a faint wash added over the foliage (rime in winter, the turn in autumn)
//   air     — what falls: 'snow' | 'leaves' | 'petals' | 'motes' | null
//   airCol  — its colour;  airN — how many, at full quality
//   note    — the line said on walking out into the Wilds
// ---------------------------------------------------------------------------
export const WILDS_SEASON = {
  imbolc:     { ground: 0xdde4dc, frost: 0x222a2e, leaf: [0xa8b8a0, 0.45], leafGlow: 0x1c2428, air: 'snow',   airCol: 0xf2f6ff, airN: 70,  note: 'Hoar-frost on the grass, and the first green under it.' },
  ostara:     { ground: 0xe4ffd0, frost: 0x0a1c06, leaf: [0xa8f078, 0.3],  leafGlow: 0x061204, air: 'petals', airCol: 0xf8d4e8, airN: 110, note: 'Blackthorn blossom is coming down on the wind.' },
  beltane:    { ground: 0xf0ffe0, frost: 0x081404, leaf: [0x98e868, 0.2],  leafGlow: 0x040c02, air: 'petals', airCol: 0xffffff, airN: 70,  note: 'The may is out, white on every hedge.' },
  litha:      { ground: 0xffffff, frost: 0x000000, leaf: [0xffffff, 0],    leafGlow: 0x000000, air: 'motes',  airCol: 0xffe9a0, airN: 60,  note: 'High summer. The air is full of seed and small wings.' },
  lughnasadh: { ground: 0xf4e4a8, frost: 0x2a2408, leaf: [0xe0d060, 0.5],  leafGlow: 0x181400, air: 'motes',  airCol: 0xf0d070, airN: 80,  note: 'The grass has gone to gold, and chaff rides the wind.' },
  mabon:      { ground: 0xf0c890, frost: 0x301a06, leaf: [0xffa040, 0.9],  leafGlow: 0x4a1a00, air: 'leaves', airCol: 0xe08a30, airN: 130, note: 'The leaf has turned, and is coming down.' },
  samhain:    { ground: 0xc4a880, frost: 0x1c1408, leaf: [0xb07840, 0.9],  leafGlow: 0x2a1400, air: 'leaves', airCol: 0x9a6c38, airN: 60,  note: 'The year is dying back. The last leaves are brown on the branch.' },
  yule:       { ground: 0xe6ecf4, frost: 0x4a5560, leaf: [0xc0d0d8, 0.6],  leafGlow: 0x4a5458, air: 'snow',   airCol: 0xffffff, airN: 200, note: 'Snow lies over the Wilds, and more is falling.' },
};
export function wildsSeasonFor(key) { return (key && WILDS_SEASON[key]) || null; }

// What counts as leaf: the tintable part of the kit's plants and trees, by the
// name its material was given when the model was made.
// 'forest' is the atlas the kit's trees and bushes share (trunks too, which take
// the season kindly enough); 'Plant' is the hand-made flora, and some standing
// stone with it, so it is dyed at half strength.
const LEAFY = /^(Plant|forest|Leaf|Leaves|Foliage|Canopy)/i;

export default function createWildsSeason({ THREE, getWildsScene, getActiveScene, getCamera, getSeasonKey, getQuality }) {
  let worn; // the season the scene is wearing now (undefined = never dressed)
  let air = null; // { points, vel, sway, kind }
  let again = 0;
  let dyed = false; // whether the shared leaf materials are wearing the season just now
  const BOX = { w: 900, h: 420, d: 900 };
  // small: a point close to the eye is drawn large, and a leaf the size of a plate is not a leaf
  const NEAR = 110;
  const FLAKE_SIZE = { motes: 3, snow: 5, petals: 5, leaves: 6 };
  // One soft round flake for whatever is in the air, made from numbers, not
  // drawn on a canvas: Safari salts canvas pixels with noise (a privacy
  // measure), which turned every flake into a speckled biscuit.
  let flake = null;
  function flakeTexture() {
    if (flake) return flake;
    const N = 32, px = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = Math.hypot(x - (N - 1) / 2, y - (N - 1) / 2) / (N / 2);
      const a = r >= 1 ? 0 : r < 0.45 ? 1 : 1 - (r - 0.45) / 0.55;
      const i = (y * N + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = 255; px[i + 3] = Math.round(a * a * 255);
    }
    flake = new THREE.DataTexture(px, N, N, THREE.RGBAFormat);
    flake.magFilter = flake.minFilter = THREE.LinearFilter;
    flake.needsUpdate = true;
    return flake;
  }
  // d dyes the leaves (null puts them back); the ground takes g, which defaults to d.
  function dressLand(scene, d, g = d) {
    const seen = new Set();
    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      if (o.name === 'wildsGround') {
        const m = o.material;
        if (m.userData.seasonBase === undefined) m.userData.seasonBase = m.color.getHex();
        m.color.setHex(m.userData.seasonBase);
        if (g) m.color.multiply(new THREE.Color(g.ground));
        if (m.emissive) m.emissive.setHex(g ? g.frost : 0x000000);
        return;
      }
      // The kit's materials are shared with the town, the cottage and the caves,
      // so they are dyed only while the Wilds are what is on the screen, and put
      // back the moment they are not (update() below).
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (!m || seen.has(m) || !m.color || !LEAFY.test(m.name || '')) continue;
        seen.add(m);
        if (m.userData.seasonBase === undefined) { m.userData.seasonBase = m.color.getHex(); m.userData.seasonGlowBase = m.emissive ? m.emissive.getHex() : 0; }
        m.color.setHex(m.userData.seasonBase);
        const half = /^Plant/i.test(m.name || '') ? 0.5 : 1;
        if (d && d.leaf[1] > 0) m.color.lerp(new THREE.Color(d.leaf[0]), d.leaf[1] * half);
        // a wash only where the model had no glow of its own to keep
        if (m.emissive && !m.userData.seasonGlowBase) m.emissive.setHex(d ? new THREE.Color(d.leafGlow).multiplyScalar(half).getHex() : 0x000000);
      }
    });
    return seen.size;
  }
  function clearAir(scene) {
    if (!air) return;
    if (air.points.parent) air.points.parent.remove(air.points);
    air.points.geometry.dispose(); air.points.material.dispose();
    air = null;
    void scene;
  }
  function dressAir(scene, d) {
    clearAir(scene);
    if (!d || !d.air) return;
    const q = getQuality ? getQuality() : 'high';
    const n = Math.max(12, Math.round(d.airN * (q === 'low' ? 0.4 : q === 'medium' ? 0.7 : 1)));
    const arr = new Float32Array(n * 3), vel = new Float32Array(n), sway = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * BOX.w; arr[i * 3 + 1] = Math.random() * BOX.h; arr[i * 3 + 2] = (Math.random() - 0.5) * BOX.d;
      vel[i] = d.air === 'snow' ? 26 + Math.random() * 22 : d.air === 'motes' ? 4 + Math.random() * 8 : 34 + Math.random() * 30;
      sway[i] = Math.random() * 6.28;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({ color: d.airCol, map: flakeTexture(), size: FLAKE_SIZE[d.air] || 5, transparent: true, opacity: d.air === 'motes' ? 0.7 : 0.9, depthWrite: false, fog: true });
    const points = new THREE.Points(geo, mat);
    points.name = 'wildsSeasonAir'; points.frustumCulled = false;
    scene.add(points);
    air = { points, vel, sway, kind: d.air };
  }

  // Put the season on (or take it off, with no key). The ground and the air are
  // the Wilds' own and keep it; the leaves wear it only while the Wilds are shown.
  function apply(force) {
    const scene = getWildsScene();
    if (!scene) return 0;
    const key = getSeasonKey() || null;
    if (!force && key === worn) return 0;
    worn = key;
    const d = wildsSeasonFor(key), shown = getActiveScene() === scene;
    const n = dressLand(scene, shown ? d : null, d);
    dyed = shown && !!d;
    dressAir(scene, d);
    return n;
  }
  // The scene was rebuilt (new models streamed in, a quality change): dress it again.
  function redress() { worn = undefined; return apply(true); }

  // Every frame: the air drifts down round whoever is looking, and comes round again.
  function update(dt) {
    const scene = getWildsScene();
    if (!scene) return;
    if ((getSeasonKey() || null) !== worn) apply();
    const d = wildsSeasonFor(worn), shown = getActiveScene() === scene;
    // leaving the Wilds: the shared leaves go back to what they were, at once
    if (!shown) { if (dyed) { dressLand(scene, null, d); dyed = false; } return; }
    // models go on streaming in after the scene is built: go over the leaves again now and then
    again += dt;
    if (!dyed || again > 4) { again = 0; dressLand(scene, d); dyed = !!d; }
    if (!air) return;
    const cam = getCamera();
    if (!cam) return;
    air.points.position.set(cam.position.x, Math.max(0, cam.position.y - 160), cam.position.z);
    const a = air.points.geometry.attributes.position.array, t = performance.now() * 0.001;
    const drift = air.kind === 'snow' ? 9 : air.kind === 'motes' ? 5 : 22;
    for (let i = 0; i < air.vel.length; i++) {
      a[i * 3 + 1] -= air.vel[i] * dt;
      a[i * 3] += Math.sin(t * 0.9 + air.sway[i]) * drift * dt;
      a[i * 3 + 2] += Math.cos(t * 0.7 + air.sway[i]) * drift * dt * 0.6;
      if (a[i * 3 + 1] < 0) { a[i * 3 + 1] = BOX.h; a[i * 3] = (Math.random() - 0.5) * BOX.w; a[i * 3 + 2] = (Math.random() - 0.5) * BOX.d; }
      // none drifting right past the eye: one that comes within arm's reach of the watcher is set further off
      if (Math.abs(a[i * 3]) < NEAR && Math.abs(a[i * 3 + 2]) < NEAR) { a[i * 3] = (a[i * 3] < 0 ? -1 : 1) * (NEAR + Math.random() * 120); }
    }
    air.points.geometry.attributes.position.needsUpdate = true;
  }
  return { apply, redress, update, worn: () => worn, air: () => air };
}
