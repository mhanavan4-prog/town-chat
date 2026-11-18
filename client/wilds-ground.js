// ---------------------------------------------------------------------------
// The Wilds' ground, drawn as country and not as one tiled picture.
//
// What was there: a single 512px painting of forest floor repeated every 170
// units, shaded by height. From any distance the repeat showed as rows of the
// same dark blotches.
//
// What this does, on the same mesh and the same heightfield:
//   - four kinds of ground, mixed by where you are: grass (with dry, bleached
//     sweeps), heather, bare earth (in the hollows, in patches, and wherever
//     feet go), and rock where it is steep;
//   - nothing repeats that the eye can find: every kind is coloured from a
//     noise read at four scales in world space;
//   - trodden ways: the drove road's bed, worn tracks between the places people
//     go, and beaten earth round the village, the camps and the fires;
//   - grass that stands up: tufts of blades as far as you can see, the colour of the ground
//     they grow from, moving in the wind and parting where you walk. None on
//     the tracks, few on the heather, thin where the earth shows.
//
// The season still dyes it (client/wilds-season.js multiplies the material's
// colour, as before) and the lights, fog and shadows are the scene's own: this
// only replaces where the ground's colour comes from.
//
// Everything is made from numbers, not drawn on a canvas: Safari salts canvas
// pixels with noise. The same numbers are read in the shader and here, so the
// tufts know what they stand on.
//
// Quality: 'low' keeps the old ground untouched. 'medium' has the new ground
// and thin grass; 'high' the full grass. The grass is laid in three rings, out
// to where the fog takes the ground: see WILDS_GRASS.
// ---------------------------------------------------------------------------

import { weatherRock } from './rock-weather.js';

const WG_N = 256;   // the noise is N x N, four channels, and wraps

function wgMulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Four channels of wrapping value noise, each two octaves, each at its own grain.
export function makeGroundNoise(THREE) {
  const data = new Float32Array(WG_N * WG_N * 4);
  const sm = (t) => t * t * (3 - 2 * t);
  [[4, 9], [6, 14], [8, 20], [11, 27]].forEach(([p1, p2], c) => {
    const lay = (P, seed) => { const r = wgMulberry(seed), g = new Float32Array(P * P); for (let i = 0; i < g.length; i++) g[i] = r(); return g; };
    const a = lay(p1, 101 + c * 17), b = lay(p2, 977 + c * 31);
    const at = (g, P, u, v) => {
      const x = u * P, y = v * P, xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
      const x0 = xi % P, x1 = (xi + 1) % P, y0 = yi % P, y1 = (yi + 1) % P;
      return (g[y0 * P + x0] * (1 - fx) + g[y0 * P + x1] * fx) * (1 - fy) + (g[y1 * P + x0] * (1 - fx) + g[y1 * P + x1] * fx) * fy;
    };
    let lo = 1, hi = 0;
    for (let y = 0; y < WG_N; y++) for (let x = 0; x < WG_N; x++) { const v = at(a, p1, x / WG_N, y / WG_N) * 0.62 + at(b, p2, x / WG_N, y / WG_N) * 0.38; data[(y * WG_N + x) * 4 + c] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
    for (let i = c; i < data.length; i += 4) data[i] = (data[i] - lo) / (hi - lo);   // stretched to the whole of 0..1
  });
  const px = new Uint8Array(WG_N * WG_N * 4);
  for (let i = 0; i < px.length; i++) px[i] = Math.round(data[i] * 255);
  let tex = null;
  if (THREE) {
    tex = new THREE.DataTexture(px, WG_N, WG_N, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
  }
  // the same read the shader makes: channel c at (u, v), wrapped, between the four nearest
  const sample = (u, v, c) => {
    const x = (u - Math.floor(u)) * WG_N - 0.5, y = (v - Math.floor(v)) * WG_N - 0.5;
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const x0 = (xi + WG_N) % WG_N, x1 = (xi + 1 + WG_N) % WG_N, y0 = (yi + WG_N) % WG_N, y1 = (yi + 1 + WG_N) % WG_N;
    return ((px[(y0 * WG_N + x0) * 4 + c] * (1 - fx) + px[(y0 * WG_N + x1) * 4 + c] * fx) * (1 - fy) + (px[(y1 * WG_N + x0) * 4 + c] * (1 - fx) + px[(y1 * WG_N + x1) * 4 + c] * fx) * fy) / 255;
  };
  return { tex, sample, px };
}

// A track between two places does not run ruled: it wanders a little, the same way every time.
export function wander(pts, step = 240, sway = 46) {
  const out = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[k + 1], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / step));
    const nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
    for (let i = 0; i < n; i++) {
      const t = i / n, off = i === 0 ? 0 : Math.sin((ax + ay) * 0.013 + i * 2.1) * sway * Math.sin(Math.PI * t);
      out.push([ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// Where feet go: 0 untrodden, 1 beaten bare. `ways` are [{ pts, half, w }], `places` [{ x, y, r, w }].
const WG_M = 512;
export function makeGroundMask(THREE, world, ways, places) {
  const W = world.width, H = world.height, v = new Float32Array(WG_M * WG_M), sx = W / WG_M, sy = H / WG_M;
  for (const { pts, half, w } of ways) {
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1], reach = half * 1.9;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach) / sx)), i1 = Math.min(WG_M - 1, Math.ceil((Math.max(ax, bx) + reach) / sx));
      const j0 = Math.max(0, Math.floor((Math.min(ay, by) - reach) / sy)), j1 = Math.min(WG_M - 1, Math.ceil((Math.max(ay, by) + reach) / sy));
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5) * sx, y = (j + 0.5) * sy, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
        const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
        const s = d <= half ? 1 : d >= reach ? 0 : 1 - (d - half) / (reach - half);
        if (s * w > v[j * WG_M + i]) v[j * WG_M + i] = s * s * (3 - 2 * s) * w;
      }
    }
  }
  for (const { x: px, y: py, r, w } of places) {
    const i0 = Math.max(0, Math.floor((px - r) / sx)), i1 = Math.min(WG_M - 1, Math.ceil((px + r) / sx)), j0 = Math.max(0, Math.floor((py - r) / sy)), j1 = Math.min(WG_M - 1, Math.ceil((py + r) / sy));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = Math.hypot((i + 0.5) * sx - px, (j + 0.5) * sy - py) / r; if (d >= 1) continue;
      const s = d < 0.55 ? 1 : 1 - (d - 0.55) / 0.45, val = s * s * (3 - 2 * s) * w;
      if (val > v[j * WG_M + i]) v[j * WG_M + i] = val;
    }
  }
  const px = new Uint8Array(WG_M * WG_M * 4);
  for (let i = 0; i < WG_M * WG_M; i++) { px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = Math.round(v[i] * 255); px[i * 4 + 3] = 255; }
  let tex = null;
  if (THREE) { tex = new THREE.DataTexture(px, WG_M, WG_M, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true; }
  const at = (x, y) => {
    const fx = Math.max(0, Math.min(WG_M - 1.001, x / sx - 0.5)), fy = Math.max(0, Math.min(WG_M - 1.001, y / sy - 0.5)), xi = Math.floor(fx), yi = Math.floor(fy), tx = fx - xi, ty = fy - yi;
    return (v[yi * WG_M + xi] * (1 - tx) + v[yi * WG_M + xi + 1] * tx) * (1 - ty) + (v[(yi + 1) * WG_M + xi] * (1 - tx) + v[(yi + 1) * WG_M + xi + 1] * tx) * ty;
  };
  return { tex, at };
}

