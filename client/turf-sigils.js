// ---------------------------------------------------------------------------
// The witch-signs of the Wilds, cut into the turf.
//
// What was there: each sign a flat sticker of scorch with a neon line laid on
// top, two planes a sign and 440 draws for the lot, and the grass cleared in a
// disc round each one. By day it read as a dark stain, by night as paint.
//
// What this is: the sign is cut through the turf down to the chalk, the way the
// old hill figures and turf mazes are (record: the Uffington White Horse, the
// turf mazes of Saffron Walden and Wing; the signs themselves, and the light in
// the cut, are the game's). So:
//   - the line is a channel of pale chalk, darker down its walls, with the cut
//     turf turned back along its edge and crumbs of chalk thrown out;
//   - grass grows right up to it, inside the figure as well as out, and not in
//     it, so the cut reads as a cut through the grass;
//   - a path is worn round each one, broken where it is little walked;
//   - by night a cold light lies in the cut, uneven along it, and a little of
//     it spills on the ground beside.
// Every sign is in one atlas and the whole scatter is two draws (the chalk, and
// the light), whatever the count.
//
// Made from numbers, not drawn on a canvas: Safari salts canvas pixels, which is
// what showed as coloured squares in the Hunt's lights.
// ---------------------------------------------------------------------------

// The figure's radius is this fraction of the decal it is drawn on (as before), so a sign of `size` spans the same
// ground it did.
export const TURF_RF = 86 / 256;
const TURF_E = 0.5 / TURF_RF;          // the decal's half-width, in figure radii
export const TURF = {
  cell: 256,           // pixels a sign
  cols: 4,             // signs across the atlas (and down)
  hw: 0.065,           // half the width of the cut, in figure radii
  lip: 2.4,            // the turned turf reaches this many half-widths out
  ring: 1.27,          // the worn path round it, in figure radii
  ringHalf: 0.068,
};

