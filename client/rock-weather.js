// ---------------------------------------------------------------------------
// Weathered stone. Every rock in the game was drawn the way it was modelled:
// a smooth rounded lump, one clean colour, a little sheen. Real stone is none
// of those. This gives any stone two things:
//
//   - its shape broken (weatherRockGeometry): split finer, then cut by a few
//     flat planes the way stone fractures along its joints, and pitted with
//     noise, so the outline is chipped and the faces are flat-ish and uneven.
//     Never cut from below (a stone stays seated) and only ever inward (it
//     never grows past what it collided as).
//   - its surface aged (the shader): mottled at three grains, crystals
//     glinting light and dark through it, dark hair-cracks, grey-green and
//     orange lichen on what faces the sky, grime and moss toward the foot,
//     the undersides darker, and no shine. All worked out in the shader from
//     where the pixel is in the world: no pictures, so no canvas (Safari salts
//     canvas pixels), and no two stones alike.
//
// What it leans on, as record: crustose lichens (the grey-green crotal and the
// orange wall-lichen Xanthoria) colour most old exposed stone in Britain, on
// the faces that get the weather; moss and grime gather at the foot. Which
// stone has how much is the game's.
//
// Options (`o`): stone (the colour it is pulled toward, or null to keep its
// own), repaint (how far, 0..1), lichen and moss (0..1), cut (0 = keep the
// shape, only age the surface: for carved and dressed stones), split (how many
// times to divide it before cutting: 1 for the many small rocks, 2 for the big
// standing stones), seed.
// ---------------------------------------------------------------------------

export const ROCK_STONES = {
  granite: [0.45, 0.445, 0.42],   // the moor's grey
  slate: [0.34, 0.35, 0.37],
  sandstone: [0.56, 0.48, 0.38],
  basalt: [0.22, 0.20, 0.19],    // the Wastes: dark, burnt
  cave: [0.40, 0.38, 0.35],
};
export const ROCK_DEFAULT = { stone: 'granite', repaint: 0.85, lichen: 1, moss: 1, cut: 1, split: 1, seed: 1 };