// The scales the noise is read at (world units to one repeat), and the colours. Shared by the shader and by mixAt.
const WG_S = { macro: 1870, meso: 410, detail: 83, fine: 19 };
const WG_C = {
  gDark: [0.105, 0.200, 0.075], gMid: [0.215, 0.340, 0.105], gLite: [0.400, 0.470, 0.170], gDry: [0.455, 0.410, 0.185],
  heathA: [0.135, 0.185, 0.120], heathB: [0.290, 0.205, 0.270],
  earthA: [0.165, 0.115, 0.075], earthB: [0.380, 0.275, 0.175], pebble: [0.500, 0.480, 0.450],
  rockA: [0.255, 0.255, 0.265], rockB: [0.500, 0.490, 0.460], lichen: [0.385, 0.420, 0.270],
};
const wgSS = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wgV3 = (a) => `vec3(${a.map((n) => n.toFixed(3)).join(', ')})`;

// What the ground is at (x, z): how much earth and heather, and the colour of its grass. `h` is 0 in the
// deepest hollow, 1 on the highest rise. The shader works the same sums per pixel.
export function mixAt(noise, mask, x, z, h, slope) {
  const n = noise.sample;
  const A = (c) => n(x / WG_S.macro, z / WG_S.macro, c), B = (c) => n(x / WG_S.meso + 0.37, z / WG_S.meso + 0.37, c), Cn = (c) => n(x / WG_S.detail + 0.11, z / WG_S.detail + 0.11, c), D = (c) => n(x / WG_S.fine + 0.71, z / WG_S.fine + 0.71, c);
  const macro = A(0) * 0.6 + B(1) * 0.4;
  const gv = Cn(0) * 0.55 + D(1) * 0.45;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  let g = lerp(WG_C.gDark, WG_C.gMid, wgSS(0.2, 0.7, gv));
  g = lerp(g, WG_C.gLite, wgSS(0.55, 0.9, D(2)) * 0.5);
  g = lerp(g, WG_C.gDry, wgSS(0.52, 0.8, macro) * 0.55);
  const k = 0.8 + 0.4 * B(2); g = [g[0] * k, g[1] * k, g[2] * k];
  const heath = wgSS(0.58, 0.72, A(1) * 0.5 + B(3) * 0.5) * 0.8;
  const trod = mask.at(x + (Cn(0) - 0.5) * 46, z + (Cn(1) - 0.5) * 46);
  const earth = Math.min(1, wgSS(0.22, 0.6, trod) + wgSS(0.80, 0.97, (1 - h) + (B(0) - 0.5) * 0.3) * 0.8 + wgSS(0.76, 0.9, B(1) * 0.6 + Cn(3) * 0.4) * 0.6);
  // rock where it is steep, as the shader has it (`slope` is 1 - the ground's normal.y; left out, no rock)
  const rock = slope === undefined ? 0 : wgSS(0.036, 0.062, slope + (Cn(0) - 0.5) * 0.022) * (1 - wgSS(0.5, 0.9, trod));
  return { earth, heath, grass: g, trod, rock };
}