// ── the twelve signs, as lines and dots in figure radii (the same twelve as before) ─────────────────────────────
const tsTAU = Math.PI * 2;
function tsArc(cx, cy, r, a0, a1, back) {
  // as a canvas draws it: forwards from a0 to a1, or backwards
  let sweep = back ? a0 - a1 : a1 - a0;
  while (sweep < 0) sweep += tsTAU;
  if (sweep > tsTAU) sweep = tsTAU;
  const n = Math.max(6, Math.ceil(sweep / 0.06)), out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (back ? -1 : 1) * sweep * i / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
const tsCircle = (cx, cy, r) => tsArc(cx, cy, r, 0, tsTAU);
const tsClosed = (pts) => [...pts, pts[0]];
function tsQuad(a, c, b) { const out = []; for (let i = 0; i <= 24; i++) { const t = i / 24, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); } return out; }
function tsCubic(a, c1, c2, b) { const out = []; for (let i = 0; i <= 40; i++) { const t = i / 40, u = 1 - t; out.push([0, 1].map((k) => u * u * u * a[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * b[k])); } return out; }
const tsRot = (pts, a) => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
const tsStar = (n, step, r = 1) => { const p = []; for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i * step * tsTAU / n; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; };

export const TURF_SIGNS = [
  { name: 'pentacle', lines: [tsCircle(0, 0, 1), tsStar(5, 2)], dots: [] },
  { name: 'triple moon', lines: [tsCircle(0, 0, 0.4), tsArc(-0.52, 0, 0.4, Math.PI * 0.4, Math.PI * 1.6), tsArc(0.52, 0, 0.4, -Math.PI * 0.6, Math.PI * 0.6)], dots: [] },
  { name: 'watching eye', lines: [[...tsQuad([-1, 0], [0, -0.7], [1, 0]), ...tsQuad([1, 0], [0, 0.7], [-1, 0]).slice(1)], tsCircle(0, 0, 0.3)], dots: [[0, 0, 0.12]] },
  { name: "hag's wheel", lines: [tsCircle(0, 0, 1), ...[0, 1, 2, 3, 4, 5].map((i) => [[0, 0], [Math.cos(i * Math.PI / 3), Math.sin(i * Math.PI / 3)]])], dots: [] },
  { name: 'sealing star', lines: [0, Math.PI].map((o) => tsClosed([0, 1, 2].map((i) => { const a = -Math.PI / 2 + o + i * tsTAU / 3; return [Math.cos(a), Math.sin(a)]; }))), dots: [] },
  { name: 'moon-staff', lines: [tsArc(0, -0.4, 0.45, 0.5, Math.PI - 0.5, true), [[0, -0.7], [0, 1]], [[-0.35, 0.4], [0.35, 0.4]]], dots: [] },
  { name: 'triskele', lines: [0, 1, 2].map((k) => tsRot(Array.from({ length: 11 }, (_, i) => { const t = i / 10, a = t * 3.4; return [Math.cos(a) * t, Math.sin(a) * t]; }), k * tsTAU / 3)), dots: [] },
  { name: 'ward-knot', lines: [tsClosed([[-1, 0], [0, -1], [1, 0], [0, 1]]), tsClosed(tsRot([[-0.7, 0], [0, -0.7], [0.7, 0], [0, 0.7]], Math.PI / 4)), tsCircle(0, 0, 0.2)], dots: [] },
  { name: 'serpent', lines: [tsCubic([-1, 0.5], [-0.4, -1], [0.4, 1], [1, -0.5])], dots: [[1, -0.5, 0.14]] },
  { name: 'ashen glyph', lines: [tsClosed([[0, -1], [0.87, 0.5], [-0.87, 0.5]]), [[-0.6, -0.05], [0.6, -0.05]]], dots: [[0, 0.12, 0.1]] },
  { name: 'heptagram', lines: [tsStar(7, 3)], dots: [] },
  { name: 'cross', lines: [tsCircle(0, 0, 1), [[-1, 0], [1, 0]], [[0, -1], [0, 1]]], dots: [[-0.5, -0.5, 0.1], [0.5, -0.5, 0.1], [-0.5, 0.5, 0.1], [0.5, 0.5, 0.1]] },
];

// ── numbers for texture ─────────────────────────────────────────────────────────────────────────────────────────
function tsHash(i, j, k) { let h = (i * 374761393 + j * 668265263 + k * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function tsNoise(x, y, k) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = tsHash(xi, yi, k), b = tsHash(xi + 1, yi, k), c = tsHash(xi, yi + 1, k), d = tsHash(xi + 1, yi + 1, k);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}
const tsSS = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Distance from every pixel of a sign's cell to its nearest line, in figure radii. Pixel (i, j) lies at
// x = (i + 0.5) / S * 2E - E, y likewise from j: the same way round the decal's (u, v) runs.
export function signField(sign, S = TURF.cell) {
  const d = new Float32Array(S * S).fill(9), px = (2 * TURF_E) / S, reach = 0.3;   // beyond this nothing is drawn or asked
  const toPix = (x) => (x + TURF_E) / px - 0.5;
  for (const line of sign.lines) for (let k = 0; k < line.length - 1; k++) {
    const [ax, ay] = line[k], [bx, by] = line[k + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
    const i0 = Math.max(0, Math.floor(toPix(Math.min(ax, bx) - reach))), i1 = Math.min(S - 1, Math.ceil(toPix(Math.max(ax, bx) + reach)));
    const j0 = Math.max(0, Math.floor(toPix(Math.min(ay, by) - reach))), j1 = Math.min(S - 1, Math.ceil(toPix(Math.max(ay, by) + reach)));
    for (let j = j0; j <= j1; j++) {
      const y = (j + 0.5) * px - TURF_E;
      for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5) * px - TURF_E, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
        const ex = x - ax - dx * t, ey = y - ay - dy * t, q = Math.sqrt(ex * ex + ey * ey);
        if (q < d[j * S + i]) d[j * S + i] = q;
      }
    }
  }
  for (const [cx, cy, r] of sign.dots) {
    const i0 = Math.max(0, Math.floor(toPix(cx - r - reach))), i1 = Math.min(S - 1, Math.ceil(toPix(cx + r + reach)));
    const j0 = Math.max(0, Math.floor(toPix(cy - r - reach))), j1 = Math.min(S - 1, Math.ceil(toPix(cy + r + reach)));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const q = Math.max(0, Math.hypot((i + 0.5) * px - TURF_E - cx, (j + 0.5) * px - TURF_E - cy) - r);
      if (q < d[j * S + i]) d[j * S + i] = q;
    }
  }
  return d;
}