// Value noise in three dimensions, the same every time: so the twin vertices along a seam move as one.
function rwHash(x, y, z, s) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.19) * 43758.5453; return h - Math.floor(h); }
function rwNoise(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (i, j, k) => rwHash(xi + i, yi + j, zi + k, s);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

// One level of splitting: every triangle into four, every attribute carried halfway along each edge.
function rwSplit(THREE, geo) {
  const names = Object.keys(geo.attributes), src = names.map((n) => geo.attributes[n]);
  const tri = geo.attributes.position.count / 3, out = src.map((a) => new Float32Array(tri * 12 * a.itemSize));
  for (let t = 0; t < tri; t++) {
    src.forEach((a, ai) => {
      const k = a.itemSize, o = out[ai], get = (i, c) => a.getComponent ? a.getComponent(i, c) : a.array[i * k + c];
      const A = [], B = [], C = [];
      for (let c = 0; c < k; c++) { A.push(get(t * 3, c)); B.push(get(t * 3 + 1, c)); C.push(get(t * 3 + 2, c)); }
      const m = (p, q) => p.map((v, c) => (v + q[c]) / 2), ab = m(A, B), bc = m(B, C), ca = m(C, A);
      [[A, ab, ca], [ab, B, bc], [ca, bc, C], [ab, bc, ca]].forEach((T, ti) => T.forEach((P, pi) => { for (let c = 0; c < k; c++) o[((t * 4 + ti) * 3 + pi) * k + c] = P[c]; }));
    });
  }
  const g = new THREE.BufferGeometry();
  names.forEach((n, i) => g.setAttribute(n, new THREE.BufferAttribute(out[i], src[i].itemSize, src[i].normalized)));
  return g;
}

// An attribute's values as plain floats, one run per vertex in triangle order (three of this age neither reads a
// normalized attribute's true values nor keeps it normalized when it drops the index).
function rwFloats(attr, index) {
  const k = attr.itemSize, arr = attr.array, N = index ? index.count : attr.count, out = new Float32Array(N * k);
  const div = !attr.normalized ? 1 : arr instanceof Int8Array ? 127 : arr instanceof Uint8Array ? 255 : arr instanceof Int16Array ? 32767 : arr instanceof Uint16Array ? 65535 : 1;
  const get = (i, c) => (c === 0 ? attr.getX(i) : c === 1 ? attr.getY(i) : c === 2 ? attr.getZ(i) : attr.getW(i));
  for (let v = 0; v < N; v++) { const i = index ? index.getX(v) : v; for (let c = 0; c < k; c++) out[v * k + c] = Math.max(-1e6, get(i, c) / div); }
  return out;
}

// The shape, broken. Returns a new geometry with an `rockH` attribute: 0 at its foot, 1 at its top. With `cut` off
// the shape is only copied (indexed as it was), so a carved stone's letters stay as they were cut.
export function weatherRockGeometry(THREE, source, o = {}) {
  const opt = { ...ROCK_DEFAULT, ...o };
  let geo;
  if (!opt.cut) geo = source.clone();
  else {
    geo = new THREE.BufferGeometry();
    for (const n of ['position', 'normal', 'uv', 'color']) { const a = source.attributes[n]; if (a) geo.setAttribute(n, new THREE.BufferAttribute(rwFloats(a, source.index), a.itemSize)); }
    for (let i = 0; i < opt.split; i++) geo = rwSplit(THREE, geo);
  }
  geo.computeBoundingBox();
  const bb = geo.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, cz = (bb.min.z + bb.max.z) / 2;
  const sx = (bb.max.x - bb.min.x) / 2 || 1, sy = (bb.max.y - bb.min.y) / 2 || 1, sz = (bb.max.z - bb.min.z) / 2 || 1, R = Math.max(sx, sy, sz);
  const p = geo.attributes.position, N = p.count;
  if (opt.cut) {
    // the joints it broke along: planes leaning every way but up from below, set in from its skin
    const planes = [];
    for (let k = 0; k < 7; k++) {
      const a = rwHash(k, 1, 0, opt.seed) * Math.PI * 2, e = -0.25 + rwHash(k, 2, 0, opt.seed) * 1.3;   // never from underneath
      const n = [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
      planes.push({ n, d: 0.55 + rwHash(k, 3, 0, opt.seed) * 0.27 });
    }
    // a vertex's twins (the same point on other triangles) move together: keyed on where it is
    const moved = new Map();
    for (let i = 0; i < N; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), key = x.toFixed(4) + ',' + y.toFixed(4) + ',' + z.toFixed(4);
      let m = moved.get(key);
      if (!m) {
        // in the stone's own unit space, so a pillar is cut as a pillar and a slab as a slab
        let ux = (x - cx) / sx, uy = (y - cy) / sy, uz = (z - cz) / sz;
        for (const pl of planes) {
          const s = ux * pl.n[0] + uy * pl.n[1] + uz * pl.n[2];
          if (s > pl.d) { const by = s - pl.d; ux -= pl.n[0] * by; uy -= pl.n[1] * by; uz -= pl.n[2] * by; }
        }
        // pitted: pushed in, never out, more where the noise is low
        const L = Math.hypot(ux, uy, uz) || 1, f = 2.2 / R;
        const pit = (rwNoise(x * f, y * f, z * f, opt.seed) * 0.65 + rwNoise(x * f * 3.1, y * f * 3.1, z * f * 3.1, opt.seed + 7) * 0.35);
        const keepFoot = Math.min(1, Math.max(0, (uy + 1) / 0.35));      // the foot stays where it sat
        const inward = (0.1 * (1 - pit)) * keepFoot;
        ux -= ux / L * inward; uz -= uz / L * inward; uy -= (uy / L) * inward * (uy > 0 ? 1 : 0);
        m = [cx + ux * sx, cy + uy * sy, cz + uz * sz];
        moved.set(key, m);
      }
      p.setXYZ(i, m[0], m[1], m[2]);
    }
    // lit nearly flat face by face, as broken stone is, with a little of the rounding left so it is not glass
    geo.computeVertexNormals();
    const fn = geo.attributes.normal, sum = new Map();
    for (let i = 0; i < N; i++) { const key = p.getX(i).toFixed(4) + ',' + p.getY(i).toFixed(4) + ',' + p.getZ(i).toFixed(4); const s = sum.get(key) || [0, 0, 0]; s[0] += fn.getX(i); s[1] += fn.getY(i); s[2] += fn.getZ(i); sum.set(key, s); }
    for (let i = 0; i < N; i++) {
      const s = sum.get(p.getX(i).toFixed(4) + ',' + p.getY(i).toFixed(4) + ',' + p.getZ(i).toFixed(4)), L = Math.hypot(s[0], s[1], s[2]) || 1;
      const nx = fn.getX(i) * 0.7 + s[0] / L * 0.3, ny = fn.getY(i) * 0.7 + s[1] / L * 0.3, nz = fn.getZ(i) * 0.7 + s[2] / L * 0.3, M = Math.hypot(nx, ny, nz) || 1;
      fn.setXYZ(i, nx / M, ny / M, nz / M);
    }
  }
  geo.computeBoundingBox();   // as it is now, cut
  const hAttr = new Float32Array(N), h0 = geo.boundingBox.min.y, hs = (geo.boundingBox.max.y - h0) || 1;
  for (let i = 0; i < N; i++) hAttr[i] = Math.max(0, Math.min(1, (p.getY(i) - h0) / hs));
  geo.setAttribute('rockH', new THREE.BufferAttribute(hAttr, 1));
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}

const rwV3 = (a) => `vec3(${a.map((n) => n.toFixed(3)).join(', ')})`;
const rwF = (n) => n.toFixed(3);

// The surface, aged. The options are written into the shader as numbers, so each set is one program.
export function rockShaderParts(o) {
  const stone = o.stone ? (ROCK_STONES[o.stone] || o.stone) : null;
  const head = `
varying vec3 vRW; varying vec3 vRN; varying float vRH;
float rwH3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float rwN3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rwH3(i), rwH3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(rwH3(i + vec3(0.0, 1.0, 0.0)), rwH3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(rwH3(i + vec3(0.0, 0.0, 1.0)), rwH3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(rwH3(i + vec3(0.0, 1.0, 1.0)), rwH3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
`;
  const frag = `
  {
    vec3 rp = vRW;
    float rUp = normalize(vRN).y;
    float rA = rwN3(rp * 0.045), rB = rwN3(rp * 0.17 + 3.1), rC = rwN3(rp * 0.6 + 7.7);
    vec3 rc = diffuseColor.rgb;
    ${stone ? `float rLum = dot(rc, vec3(0.299, 0.587, 0.114));
    rc = mix(rc, ${rwV3(stone)} * (0.75 + 0.6 * rLum), ${rwF(o.repaint)});` : ''}
    rc *= 0.8 + 0.3 * rA + 0.16 * (rB - 0.5) + 0.12 * (rC - 0.5);              // mottled at three grains
    float rX = rwN3(rp * 1.3 + 1.7);                                           // the grain: crystals, light and dark
    rc *= 1.0 + 0.12 * smoothstep(0.72, 0.9, rX) - 0.12 * smoothstep(0.28, 0.1, rX);
    float rK = abs(rwN3(rp * 0.075 + vec3(rB * 0.8)) * 2.0 - 1.0);             // a few hair-cracks, in some parts of it
    float rKm = smoothstep(0.55, 0.75, rwN3(rp * 0.03 + 21.0));
    rc *= mix(1.0, mix(0.62, 1.0, smoothstep(0.008, 0.04, rK)), rKm);
    rc *= 0.72 + 0.28 * smoothstep(-0.7, 0.35, rUp);                           // darker underneath
    ${o.lichen > 0 ? `float rSky = smoothstep(-0.15, 0.55, rUp);
    float rL = smoothstep(0.56, 0.7, rwN3(rp * 0.07 + 11.0) * 0.7 + rC * 0.3) * rSky;
    rc = mix(rc, vec3(0.50, 0.54, 0.43) * (0.8 + 0.4 * rC), rL * ${rwF(0.7 * o.lichen)});   // the grey-green crotal
    float rO = smoothstep(0.82, 0.9, rwN3(rp * 0.3 + 5.0)) * smoothstep(0.86, 0.95, rwN3(rp * 0.04 + 9.0) * 0.5 + 0.5) * smoothstep(0.2, 0.8, rUp);
    rc = mix(rc, vec3(0.66, 0.47, 0.20) * (0.85 + 0.3 * rC), rO * ${rwF(0.5 * o.lichen)});                      // the orange wall-lichen` : ''}
    ${o.moss > 0 ? `float rFoot = 1.0 - smoothstep(0.0, 0.28 + 0.12 * rB, vRH);
    rc = mix(rc, rc * vec3(0.55, 0.64, 0.42), rFoot * ${rwF(0.85 * o.moss)});                // grime and moss at the foot` : `rc *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.25, vRH));`}
    diffuseColor.rgb = rc;
  }
`;
  return { head, frag };
}

// Put the aging on a material (keeping whatever it already does to itself). Set once; a clone keeps it (below).
function rwInstall(mat) {
  const o = mat.userData.rockWeather; if (!o || mat.userData.rockWeatherOn === mat.uuid) return;
  mat.userData.rockWeatherOn = mat.uuid;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = function (sh, r) {
    if (prev && prev !== rwInstall.noop) prev.call(this, sh, r);
    const opt = { ...ROCK_DEFAULT, ...(this.userData.rockWeather || {}) }, parts = rockShaderParts(opt);
    sh.vertexShader = 'attribute float rockH;\n' + parts.head.replace(/float rw[\s\S]*$/, '') + sh.vertexShader.replace('#include <fog_vertex>', `#include <fog_vertex>
  {
    vec4 rwp = vec4(transformed, 1.0); vec3 rwn = objectNormal;
    #ifdef USE_INSTANCING
      rwp = instanceMatrix * rwp; rwn = mat3(instanceMatrix) * rwn;
    #endif
    vRW = (modelMatrix * rwp).xyz; vRN = mat3(modelMatrix) * rwn; vRH = rockH;
  }`);
    sh.fragmentShader = parts.head + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + parts.frag);
  };
  mat.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|rock:' + JSON.stringify(this.userData.rockWeather); };
  if ('roughness' in mat) { mat.roughness = Math.max(mat.roughness, 0.95); mat.metalness = 0; }   // stone does not shine
  mat.needsUpdate = true;
}
rwInstall.noop = function () {};

// A material made by .clone() starts without the hook (three does not copy it): give it back.
let rwPatched = false;
function rwPatchClone(THREE) {
  if (rwPatched || !THREE || !THREE.Material) return; rwPatched = true;
  const orig = THREE.Material.prototype.clone;
  THREE.Material.prototype.clone = function () { const c = orig.call(this); if (c.userData && c.userData.rockWeather) { delete c.userData.rockWeatherOn; rwInstall(c); } return c; };
}

// Age a material for stone: `o` are the options above. Returns it.
export function weatherRockMaterial(THREE, mat, o = {}) {
  rwPatchClone(THREE);
  mat.userData.rockWeather = { ...ROCK_DEFAULT, ...(mat.userData.rockWeather || {}), ...o };
  delete mat.userData.rockWeather.seed;
  rwInstall(mat);
  return mat;
}

// Change how a stone is aged (the Wastes take the lichen off theirs). Works on a material already aged.
export function reweatherRock(mat, o) {
  if (!mat || !mat.userData || !mat.userData.rockWeather) return;
  mat.userData.rockWeather = { ...mat.userData.rockWeather, ...o };
  mat.needsUpdate = true;
}

// Age every stone mesh under `root`: its shape (shared shapes broken once) and its materials. `only(mesh, material)`
// can keep a part out (a lichen disc, a lamp). Returns how many meshes it touched.
const rwGeoCache = new WeakMap();
export function weatherRock(THREE, root, o = {}, only) {
  let n = 0;
  root.traverse((m) => {
    if (!m.isMesh || !m.geometry || !m.geometry.attributes || !m.geometry.attributes.position) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (only && !mats.some((mt) => only(m, mt))) return;
    if (Array.isArray(m.material) || (m.geometry.groups && m.geometry.groups.length > 1)) return;   // split by groups: left alone
    const key = JSON.stringify({ ...ROCK_DEFAULT, ...o, stone: 0, repaint: 0, lichen: 0, moss: 0 });
    let per = rwGeoCache.get(m.geometry); if (!per) { per = new Map(); rwGeoCache.set(m.geometry, per); }
    // the aging is dress, never structure: if a shape will not take it, the stone is left as it was
    try {
      let g = per.get(key);
      if (!g) { g = weatherRockGeometry(THREE, m.geometry, o); per.set(key, g); rwGeoCache.set(g, new Map([[key, g]])); }
      weatherRockMaterial(THREE, m.material, o);
      m.geometry = g;
      n++;
    } catch (e) { /* left as modelled */ }
  });
  return n;
}

// Is this part of a model stone? Not glass, not glowing, and either painted from the model's palette or a colour
// with little colour in it (grey, not a lamp's brass or a plaque's red).
export function rockLike(mesh, mt) {
  if (!mt || mt.transparent || mt.opacity < 1) return false;
  if (mt.emissive && (mt.emissive.r + mt.emissive.g + mt.emissive.b) > 0.06) return false;
  if (mt.map) return true;
  const c = mt.color; if (!c) return false;
  const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
  return mx > 0 && (mx - mn) / mx < 0.32;
}