const WG_FRAG = `
uniform sampler2D uGN; uniform sampler2D uGM; uniform vec2 uGWorld;
varying vec3 vGP; varying float vGS; varying float vGH;
vec3 wildsGround() {
  vec2 p = vGP.xz;
  vec4 nA = texture2D(uGN, p / ${WG_S.macro.toFixed(1)});
  vec4 nB = texture2D(uGN, p / ${WG_S.meso.toFixed(1)} + 0.37);
  vec4 nC = texture2D(uGN, p / ${WG_S.detail.toFixed(1)} + 0.11);
  vec4 nD = texture2D(uGN, p / ${WG_S.fine.toFixed(1)} + 0.71);
  float macro = nA.r * 0.6 + nB.g * 0.4;
  float gv = nC.r * 0.55 + nD.g * 0.45;
  vec3 grass = mix(${wgV3(WG_C.gDark)}, ${wgV3(WG_C.gMid)}, smoothstep(0.2, 0.7, gv));
  grass = mix(grass, ${wgV3(WG_C.gLite)}, smoothstep(0.55, 0.9, nD.b) * 0.5);
  grass = mix(grass, ${wgV3(WG_C.gDry)}, smoothstep(0.52, 0.8, macro) * 0.55);
  grass *= 0.8 + 0.4 * nB.b;
  vec3 heath = mix(${wgV3(WG_C.heathA)}, ${wgV3(WG_C.heathB)}, nC.b);
  float wHeath = smoothstep(0.58, 0.72, nA.g * 0.5 + nB.a * 0.5) * 0.8;
  vec3 earth = mix(${wgV3(WG_C.earthA)}, ${wgV3(WG_C.earthB)}, nC.g * 0.6 + nD.r * 0.4);
  earth = mix(earth, ${wgV3(WG_C.pebble)}, smoothstep(0.80, 0.86, nD.a) * 0.7);
  vec3 rock = mix(${wgV3(WG_C.rockA)}, ${wgV3(WG_C.rockB)}, nC.a * 0.5 + nD.b * 0.5);
  rock = mix(rock, ${wgV3(WG_C.lichen)}, smoothstep(0.6, 0.8, nB.r) * 0.45);
  float trod = texture2D(uGM, (p + (nC.rg - 0.5) * 46.0) / uGWorld).r;
  float wEarth = clamp(smoothstep(0.22, 0.6, trod) + smoothstep(0.80, 0.97, (1.0 - vGH) + (nB.r - 0.5) * 0.3) * 0.8 + smoothstep(0.76, 0.9, nB.g * 0.6 + nC.a * 0.4) * 0.6, 0.0, 1.0);
  float wRock = smoothstep(0.036, 0.062, vGS + (nC.r - 0.5) * 0.022) * (1.0 - smoothstep(0.5, 0.9, trod));
  vec3 c = mix(grass, heath, wHeath);
  c = mix(c, earth, wEarth);
  c = mix(c, rock, wRock);
  c *= 0.84 + 0.32 * nD.r;                  // the grain of it
  c *= mix(0.80, 1.10, vGH);                // darker in the hollows
  c *= 1.0 - 0.22 * smoothstep(0.55, 1.0, trod) * (0.5 + nD.g);   // a beaten way is darker down its middle
  return c;
}
`;

// Turn the ground mesh over to the new colouring. Returns what the grass needs, or null if it was left alone.
export function dressWildsGround(THREE, ground, { world, heightAt, ways, places }) {
  const geo = ground.geometry, pos = geo.attributes.position;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < lo) lo = y; if (y > hi) hi = y; }
  const span = Math.max(1, hi - lo), gh = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) gh[i] = wgSS(0, 1, (pos.getY(i) - lo) / span);
  geo.setAttribute('gh', new THREE.BufferAttribute(gh, 1));
  const noise = makeGroundNoise(THREE), mask = makeGroundMask(THREE, world, ways, places);
  const old = ground.material;
  const mat = new THREE.MeshLambertMaterial({ color: old.color.clone(), emissive: old.emissive ? old.emissive.clone() : 0x000000 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGN = { value: noise.tex }; sh.uniforms.uGM = { value: mask.tex }; sh.uniforms.uGWorld = { value: new THREE.Vector2(world.width, world.height) };
    sh.vertexShader = 'attribute float gh; varying vec3 vGP; varying float vGS; varying float vGH;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGP = (modelMatrix * vec4(transformed, 1.0)).xyz; vGS = 1.0 - normal.y; vGH = gh;');
    sh.fragmentShader = WG_FRAG + sh.fragmentShader.replace('#include <map_fragment>', 'diffuseColor.rgb *= wildsGround();');
  };
  mat.customProgramCacheKey = () => 'wildsGround1';
  ground.material = mat;
  if (old.dispose) old.dispose();
  ground.userData.rich = true;
  const hOf = (x, z, y) => wgSS(0, 1, ((y === undefined ? heightAt(x, z) : y) - lo) / span);
  return { noise, mask, hOf };
}