// One sign's chalk (lit colour and coverage) and light (how near the middle of the cut), into the atlases at cell c.
function tsPaintSign(c, field, chalk, light, keep, S, W) {
  const ox = (c % TURF.cols) * S, oy = Math.floor(c / TURF.cols) * S, px = (2 * TURF_E) / S, HW = TURF.hw;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = (i + 0.5) * px - TURF_E, y = (j + 0.5) * px - TURF_E, d = field[j * S + i], t = d / HW;
    // most of a cell is open ground: nothing to paint (the atlas starts at nothing), and no light reaches it
    if (t > TURF.lip + 0.4 && d > HW * 4.2 && Math.abs(Math.hypot(x, y) - TURF.ring) > TURF.ringHalf * 1.3) continue;
    const n1 =tsNoise(x * 9, y * 9, c * 7 + 1), n2 = tsNoise(x * 3.2, y * 3.2, c * 7 + 2), n3 = tsNoise(x * 26, y * 26, c * 7 + 3), sp = tsHash(i, j, c * 7 + 4);
    let r = 0, g = 0, b = 0, a = 0;
    // the worn path round it: beaten earth, broken where it is little walked
    const rd = Math.abs(Math.hypot(x, y) - TURF.ring) / TURF.ringHalf;
    const worn = (1 - tsSS(0.5, 1.0, rd + (n3 - 0.5) * 0.6)) * tsSS(0.28, 0.46, n2) * 0.92;
    if (worn > 0) { const k = 0.8 + 0.3 * n1; r = 0.27 * k; g = 0.20 * k; b = 0.125 * k; a = worn; }
    // the turned turf along the cut: dark soil, roots, crumbs of chalk thrown up
    const lipEdge = TURF.lip + (n1 - 0.5) * 0.7;
    if (t < lipEdge) {
      const crumb = sp > 0.9 && t > 1.05;
      const k = 0.75 + 0.45 * n3;
      const lr = crumb ? 0.64 : 0.13 * k, lg = crumb ? 0.62 : 0.095 * k, lb = crumb ? 0.55 : 0.06 * k;
      const la = 1 - tsSS(1.1, lipEdge, t);
      a = Math.max(a, la); const w = la; r = r * (1 - w) + lr * w; g = g * (1 - w) + lg * w; b = b * (1 - w) + lb * w;
    }
    // the cut itself: chalk, darker down the walls, a flint here and there, a stain of soil at the top of the wall
    if (t < 1.08) {
      const flint = sp > 0.986 && t < 0.8;
      // old chalk is not white: weathered to a dull cream, greened with moss and lichen where it is least walked
      const k = 0.88 + 0.14 * n1 - 0.08 * n3;
      let cr = 0.70 * k, cg = 0.69 * k, cb = 0.625 * k;
      const moss = tsSS(0.55, 0.85, n2) * 0.45;
      cr = cr * (1 - moss) + 0.36 * moss; cg = cg * (1 - moss) + 0.42 * moss; cb = cb * (1 - moss) + 0.24 * moss;
      if (flint) { cr = 0.26; cg = 0.25; cb = 0.26; }
      const wall = 1 - 0.52 * tsSS(0.38, 1.0, t);
      cr *= wall; cg *= wall; cb *= wall;
      const stain = tsSS(0.82, 1.06, t) * 0.55;
      cr = cr * (1 - stain) + 0.30 * stain; cg = cg * (1 - stain) + 0.22 * stain; cb = cb * (1 - stain) + 0.14 * stain;
      const w = 1 - tsSS(1.0, 1.08, t);
      r = r * (1 - w) + cr * w; g = g * (1 - w) + cg * w; b = b * (1 - w) + cb * w; a = Math.max(a, w);
    }
    const o = ((oy + j) * W + ox + i) * 4;
    chalk[o] = Math.round(r * 255); chalk[o + 1] = Math.round(g * 255); chalk[o + 2] = Math.round(b * 255); chalk[o + 3] = Math.round(a * 255);
    // the light: 1 down the floor of the cut, a half at its walls, then what spills on the ground beside it
    const l = d < HW * 0.5 ? 1 : d < HW ? 1 - 0.5 * (d - HW * 0.5) / (HW * 0.5) : Math.max(0, 0.5 - 0.3 * tsSS(HW, HW * 1.6, d) - 0.2 * tsSS(HW * 1.6, HW * 4.2, d));
    light[o] = light[o + 1] = light[o + 2] = 255; light[o + 3] = Math.round(l * 255);
    keep[j * S + i] = Math.round(a * 255);
  }
}