// One tuft: seven blades, each a single leaning triangle, dark at the root.
function wgTuft(THREE) {
  const r = wgMulberry(4242), P = [], Nn = [], Cc = [], T = [];
  for (let b = 0; b < 7; b++) {
    const a = b * Math.PI * 2 / 7 + r() * 0.7, out = 1.0 + r() * 3.0, h = 5 + r() * 5.5, lean = 1.6 + r() * 3, w = 0.7 + r() * 0.55;
    const cx = Math.cos(a) * out, cz = Math.sin(a) * out, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    P.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, cx + Math.cos(a) * lean, h, cz + Math.sin(a) * lean);
    const shade = 0.82 + r() * 0.36;
    for (let k = 0; k < 3; k++) { Nn.push(0, 1, 0); const c = (k === 2 ? 1.2 : 0.5) * shade; Cc.push(c, c, c); T.push(k === 2 ? 1 : 0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setAttribute('aTip', new THREE.Float32BufferAttribute(T, 1));
  return g;
}

// How far the grass goes, in three rings. You cannot tell blade from blade a long way off, so each ring out is
// sparser and its tufts bigger: the near ring is the meadow at your feet, the far one carries it to where the fog
// takes over. A ring fades in over [from, full] and out over the last fifth of `to`, so each hands on to the next.
// `gap` is the grid's pitch, `size` how much bigger its tufts stand.
export const WILDS_GRASS = {
  high: [
    { gap: 11, from: 0, full: 0, to: 340, size: 1 },
    { gap: 26, from: 200, full: 340, to: 820, size: 1.5 },
    { gap: 52, from: 620, full: 820, to: 1500, size: 2.2 },
  ],
  medium: [
    { gap: 16, from: 0, full: 0, to: 250, size: 1 },
    { gap: 36, from: 150, full: 250, to: 600, size: 1.5 },
    { gap: 68, from: 450, full: 600, to: 1000, size: 2.2 },
  ],
};
// A ring is laid again when you have walked `slack` from where it was last laid, and laid that much wider than it shows.
export const grassSlack = (r) => r.gap * 3;
// The most tufts a ring can ever need: every cell of its grid that the laid ring can touch. (Room for all of them,
// so a ring is never cut short on one side.)
export function grassRoom(r) {
  const out = r.to + grassSlack(r) + r.gap * 1.5, inn = Math.max(0, r.from - grassSlack(r) - r.gap * 1.5);
  return Math.ceil(Math.PI * (out * out - inn * inn) / (r.gap * r.gap) * 1.04) + 16;
}

// Grass round whoever is walking. `update(x, z, t, tint, frost)` each frame while the Wilds are shown.
export function createWildsGrass(THREE, scene, { noise, mask, hOf, heightAt, quality, world, blocked }) {
  const RINGS = (WILDS_GRASS[quality] || []).map((r) => ({ ...r, max: grassRoom(r) })); if (!RINGS.length) return null;
  const TOTAL = RINGS.reduce((n, r) => n + r.max, 0);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const U = { uT: { value: 0 }, uC: { value: new THREE.Vector2() } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute float aTip; attribute vec3 aRing; uniform float uT; uniform vec2 uC;\n' + sh.vertexShader.replace('#include <lights_lambert_vertex>', '#include <lights_lambert_vertex>\n  #ifdef DOUBLE_SIDED\n    vLightBack = vLightFront; vIndirectBack = vIndirectFront;   // a blade is lit the same from either side\n  #endif').replace('#include <project_vertex>', `
  vec4 gW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    vec4 gO = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    gW = instanceMatrix * gW;
    float gD = distance(gO.xz, uC);
    // its ring's own reach (aRing: from, full, to): it comes up as the nearer ring thins, and thins toward its own edge
    float gShow = (aRing.y > 0.0 ? smoothstep(aRing.x, aRing.y, gD) : 1.0) * (1.0 - smoothstep(aRing.z * 0.78, aRing.z, gD));
    gW.y = gO.y + (gW.y - gO.y) * gShow;
    float gWind = sin(uT * 1.6 + gO.x * 0.021 + gO.z * 0.017) * 0.65 + sin(uT * 2.9 + gO.x * 0.05 - gO.z * 0.03) * 0.3;
    gW.x += aTip * gWind * 1.5; gW.z += aTip * gWind * 0.8;                      // wind
    vec2 gAway = gO.xz - uC; float gNear = 1.0 - smoothstep(8.0, 30.0, length(gAway));
    gW.xz += aTip * normalize(gAway + vec2(0.001)) * gNear * 5.0; gW.y -= aTip * gNear * 3.0;   // and it parts where you walk
  #endif
  vec4 mvPosition = modelViewMatrix * gW;
  gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => 'wildsGrass2';
  const geo = wgTuft(THREE);
  // every ring has its own run of the instances, so which ring a tuft is of never changes: it is written once
  const ringOf = new Float32Array(TOTAL * 3);
  { let o = 0; for (const r of RINGS) { for (let k = 0; k < r.max; k++) { ringOf[(o + k) * 3] = r.from; ringOf[(o + k) * 3 + 1] = r.full; ringOf[(o + k) * 3 + 2] = r.to; } o += r.max; } }
  geo.setAttribute('aRing', new THREE.InstancedBufferAttribute(ringOf, 3));
  const mesh = new THREE.InstancedMesh(geo, mat, TOTAL);
  // (made at its full length here: setColorAt would make it the length of `count`)
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(TOTAL * 3), 3);
  mesh.instanceMatrix.array.fill(0);   // nothing stands until its ring is filled
  mesh.name = 'wildsGrass'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.userData.noShadowCaster = true;
  scene.add(mesh);
  const hash = (i, j, k) => { const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
  const dummy = new THREE.Object3D(), col = new THREE.Color(), NONE = new THREE.Matrix4().makeScale(0, 0, 0);
  // What grows in each cell of a ring's grid is worked out once and kept: walking on, only the cells newly in reach are new.
  const state = RINGS.map((r, k) => ({ r, k, cells: new Map(), fx: Infinity, fz: Infinity, start: RINGS.slice(0, k).reduce((n, q) => n + q.max, 0), n: 0 }));
  function cellAt(st, a, b) {
    const key = a * 65536 + b, r = st.r;
    let c = st.cells.get(key);
    if (c !== undefined) return c;
    const sd = st.k * 10;
    const x = (a + hash(a, b, sd + 1) - 0.5) * r.gap, z = (b + hash(a, b, sd + 2) - 0.5) * r.gap;
    // nothing grows past the edge of the ground (it used to: the far tufts stood out over the drop at the border)
    if (world && (x < -60 || z < -60 || x > world.width + 60 || z > world.height + 60)) { st.cells.set(key, null); return null; }
    if (blocked && blocked(x, z)) { st.cells.set(key, null); return null; }   // the cut of a sign, its turned edge, its worn path
    const y = heightAt(x, z);
    const m = mixAt(noise, mask, x, z, hOf(x, z, y));
    const grows = (1 - m.earth) * (1 - m.heath * 0.6) * (1 - wgSS(0.12, 0.45, m.trod));
    if (hash(a, b, sd + 3) > grows) c = null;
    else {
      const s = (0.7 + 0.8 * hash(a, b, sd + 4)) * (0.65 + 0.35 * grows) * r.size, k = 1.0 + 0.35 * hash(a, b, sd + 7);
      c = [x, y - 0.6, z, hash(a, b, sd + 5) * Math.PI * 2, s, s * (0.8 + 0.5 * hash(a, b, sd + 6)) * (1 - (r.size - 1) * 0.28), m.grass[0] * k, m.grass[1] * k, m.grass[2] * k];
    }
    if (st.cells.size > 30000) st.cells.clear();
    st.cells.set(key, c);
    return c;
  }
  const slackOf = grassSlack;
  function fill(st, cx, cz) {
    st.fx = cx; st.fz = cz;
    const r = st.r, G = r.gap, slack = slackOf(r), R = r.to + slack, inner = Math.max(0, r.from - slack), K = Math.ceil(R / G), gi = Math.round(cx / G), gj = Math.round(cz / G);
    let n = 0;
    for (let j = -K; j <= K && n < r.max; j++) for (let i = -K; i <= K && n < r.max; i++) {
      const d2 = (i * i + j * j) * G * G;
      if (d2 > (R + G) * (R + G) || (inner > G && d2 < (inner - G) * (inner - G))) continue;
      const c = cellAt(st, gi + i, gj + j); if (!c) continue;
      dummy.position.set(c[0], c[1], c[2]); dummy.rotation.set(0, c[3], 0); dummy.scale.set(c[4], c[5], c[4]); dummy.updateMatrix();
      mesh.setMatrixAt(st.start + n, dummy.matrix);
      mesh.setColorAt(st.start + n, col.setRGB(c[6], c[7], c[8]));
      n++;
    }
    for (let k = n; k < st.n; k++) mesh.setMatrixAt(st.start + k, NONE);   // what the ring no longer needs lies down
    st.n = n;
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  }
  return {
    mesh,
    update(x, z, t, tint, frost) {
      for (const st of state) if (Math.hypot(x - st.fx, z - st.fz) > slackOf(st.r)) fill(st, x, z);
      U.uT.value = t; U.uC.value.set(x, z);
      if (tint) mat.color.copy(tint);
      if (frost) mat.emissive.copy(frost).multiplyScalar(0.7);   // hoar-frost and snow lie on the grass as well, a little less
    },
    count: () => state.reduce((n, st) => n + st.n, 0),
    counts: () => state.map((st) => st.n),
  };
}

// ---------------------------------------------------------------------------
// What lies and grows on the ground besides the grass: stones, heather, tussocks.
//
//   - Stones: where the ground is steep enough to be rock they lie thick and big, half sunk; on bare earth smaller
//     and fewer; now and then one alone in the grass. Grey from the rock's own colours, some with lichen on.
//   - Heather: low dark cushions on the heath, some of them in flower. Ling (Calluna vulgaris) is the heather of the
//     British uplands, and flowers purple in late summer: that much is the record. Where it grows here is the game's.
//   - Tussocks: tall, tufted grass in the hollows, where the ground lies wet, and a few out in the open. Straw-pale
//     at the tips like purple moor-grass (Molinia) over the winter; darker and more upright, like rushes, deepest down.
//
// Each kind is one draw, laid in one ring round whoever is walking (like the grass) and kept for each cell of its
// grid, so walking on only works out the new cells. A thing comes up out of the ground near the ring's edge rather
// than appearing. 'low' has none; 'medium' fewer and not as far.
// ---------------------------------------------------------------------------
export const WILDS_SCATTER = {
  high: { stone: { gap: 30, to: 1300 }, heather: { gap: 22, to: 1100 }, tussock: { gap: 20, to: 820 } },
  medium: { stone: { gap: 44, to: 900 }, heather: { gap: 34, to: 760 }, tussock: { gap: 32, to: 520 } },
};
export const scatterRoom = (r) => { const out = r.to + r.gap * 4.5; return Math.ceil(Math.PI * out * out / (r.gap * r.gap) * 1.04) + 16; };

// A stone: an icosahedron with its corners pushed in and out, flat-faced, darker underneath.
function wgStone(THREE) {
  const g = new THREE.IcosahedronGeometry(1, 0), p = g.attributes.position, r = wgMulberry(733), seen = new Map(), C = [];
  for (let i = 0; i < p.count; i++) {
    const key = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
    if (!seen.has(key)) seen.set(key, [0.72 + r() * 0.5, (r() - 0.5) * 0.25]);
    const [f, sh] = seen.get(key);
    let y = p.getY(i) * f; if (y < 0) y *= 0.55;           // a flatter underside, to sit in the ground
    p.setXYZ(i, p.getX(i) * f + sh * 0.3, y, p.getZ(i) * f);
    const c = 0.5 + 0.5 * Math.max(0, Math.min(1, (p.getY(i) + 0.6) / 1.4)); C.push(c, c * 0.98, c * 0.95);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeVertexNormals();
  return g;
}

// A cushion of heather: forty-four wiry sprigs from one root, the outer ones leaning out, so it makes a low rounded
// bush and not a ball. Each sprig is a narrow blade crossed with another, woody-dark at the root and lighter toward
// the tip, where the flowers are (the instance's colour carries how much it is in flower).
function wgHeather(THREE) {
  const r = wgMulberry(919), P = [], Nn = [], Cc = [], T = [];
  for (let b = 0; b < 44; b++) {
    const ring = Math.sqrt(r()), a = r() * Math.PI * 2, out = ring * 0.62, h = (1 - ring * ring * 0.55) * (0.75 + r() * 0.35);
    const cx = Math.cos(a) * out, cz = Math.sin(a) * out, lean = 0.12 + ring * 0.38, tx = cx + Math.cos(a) * lean, tz = cz + Math.sin(a) * lean;
    const w = 0.1 + r() * 0.08, up = 0.9 + r() * 0.2;
    for (const t of [0, Math.PI / 2]) {
      const px = Math.cos(a + t) * w, pz = Math.sin(a + t) * w;
      P.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, tx, h * up, tz);
      for (let k = 0; k < 3; k++) {
        Nn.push(Math.cos(a) * ring * 0.6, 1, Math.sin(a) * ring * 0.6);
        const c = k === 2 ? 1.25 + r() * 0.2 : 0.38; Cc.push(c, c * (k === 2 ? 0.92 : 1.05), c);
        T.push(k === 2 ? 0.35 : 0);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setAttribute('aTip', new THREE.Float32BufferAttribute(T, 1));
  return g;
}

// A tussock: fourteen tall blades from one root, nearly upright, pale at the tips.
function wgTussock(THREE) {
  const r = wgMulberry(5151), P = [], Nn = [], Cc = [], T = [];
  for (let b = 0; b < 14; b++) {
    const a = b * Math.PI * 2 / 14 + r() * 0.5, out = 0.6 + r() * 2.2, h = 10 + r() * 9, lean = 1.2 + r() * 3.2, w = 0.45 + r() * 0.4;
    const cx = Math.cos(a) * out, cz = Math.sin(a) * out, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    P.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, cx + Math.cos(a) * lean, h, cz + Math.sin(a) * lean);
    const shade = 0.85 + r() * 0.3;
    for (let k = 0; k < 3; k++) { Nn.push(0, 1, 0); const c = (k === 2 ? 1.35 : 0.48) * shade; Cc.push(c, c, c * (k === 2 ? 0.86 : 1)); T.push(k === 2 ? 1 : 0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setAttribute('aTip', new THREE.Float32BufferAttribute(T, 1));
  return g;
}

// The material for one kind: it rises out of the ground near the edge of its ring, and the tussocks move in the wind.
function wgScatterMat(THREE, U, wind) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: wind ? THREE.DoubleSide : THREE.FrontSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = (wind ? 'attribute float aTip;\n' : '') + 'uniform float uT; uniform vec2 uC; uniform float uTo;\n' + sh.vertexShader
      .replace('#include <lights_lambert_vertex>', wind ? '#include <lights_lambert_vertex>\n  #ifdef DOUBLE_SIDED\n    vLightBack = vLightFront; vIndirectBack = vIndirectFront;\n  #endif' : '#include <lights_lambert_vertex>')
      .replace('#include <project_vertex>', `
  vec4 sW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    vec4 sO = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    sW = instanceMatrix * sW;
    float sShow = 1.0 - smoothstep(uTo * 0.8, uTo, distance(sO.xz, uC));
    sW.xyz = sO.xyz + (sW.xyz - sO.xyz) * sShow - vec3(0.0, (1.0 - sShow) * 2.0, 0.0);
    ${wind ? `float sWind = sin(uT * 1.3 + sO.x * 0.019 + sO.z * 0.015) * 0.7 + sin(uT * 2.4 + sO.x * 0.04 - sO.z * 0.03) * 0.3;
    sW.x += aTip * sWind * 1.8; sW.z += aTip * sWind * 0.9;
    vec2 sAway = sO.xz - uC; float sNear = 1.0 - smoothstep(6.0, 26.0, length(sAway));
    sW.xz += aTip * normalize(sAway + vec2(0.001)) * sNear * 6.0; sW.y -= aTip * sNear * 4.0;` : ''}
  #endif
  vec4 mvPosition = modelViewMatrix * sW;
  gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => (wind ? 'wildsScatterW' : 'wildsScatter');
  return mat;
}

// What stands in a cell, for each kind: null, or [x, y, z, turn, width, height, r, g, b]. `m` is mixAt's answer with
// the slope in; `y` the ground; `h` 0 in the deepest hollow to 1 on the highest rise; `q(k)` the cell's own hash.
export const SCATTER_KINDS = {
  stone(x, y, z, m, h, q) {
    const keep = 1 - wgSS(0.15, 0.45, m.trod);
    const onRock = m.rock, bare = m.earth * (1 - onRock);
    const p = (onRock * 0.9 + bare * 0.2 + 0.025) * keep;
    if (q(3) > p) return null;
    const big = onRock > 0.3 && q(4) < 0.7;
    const w = big ? 9 + q(5) * 14 : 3 + q(5) * q(5) * 8, ht = w * (0.42 + q(6) * 0.38);
    const lerp = (a, b, t) => a + (b - a) * t, t = q(7), k = 1.05 + q(8) * 0.3, li = q(9) < 0.3 + onRock * 0.3 ? 0.25 + q(10) * 0.3 : 0;
    const c = [0, 1, 2].map((i) => lerp(lerp(WG_C.rockA[i], WG_C.rockB[i], t * 0.55), WG_C.lichen[i], li) * k * 0.9);
    return [x, y - ht * 0.32, z, q(11) * Math.PI * 2, w, ht, c[0], c[1], c[2]];
  },
  heather(x, y, z, m, h, q) {
    const p = wgSS(0.22, 0.6, m.heath) * 0.9 * (1 - m.earth) * (1 - wgSS(0.1, 0.35, m.trod)) * (1 - m.rock);
    if (q(3) > p) return null;
    const w = 6 + q(5) * 6 + (q(4) < 0.08 ? 4 : 0), ht = 7 + q(6) * 6 + w * 0.2;   // knee-high, a stride or two across
    // in flower, mauve; out of it, the dark olive-brown of ling the rest of the year
    const bloom = q(7) < 0.4 ? 0.45 + q(8) * 0.4 : q(8) * 0.12, k = 1.35 + q(9) * 0.35;
    const flower = [0.36, 0.235, 0.38];
    const c = [0, 1, 2].map((i) => (WG_C.heathA[i] * 1.1 + (flower[i] - WG_C.heathA[i] * 1.1) * bloom) * k);
    return [x, y - 0.6, z, q(11) * Math.PI * 2, w, ht, c[0], c[1], c[2]];
  },
  tussock(x, y, z, m, h, q) {
    const wet = wgSS(0.42, 0.12, h);
    const p = (wet * 0.55 + 0.035) * (1 - m.earth * 0.85) * (1 - m.heath * 0.8) * (1 - wgSS(0.1, 0.35, m.trod)) * (1 - m.rock);
    if (q(3) > p) return null;
    const s = 0.8 + q(5) * 0.6, rush = wet > 0.7 && q(4) < 0.5;
    const straw = rush ? 0.05 : 0.3 + q(7) * 0.45, dark = rush ? 0.72 : 1.05 + q(8) * 0.2;
    const c = [0, 1, 2].map((i) => (m.grass[i] + (WG_C.gDry[i] - m.grass[i]) * straw) * dark);
    return [x, y - 0.5, z, q(11) * Math.PI * 2, s * (rush ? 0.75 : 1), s * (rush ? 1.35 : 1), c[0], c[1], c[2]];
  },
};

// The stones, heather and tussocks round whoever is walking. `update(x, z, t, tint, frost)` each frame, like the grass.
export function createWildsScatter(THREE, scene, { noise, mask, hOf, heightAt, groundAt, quality, world, blocked }) {
  const plan = WILDS_SCATTER[quality]; if (!plan) return null;
  const at = groundAt || heightAt;
  const hash = (i, j, k) => { const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const make = { stone: wgStone, heather: wgHeather, tussock: wgTussock };
  const kinds = Object.keys(plan).map((name, ki) => {
    const r = plan[name], max = scatterRoom(r), wind = name !== 'stone';
    const U = { uT: { value: 0 }, uC: { value: new THREE.Vector2() }, uTo: { value: r.to } };
    const mat = wgScatterMat(THREE, U, wind);
    const mesh = new THREE.InstancedMesh(make[name](THREE), mat, max);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    mesh.count = 0; mesh.name = 'wildsScatter_' + name; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = !wind;
    mesh.userData.noShadowCaster = true;
    if (name === 'stone') weatherRock(THREE, mesh, { cut: 1, split: 1, repaint: 0.3, seed: 41 });   // chipped and lichened (client/rock-weather.js)
    scene.add(mesh);
    return { name, r, max, mesh, mat, U, cells: new Map(), fx: Infinity, fz: Infinity, sd: 50 + ki * 20, place: SCATTER_KINDS[name] };
  });
  function cellAt(K, a, b) {
    const key = a * 65536 + b; let c = K.cells.get(key); if (c !== undefined) return c;
    const G = K.r.gap, sd = K.sd, q = (k) => hash(a, b, sd + k);
    const x = (a + q(1) - 0.5) * G, z = (b + q(2) - 0.5) * G;
    c = null;
    if (!(world && (x < 20 || z < 20 || x > world.width - 20 || z > world.height - 20)) && !(blocked && blocked(x, z))) {
      const y = heightAt(x, z), e = 8;
      const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
      const slope = 1 - 1 / Math.sqrt(1 + dx * dx + dz * dz), hh = hOf(x, z, y);
      c = K.place(x, at(x, z), z, mixAt(noise, mask, x, z, hh, slope), hh, q);
    }
    if (K.cells.size > 40000) K.cells.clear();
    K.cells.set(key, c);
    return c;
  }
  function fill(K, cx, cz) {
    K.fx = cx; K.fz = cz;
    const G = K.r.gap, R = K.r.to + G * 3, N = Math.ceil(R / G), gi = Math.round(cx / G), gj = Math.round(cz / G);
    let n = 0;
    for (let j = -N; j <= N && n < K.max; j++) for (let i = -N; i <= N && n < K.max; i++) {
      if ((i * i + j * j) * G * G > (R + G) * (R + G)) continue;
      const c = cellAt(K, gi + i, gj + j); if (!c) continue;
      dummy.position.set(c[0], c[1], c[2]); dummy.rotation.set(0, c[3], 0); dummy.scale.set(c[4], c[5], c[4]); dummy.updateMatrix();
      K.mesh.setMatrixAt(n, dummy.matrix); K.mesh.setColorAt(n, col.setRGB(c[6], c[7], c[8])); n++;
    }
    K.mesh.count = n;
    K.mesh.instanceMatrix.needsUpdate = true; K.mesh.instanceColor.needsUpdate = true;
  }
  return {
    meshes: kinds.map((K) => K.mesh),
    update(x, z, t, tint, frost) {
      for (const K of kinds) {
        if (Math.hypot(x - K.fx, z - K.fz) > K.r.gap * 3) fill(K, x, z);
        K.U.uT.value = t; K.U.uC.value.set(x, z);
        if (tint && K.name !== 'stone') K.mat.color.copy(tint);     // the season dyes what grows, not the stone
        if (frost) K.mat.emissive.copy(frost).multiplyScalar(K.name === 'stone' ? 0.5 : 0.7);
      }
    },
    counts: () => Object.fromEntries(kinds.map((K) => [K.name, K.mesh.count])),
    // the nearest few of a kind to (x, z), as [x, z, width] (for the tours)
    near(name, x, z, n = 3) {
      const K = kinds.find((k) => k.name === name); if (!K) return [];
      const out = []; for (const c of K.cells.values()) if (c) out.push([Math.round(c[0]), Math.round(c[2]), Math.round(c[4]), Math.hypot(c[0] - x, c[2] - z)]);
      return out.sort((a, b) => a[3] - b[3]).slice(0, n).map((a) => a.slice(0, 3));
    },
  };
}