// Every sign, worked out once: the atlases (chalk, light), and for each sign its distance field and coverage so the
// grass and the stones can ask where the cut is.
export function makeTurfAtlas(THREE) {
  const S = TURF.cell, W = S * TURF.cols;
  const chalk = new Uint8Array(W * W * 4), light = new Uint8Array(W * W * 4);
  const signs = TURF_SIGNS.map((sign, c) => {
    const field = signField(sign, S), keep = new Uint8Array(S * S);
    tsPaintSign(c, field, chalk, light, keep, S, W);
    return { name: sign.name, field, keep };
  });
  const tex = (px) => {
    if (!THREE) return null;
    const t = new THREE.DataTexture(px, W, W, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; t.needsUpdate = true;
    return t;
  };
  return { chalk: tex(chalk), light: tex(light), signs, px: { chalk, light }, S, W };
}

// Where on a sign a world point falls: [cell x, cell y] in pixels, or null if it is off the decal.
function tsOnSign(g, x, z) {
  const dx = x - g.x, dz = z - g.z, c = Math.cos(g.rot), s = Math.sin(g.rot);
  const lx = (dx * c + dz * s) / g.R, ly = (-dx * s + dz * c) / g.R;
  if (Math.abs(lx) >= TURF_E || Math.abs(ly) >= TURF_E) return null;
  const S = TURF.cell, f = S / (2 * TURF_E);
  return [Math.min(S - 1, Math.floor((lx + TURF_E) * f)), Math.min(S - 1, Math.floor((ly + TURF_E) * f))];
}

// Is anything standing at (x, z) on a sign's cut, its turned edge, or its worn path? `reach` widens the cut by that
// many world units (a tuft leans: its root must be clear of the edge by more than its own spread).
export function turfIndex(atlas, glyphs, reach = 3.2) {
  const CELL = 256, buckets = new Map();
  glyphs.forEach((g, k) => {
    const r = g.R * TURF_E * 1.42, i0 = Math.floor((g.x - r) / CELL), i1 = Math.floor((g.x + r) / CELL), j0 = Math.floor((g.z - r) / CELL), j1 = Math.floor((g.z + r) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const key = i * 4096 + j; let l = buckets.get(key); if (!l) buckets.set(key, l = []); l.push(k); }
  });
  function at(x, z) {
    const l = buckets.get(Math.floor(x / CELL) * 4096 + Math.floor(z / CELL));
    if (!l) return null;
    for (const k of l) {
      const g = glyphs[k], p = tsOnSign(g, x, z); if (!p) continue;
      const sg = atlas.signs[g.sign], o = p[1] * TURF.cell + p[0];
      return { d: sg.field[o] * g.R, keep: sg.keep[o] / 255, g };
    }
    return null;
  }
  return {
    at,
    blocked(x, z) { const h = at(x, z); return !!h && (h.keep > 0.35 || h.d < TURF.hw * h.g.R * 1.35 + reach); },
  };
}

// Signs gathered into squares of the map, `cell` world units a side, so a square out of view is not drawn at all.
export function turfChunks(items, cell = 2400) {
  const m = new Map();
  items.forEach((g, i) => { const k = Math.floor(g.x / cell) + ':' + Math.floor(g.z / cell); if (!m.has(k)) m.set(k, []); m.get(k).push(i); });
  return [...m.values()];
}

// The decals: the signs of each square of the map in one mesh for the chalk and one for the light, so what is out of
// view is culled. `ground(x, z)` is the height of the drawn ground there (the mesh, not the smooth field, so the chalk
// lies on what you see). Returns { chalk, light, chalks, lights, uniforms, update }.
export function buildTurfSigns(THREE, scene, atlas, glyphs, ground, opts = {}) {
  const SEG = opts.seg || 10, n = SEG + 1;
  const cols = TURF.cols, cu = 1 / cols;
  // the chalk: lit like the ground, so the day, the night and the fog all fall on it
  const chalkMat = new THREE.MeshLambertMaterial({ map: atlas.chalk, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // the light in the cut: additive, uneven along the line and slowly moving, each sign breathing on its own clock
  const lightMat = new THREE.MeshBasicMaterial({ map: atlas.light, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const U = { uT: { value: 0 }, uShow: { value: 1 } };
  lightMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute vec2 aLoc; attribute vec4 aG; attribute vec3 aCol; uniform float uT;\nvarying vec2 vLoc; varying float vSeed; varying float vBreath; varying vec3 vCol;\n'
      + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLoc = aLoc; vSeed = aG.x; vCol = aCol;\n  vBreath = aG.w + 0.22 * sin(uT * aG.z + aG.y);');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform float uT; uniform float uShow; varying vec2 vLoc; varying float vSeed; varying float vBreath; varying vec3 vCol;
  float tsH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float tsN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(tsH(i), tsH(i + vec2(1.0, 0.0)), f.x), mix(tsH(i + vec2(0.0, 1.0)), tsH(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float tS = texelColor.a;
          // the light gathers in one stretch of the cut and thins in the next, and the gathering creeps along it
          float tPool = smoothstep(0.25, 0.8, tsN(vLoc * 5.0 + vSeed + vec2(uT * 0.035, -uT * 0.028)));
          float tShim = 0.85 + 0.3 * tsN(vLoc * 18.0 + vSeed * 3.0 - uT * 0.35);
          float tCore = smoothstep(0.5, 0.95, tS);
          float tLine = tCore * (0.22 + 0.9 * tPool) * tShim;   // a stretch with little light in it is only a glimmer
          float tSpill = (1.0 - tCore) * tS * (0.55 + 1.1 * tPool);
          diffuseColor.rgb = mix(vCol, vec3(1.0), 0.28 * tCore * tPool);
          diffuseColor.a = opacity * (tLine + tSpill) * vBreath * uShow;
        }`);
  };
  lightMat.customProgramCacheKey = () => 'turf-light';
  const lift = (geo, by) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + by); p.needsUpdate = true; };
  const chalks = [], lights = [];
  for (const part of turfChunks(glyphs, opts.cell || 2400)) {
    const N = part.length * n * n;
    const pos = new Float32Array(N * 3), uv = new Float32Array(N * 2), loc = new Float32Array(N * 2), gA = new Float32Array(N * 4), gC = new Float32Array(N * 3);
    const index = [];
    part.forEach((gi, pi) => {
      const g = glyphs[gi];
      const size = g.R / TURF_RF, c = Math.cos(g.rot), s = Math.sin(g.rot), ax = (g.sign % cols) * cu, ay = Math.floor(g.sign / cols) * cu;
      const base = pi * n * n;
      for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
        const u = k / SEG, v = j / SEG, px = (u - 0.5) * size, pz = (v - 0.5) * size;
        const rx = px * c - pz * s, rz = px * s + pz * c, o = base + j * n + k;
        pos[o * 3] = g.x + rx; pos[o * 3 + 1] = ground(g.x + rx, g.z + rz); pos[o * 3 + 2] = g.z + rz;
        uv[o * 2] = ax + u * cu; uv[o * 2 + 1] = ay + v * cu;
        loc[o * 2] = u; loc[o * 2 + 1] = v;
        gA[o * 4] = g.seed; gA[o * 4 + 1] = g.phase; gA[o * 4 + 2] = g.speed; gA[o * 4 + 3] = g.base;
        gC[o * 3] = g.col[0]; gC[o * 3 + 1] = g.col[1]; gC[o * 3 + 2] = g.col[2];
      }
      for (let j = 0; j < SEG; j++) for (let k = 0; k < SEG; k++) { const a = base + j * n + k, b = a + 1, cc = a + n, d = cc + 1; index.push(a, cc, b, b, cc, d); }
    });
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3)); cg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); cg.setIndex(index);
    lift(cg, 0.3); cg.computeVertexNormals(); cg.computeBoundingSphere();
    const chalk = new THREE.Mesh(cg, chalkMat);
    chalk.name = 'turfSigns'; chalk.renderOrder = 1; chalk.receiveShadow = !!opts.receiveShadow;
    chalk.userData.floats = true;   // it is drawn on the ground, not standing on it (client/float-audit.js)
    scene.add(chalk); chalks.push(chalk);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); lg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    lg.setAttribute('aLoc', new THREE.BufferAttribute(loc, 2)); lg.setAttribute('aG', new THREE.BufferAttribute(gA, 4)); lg.setAttribute('aCol', new THREE.BufferAttribute(gC, 3));
    lg.setIndex(index); lift(lg, 0.7); lg.computeBoundingSphere();
    const light = new THREE.Mesh(lg, lightMat);
    light.name = 'turfSignLight'; light.renderOrder = 2;
    light.userData.floats = true;
    scene.add(light); lights.push(light);
  }
  return {
    chalk: chalks[0], light: lights[0], chalks, lights, uniforms: U,
    update(seconds, show) { U.uT.value = seconds % 4000; U.uShow.value = show; },
  };
}

// Crumbs of chalk and clods of turf thrown out of the cut, lying along its edges, and a few crumbs fallen back into
// it. Returns the points ({ x, z, s, clod }: where, how big in world units, and which); the caller stands them.
export function turfRubble(glyphs, perRadius = 0.5, atlas = null) {
  const out = [];
  glyphs.forEach((g, gi) => {
    const sign = TURF_SIGNS[g.sign], c = Math.cos(g.rot), s = Math.sin(g.rot);
    let k = 0;
    for (const line of sign.lines) for (let i = 0; i < line.length - 1; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1], L = Math.hypot(bx - ax, by - ay); if (L < 1e-6) continue;
      const nx = -(by - ay) / L, ny = (bx - ax) / L, steps = Math.max(1, Math.round(L / 0.11));
      for (let t = 0; t < steps; t++) {
        k++;
        if (tsHash(gi, k, 91) > perRadius) continue;
        const f = (t + tsHash(gi, k, 92)) / steps, side = tsHash(gi, k, 93) < 0.5 ? -1 : 1, fallen = tsHash(gi, k, 94) < 0.1;
        const off = fallen ? (tsHash(gi, k, 95) - 0.5) * TURF.hw * 1.2 : side * TURF.hw * (1.25 + tsHash(gi, k, 95) * 1.1);
        const lx = (ax + (bx - ax) * f + nx * off) * g.R, ly = (ay + (by - ay) * f + ny * off) * g.R;
        const clod = !fallen && tsHash(gi, k, 97) < 0.5;   // half of what is thrown out is the turf itself, roots up
        const wx = g.x + lx * c - ly * s, wz = g.z + lx * s + ly * c;
        if (atlas) {   // where lines cross, a lump thrown off one can land in the other: what was thrown out lies outside the cut
          const p = tsOnSign(g, wx, wz), d = p ? atlas.signs[g.sign].field[p[1] * TURF.cell + p[0]] : 9;
          if (fallen ? d > TURF.hw * 0.8 : d < TURF.hw * 1.15) continue;
        }
        out.push({ x: wx, z: wz, s: Math.max(0.45, Math.min(2.6, g.R * (clod ? 0.03 : 0.018) + g.R * tsHash(gi, k, 96) * 0.026)), clod });
      }
    }
  });
  return out;
}

// The drawn ground's height, from its grid: the same two triangles a cell as THREE.PlaneGeometry makes, so what this
// says is where the surface you see actually is (the smooth field sags below it on a rise and lifts above it in a
// hollow, between the grid's points). `heights` are the grid's (segs + 1)^2 heights, row by row along +z.
export function turfGridHeight(heights, segs, x0, z0, w, h) {
  const n = segs + 1, dx = w / segs, dz = h / segs;
  return (x, z) => {
    let fx = (x - x0) / dx, fz = (z - z0) / dz;
    fx = Math.max(0, Math.min(segs - 1e-6, fx)); fz = Math.max(0, Math.min(segs - 1e-6, fz));
    const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz;
    const ha = heights[iz * n + ix], hb = heights[(iz + 1) * n + ix], hc = heights[(iz + 1) * n + ix + 1], hd = heights[iz * n + ix + 1];
    return u + v <= 1 ? ha + (hd - ha) * u + (hb - ha) * v : hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v);
  };
}
