// ---------------------------------------------------------------------------
// Water in the Wilds. There was none: the clootie well was a spring that went
// nowhere. Now there are two waters, each laid where the ground already falls.
//
//   The well's rill   rises at the clootie well and runs a short way east,
//                     down into the hollow below it, where it stands as a pool.
//   The beck          rises on the rise west of the track up from the portal,
//                     crosses the track at a ford (five stepping stones), and
//                     runs down the valley east and south into a reedy mere.
//
// They are cut into the ground, not laid on it: wildsHeightAt (main.js) passes
// every height through carve(), so feet, grass, props and creatures all go
// down into the bed and wade. It is shallow everywhere (ankle in the beck,
// knee at the middle of the mere), so nothing about where you can walk has
// changed and the server knows nothing of it. The bed only ever falls, so the
// water never runs uphill; where a rise stands in its way it has cut a dale.
//
// The ground mesh is one vertex every 64 units, far too coarse to hold a
// channel 44 wide, so the cells the water touches are swapped for fine ones
// (refineGround): the same mesh, the same material, six times the detail
// where it is needed and nowhere else.
//
// Drawn: the water itself (colour by depth, ripples running with the flow, the
// sky in it at a low angle, a soft foamy edge where it shoals to nothing),
// reeds and reedmace along the margins, and five stones at the ford.
// ---------------------------------------------------------------------------

// Each: the course (world x, y; the spring first, the last point in its pool), half the water's width, how far beyond
// that the bank takes to come up to the moor, how far the bed is cut below the ground, how deep the water stands
// over the bed, how much it drops for each unit it runs, and the pool it ends in.
export const WILDS_WATERS = [
  { name: 'rill', pts: [[2900, 8300], [2975, 8245], [3040, 8170], [3100, 8100]],
    half: 8, bank: 16, depth: 4, water: 2.6, fall: 0.004, mere: { x: 3100, y: 8100, r: 72, deep: 5 } },
  { name: 'beck', pts: [[4560, 7800], [4690, 7795], [4810, 7805], [4920, 7870], [5040, 7880], [5160, 7960], [5280, 8080], [5400, 8200], [5475, 8330], [5485, 8560], [5480, 8800], [5490, 9040], [5600, 9160], [5720, 9280], [5760, 9320]],
    half: 22, bank: 30, depth: 9, water: 6, fall: 0.004, mere: { x: 5760, y: 9320, r: 230, deep: 9 }, ford: { x: 5040, y: 7880 } },
];
export const WILDS_BECK = WILDS_WATERS[1];

const wbSS = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The course as a smooth line, one point every `step` or so (Catmull-Rom through the given points).
export function beckLine(pts, step = 18) {
  const out = [], P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let k = 0; k < pts.length - 1; k++) {
    const p0 = P(k - 1), p1 = P(k), p2 = P(k + 1), p3 = P(k + 2), n = Math.max(2, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let i = 0; i < n; i++) {
      const t = i / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

// The beck worked out against the ground it crosses. `raw(x, z)` is the ground before any water was cut.
export function makeBeck(raw, B = WILDS_BECK) {
  const line = beckLine(B.pts), n = line.length;
  const sx = new Float32Array(n), sz = new Float32Array(n), sraw = new Float32Array(n), sbed = new Float32Array(n), sat = new Float32Array(n), inMere = new Uint8Array(n);
  let level = null;
  for (let i = 0; i < n; i++) {
    sx[i] = line[i][0]; sz[i] = line[i][1]; sraw[i] = raw(sx[i], sz[i]);
    sat[i] = i ? sat[i - 1] + Math.hypot(sx[i] - sx[i - 1], sz[i] - sz[i - 1]) : 0;
    inMere[i] = Math.hypot(sx[i] - B.mere.x, sz[i] - B.mere.y) < B.mere.r ? 1 : 0;
    if (i === 0) { sbed[0] = sraw[0] - Math.min(2, B.depth); continue; }           // the spring is only a seep
    if (inMere[i]) { if (level === null) level = sbed[i - 1]; sbed[i] = level; continue; }   // the mere lies level
    const step = sat[i] - sat[i - 1];
    sbed[i] = Math.min(sbed[i - 1] - B.fall * step, sraw[i] - B.depth);
  }
  if (level === null) level = sbed[n - 1];
  // a pool stands no higher than the lowest of the ground round it, or it would spill
  { const Mm = B.mere; let rim = Infinity; for (let k = 0; k < 48; k++) for (const f of [1, 1.3]) rim = Math.min(rim, raw(Mm.x + Math.cos(k / 48 * 6.2832) * Mm.r * f, Mm.y + Math.sin(k / 48 * 6.2832) * Mm.r * f));
    if (level + B.water > rim - 0.5) { level = rim - 0.5 - B.water; for (let i = 0; i < n; i++) if (inMere[i]) sbed[i] = level; } }
  const bankOf = (i) => B.half + B.bank + Math.max(0, sraw[i] - sbed[i] - B.depth) * 1.7;
  let reach = 0; for (let i = 0; i < n; i++) reach = Math.max(reach, bankOf(i));
  // which stretch of it is near a given spot, without walking the whole line
  const CELL = 160, grid = new Map();
  for (let i = 0; i < n; i++) {
    for (let a = Math.floor((sx[i] - reach) / CELL); a <= Math.floor((sx[i] + reach) / CELL); a++) for (let b = Math.floor((sz[i] - reach) / CELL); b <= Math.floor((sz[i] + reach) / CELL); b++) {
      const k = a * 4096 + b; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i);
    }
  }
  const hit = { i: -1, d: 0 };
  function nearest(x, z) {
    const l = grid.get(Math.floor(x / CELL) * 4096 + Math.floor(z / CELL)); if (!l) return null;
    let best = -1, bd = Infinity;
    for (let k = 0; k < l.length; k++) { const i = l[k], dx = x - sx[i], dz = z - sz[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    hit.i = best; hit.d = Math.sqrt(bd); return hit;
  }
  const M = B.mere, mereOut = M.r * 1.3;
  // The ground at (x, z) with the water's bed cut into it. `h` is what it was. It only ever lowers.
  function carve(x, z, h) {
    let out = h;
    const dm = Math.hypot(x - M.x, z - M.y);
    if (dm < mereOut) {
      const q = Math.min(1, dm / M.r), floor = level - M.deep * (1 - q * q), k = wbSS(M.r * 0.85, mereOut, dm), v = floor * (1 - k) + h * k;
      if (v < out) out = v;
    }
    const nr = nearest(x, z);
    if (nr) {
      const i = nr.i, d = nr.d, bw = bankOf(i);
      if (d < bw && !(inMere[i] && dm < M.r)) {
        const q = Math.min(1, d / B.half), bed = sbed[i] + q * q * 2.5, k = wbSS(B.half, bw, d), v = bed * (1 - k) + h * k;
        if (v < out) out = v;
      }
    }
    return out;
  }
  // How high the water stands at (x, z), or null where there is none to stand.
  function surfaceAt(x, z) {
    if (Math.hypot(x - M.x, z - M.y) < mereOut) return level + B.water;
    const nr = nearest(x, z);
    return nr && nr.d < bankOf(nr.i) ? sbed[nr.i] + B.water : null;
  }
  // Is (x, z) within `pad` of anything the water has cut?
  function near(x, z, pad) {
    if (Math.hypot(x - M.x, z - M.y) < mereOut + pad) return true;
    // (the grid only knows `reach`: look in the neighbouring cells as well when padded)
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const l = grid.get(Math.floor((x + a * pad) / CELL) * 4096 + Math.floor((z + b * pad) / CELL)); if (!l) continue;
      for (let k = 0; k < l.length; k++) { const i = l[k]; if (Math.hypot(x - sx[i], z - sz[i]) < bankOf(i) + pad) return true; }
    }
    return false;
  }
  // Move (x, z) off the water if it is within `pad` of it: straight out from the nearest of it. Returns [x, z].
  function pushOff(x, z, pad) {
    const dm = Math.hypot(x - M.x, z - M.y);
    if (dm < mereOut + pad) { const k = (mereOut + pad + 10) / (dm || 1); x = M.x + (x - M.x) * k; z = M.y + (z - M.y) * k; }
    for (let go = 0; go < 8; go++) {                       // round a bend, stepping off one stretch can land by the next
      let best = 0, bd = Infinity;
      for (let i = 0; i < n; i++) { const d = Math.hypot(x - sx[i], z - sz[i]); if (d < bd) { bd = d; best = i; } }
      const need = bankOf(best) + pad;
      if (bd >= need) break;
      const k = (need + 10) / (bd || 1); x = sx[best] + (x - sx[best]) * k; z = sz[best] + (z - sz[best]) * k;
    }
    return [x, z];
  }
  return { B, n, sx, sz, sraw, sbed, sat, inMere, level, bankOf, reach, carve, surfaceAt, near, nearest, pushOff };
}

// All the waters as one: the same questions, asked of each.
export function makeWaters(raw, list = WILDS_WATERS) {
  const each = list.map((B) => makeBeck(raw, B));
  return {
    each,
    carve(x, z, h) { for (let i = 0; i < each.length; i++) h = each[i].carve(x, z, h); return h; },
    surfaceAt(x, z) { for (let i = 0; i < each.length; i++) { const s = each[i].surfaceAt(x, z); if (s !== null) return s; } return null; },
    near(x, z, pad) { for (let i = 0; i < each.length; i++) if (each[i].near(x, z, pad)) return true; return false; },
    pushOff(x, z, pad) { for (let i = 0; i < each.length; i++) [x, z] = each[i].pushOff(x, z, pad); return [x, z]; },
  };
}

// The one Wilds' waters: made the first time a height is asked for, from the ground as it was.
let _wbWaters = null, _wbRaw = null;
export function wildsWaters(raw) { if (!_wbWaters || (raw && raw !== _wbRaw)) { _wbRaw = raw || _wbRaw; _wbWaters = makeWaters(_wbRaw); } return _wbWaters; }
export function resetWildsWaters() { _wbWaters = null; }

// Swap the coarse cells of the ground that the water touches for fine ones. `geo` is the ground's PlaneGeometry
// (already turned flat and given its heights), `segs` its cells a side, `at(x, z)` the height at a mesh-space point,
// `wet(x, z, pad)` whether the water comes within pad of it. Where a fine cell meets a coarse one its edge is held to
// the coarse edge's straight line, so nothing gapes; the corners are the coarse mesh's own.
export function refineGround(THREE, geo, segs, at, wet, K = 6) {
  const pos = geo.attributes.position, uv = geo.attributes.uv, nrm = geo.attributes.normal, V = segs + 1;
  const cell = Math.abs(pos.getX(1) - pos.getX(0)), pad = cell * 0.75;
  const fine = new Uint8Array(segs * segs);
  let count = 0;
  for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) {
    const a = i + V * j, c = (i + 1) + V * (j + 1);
    if (wet((pos.getX(a) + pos.getX(c)) / 2, (pos.getZ(a) + pos.getZ(c)) / 2, pad)) { fine[j * segs + i] = 1; count++; }
  }
  if (!count) return 0;
  const isFine = (i, j) => i >= 0 && j >= 0 && i < segs && j < segs && fine[j * segs + i] === 1;
  const extra = count * (K + 1) * (K + 1), n0 = pos.count;
  const P = new Float32Array((n0 + extra) * 3), U = new Float32Array((n0 + extra) * 2), Nn = new Float32Array((n0 + extra) * 3), held = new Uint8Array(n0 + extra);
  P.set(pos.array); U.set(uv.array); Nn.set(nrm.array);
  const col = geo.attributes.color, Cc = col ? new Float32Array((n0 + extra) * 3) : null; if (Cc) Cc.set(col.array);
  const old = geo.index.array, idx = [];
  for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) if (!fine[j * segs + i]) { const o = (j * segs + i) * 6; for (let k = 0; k < 6; k++) idx.push(old[o + k]); }
  let w = n0;
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) {
    if (!fine[j * segs + i]) continue;
    const c00 = i + V * j, c10 = (i + 1) + V * j, c01 = i + V * (j + 1), c11 = (i + 1) + V * (j + 1), base = w;
    const hold = { w: !isFine(i - 1, j), e: !isFine(i + 1, j), n: !isFine(i, j - 1), s: !isFine(i, j + 1) };
    for (let b = 0; b <= K; b++) for (let a = 0; a <= K; a++) {
      const s = a / K, t = b / K, bil = (arr, st, o) => lerp(lerp(arr[c00 * st + o], arr[c10 * st + o], s), lerp(arr[c01 * st + o], arr[c11 * st + o], s), t);
      const x = bil(pos.array, 3, 0), z = bil(pos.array, 3, 2);
      const onHeld = (a === 0 && hold.w) || (a === K && hold.e) || (b === 0 && hold.n) || (b === K && hold.s);
      const corner = (a === 0 || a === K) && (b === 0 || b === K);
      P[w * 3] = x; P[w * 3 + 2] = z; P[w * 3 + 1] = (onHeld || corner) ? bil(pos.array, 3, 1) : at(x, z);
      U[w * 2] = bil(uv.array, 2, 0); U[w * 2 + 1] = bil(uv.array, 2, 1);
      if (Cc) for (let o = 0; o < 3; o++) Cc[w * 3 + o] = bil(col.array, 3, o);
      if (onHeld || corner) { held[w] = 1; let nx = bil(nrm.array, 3, 0), ny = bil(nrm.array, 3, 1), nz = bil(nrm.array, 3, 2); const L = Math.hypot(nx, ny, nz) || 1; Nn[w * 3] = nx / L; Nn[w * 3 + 1] = ny / L; Nn[w * 3 + 2] = nz / L; }
      w++;
    }
    for (let b = 0; b < K; b++) for (let a = 0; a < K; a++) {
      const A = base + a + (K + 1) * b, Bq = base + a + (K + 1) * (b + 1), Cq = base + (a + 1) + (K + 1) * (b + 1), D = base + (a + 1) + (K + 1) * b;
      idx.push(A, Bq, D, Bq, Cq, D);
    }
  }
  // the coarse mesh's own normals are kept as they were (they were averaged over cells that are now gone), and so
  // are the held edges': only the inside of the fine cells is shaded afresh
  const keep = Nn.slice();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); geo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  if (Cc) geo.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const out = geo.attributes.normal.array;
  for (let v = 0; v < n0 + extra; v++) if (v < n0 || held[v]) { out[v * 3] = keep[v * 3]; out[v * 3 + 1] = keep[v * 3 + 1]; out[v * 3 + 2] = keep[v * 3 + 2]; }
  geo.attributes.normal.needsUpdate = true;
  return count;
}

const WB_FRAG = `
uniform sampler2D uWN; uniform float uWT; uniform vec3 uWSky; uniform float uWRun;
varying float vWD; varying float vWE; varying vec2 vWF; varying vec3 vWV;
vec4 wildsWater() {
  float n1 = texture2D(uWN, vec2(vWF.y * 1.3, vWF.x - uWT * 0.11 * uWRun)).r;
  float n2 = texture2D(uWN, vec2(vWF.y * 2.1 + 0.4, vWF.x * 1.7 - uWT * 0.19 * uWRun)).g;
  float n3 = texture2D(uWN, vec2(vWF.y * 5.0 + uWT * 0.02, vWF.x * 4.0 - uWT * 0.31 * uWRun)).b;
  float rip = n1 * 0.55 + n2 * 0.45;
  float d = clamp(vWD / 10.0, 0.0, 1.0);
  vec3 c = mix(vec3(0.110, 0.290, 0.250), vec3(0.020, 0.115, 0.150), smoothstep(0.0, 1.0, d));   // the bed shows through the shallows
  c *= 0.72 + 0.56 * rip;                                           // darker troughs, lighter backs
  float low = pow(1.0 - clamp(normalize(vWV).y, 0.0, 1.0), 4.0);
  c = mix(c, mix(uWSky, vec3(0.300, 0.520, 0.560), 0.55), low * 0.34);                                    // the sky lies in it, seen at a low angle
  c += smoothstep(0.80, 0.93, n3 * (0.5 + rip)) * 0.13;             // glints
  float foam = (1.0 - smoothstep(0.2, 1.6, vWD)) * smoothstep(0.42, 0.70, rip + (n3 - 0.5) * 0.4);
  c = mix(c, vec3(0.780, 0.840, 0.820), foam * 0.6);                // and it frets white where it shoals
  return vec4(c, clamp(vWD / 1.5, 0.0, 1.0) * vWE * mix(0.66, 0.93, d));
}
`;

function wbMaterial(THREE, U, run) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWN = U.uWN; sh.uniforms.uWT = U.uWT; sh.uniforms.uWSky = U.uWSky; sh.uniforms.uWRun = { value: run };
    sh.vertexShader = 'attribute float aDepth; attribute float aEdge; attribute vec2 aFlow; varying float vWD; varying float vWE; varying vec2 vWF; varying vec3 vWV;\n'
      + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWD = aDepth; vWE = aEdge; vWF = aFlow; vWV = cameraPosition - (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = WB_FRAG + sh.fragmentShader.replace('#include <map_fragment>', 'vec4 wW = wildsWater(); diffuseColor.rgb = wW.rgb; diffuseColor.a = wW.a;');
  };
  m.customProgramCacheKey = () => 'wildsWater3_' + run;
  return m;
}

// Everything that is drawn of it. `heightAt` is the carved ground. Returns { update(t, sky), group }.
export function buildWildsWater(THREE, scene, beck, heightAt, noiseTex, quality) {
  const B = beck.B, M = B.mere, group = new THREE.Group(); group.name = 'wildsWater';
  const U = { uWN: { value: noiseTex }, uWT: { value: 0 }, uWSky: { value: new THREE.Color(0x9aa6b4) } };
  const mesh = (P, D, E, F, I, run) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(D, 1));
    g.setAttribute('aEdge', new THREE.Float32BufferAttribute(E, 1)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(F, 2));
    g.setIndex(I); g.computeVertexNormals();
    if (g.attributes.normal.getY(Math.min(8, P.length / 3 - 1)) < 0) { for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; } g.setIndex(I); g.computeVertexNormals(); }   // face up, whichever way the course ran
    const m = new THREE.Mesh(g, wbMaterial(THREE, U, run)); m.renderOrder = 2; m.receiveShadow = false; m.castShadow = false; m.userData.noShadowCaster = true;
    group.add(m); return m;
  };
  // the beck: a ribbon along the line, seven across; the ground hides whatever of it lies under the banks
  { const P = [], D = [], E = [], F = [], I = [], ACROSS = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1];
    let rows = 0;
    for (let i = 0; i < beck.n; i++) {
      const dm = Math.hypot(beck.sx[i] - M.x, beck.sz[i] - M.y);
      if (dm < M.r * 0.86) { rows = 0; continue; }                                      // the mere has its own water
      const a = Math.max(0, i - 1), b = Math.min(beck.n - 1, i + 1), tx = beck.sx[b] - beck.sx[a], tz = beck.sz[b] - beck.sz[a], L = Math.hypot(tx, tz) || 1;
      const nx = -tz / L, nz = tx / L, W = B.half + B.bank * 0.55 + (beck.bankOf(i) - B.half - B.bank) * 0.6, y = beck.sbed[i] + B.water;
      const endFade = Math.min(1, i / 5, (beck.n - 1 - i) / 3) * (dm < M.r * 1.05 ? Math.max(0, (dm - M.r * 0.86) / (M.r * 0.19)) : 1);
      for (const q of ACROSS) {
        const x = beck.sx[i] + nx * W * q, z = beck.sz[i] + nz * W * q;
        P.push(x, y, z); D.push(Math.max(0, y - heightAt(x, z))); E.push((1 - Math.pow(Math.abs(q), 3)) * endFade); F.push(beck.sat[i] / 90, q * W / 90);
      }
      if (rows > 0) { const o = P.length / 3 - 14; for (let k = 0; k < 6; k++) I.push(o + k, o + k + 7, o + k + 1, o + k + 1, o + k + 7, o + k + 8); }
      rows++;
    }
    mesh(P, D, E, F, I, 1);
  }
  // the mere: rings out from the middle to a little past its shore
  { const P = [], D = [], E = [], F = [], I = [], RINGS = 8, SEG = 40, R = M.r * 1.32, y = beck.level + B.water;
    P.push(M.x, y, M.y); D.push(Math.max(0, y - heightAt(M.x, M.y))); E.push(1); F.push(M.x / 120, M.y / 120);
    for (let r = 1; r <= RINGS; r++) for (let s = 0; s < SEG; s++) {
      const a = s / SEG * Math.PI * 2, rr = R * r / RINGS, x = M.x + Math.cos(a) * rr, z = M.y + Math.sin(a) * rr;
      P.push(x, y, z); D.push(Math.max(0, y - heightAt(x, z))); E.push(r === RINGS ? 0 : 1); F.push(x / 120, z / 120);
    }
    for (let s = 0; s < SEG; s++) I.push(0, 1 + (s + 1) % SEG, 1 + s);
    for (let r = 1; r < RINGS; r++) for (let s = 0; s < SEG; s++) { const a = 1 + (r - 1) * SEG + s, b = 1 + (r - 1) * SEG + (s + 1) % SEG, c = a + SEG, d = b + SEG; I.push(a, b, c, b, d, c); }
    mesh(P, D, E, F, I, 0.22);
  }
  // five stones at the ford, set across the water where the track comes down to it
  if (B.ford) { const i0 = beck.nearest(B.ford.x, B.ford.y); const i = i0 ? i0.i : 0, a = Math.max(0, i - 1), b = Math.min(beck.n - 1, i + 1);
    const tx = beck.sx[b] - beck.sx[a], tz = beck.sz[b] - beck.sz[a], L = Math.hypot(tx, tz) || 1, nx = -tz / L, nz = tx / L, y = beck.sbed[i] + B.water;
    const mat = new THREE.MeshLambertMaterial({ color: 0x8b8a84 });
    for (let k = -2; k <= 2; k++) {
      const r = 7.5 + ((k * 37) % 5 + 5) % 5 * 0.5, s = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r, 4.5, 7), mat);
      s.position.set(beck.sx[i] + nx * k * 13 + tx / L * ((k * 3) % 4 - 1.5), y - 0.6, beck.sz[i] + nz * k * 13 + tz / L * ((k * 3) % 4 - 1.5));
      s.rotation.y = k * 1.3; s.scale.z = 0.82; s.castShadow = true; s.receiveShadow = true; group.add(s);
    }
  }
  // reeds and reedmace, standing where the water is a hand deep or less
  let reeds = null;
  const want = quality === 'low' ? 0 : quality === 'medium' ? 0.5 : 1;
  if (want) {
    const hash = (i, k) => { const s = Math.sin(i * 91.7 + k * 47.3) * 43758.5453; return s - Math.floor(s); };
    const spots = [];
    const tryAt = (x, z, key) => { const s = beck.surfaceAt(x, z); if (s === null) return; const d = s - heightAt(x, z); if (d > -1.5 && d < 3.2 && hash(key, 9) < want) spots.push([x, z, s - Math.max(0, d), key]); };
    for (let i = 6; i < beck.n - 2; i += 1) {
      if (B.ford && Math.hypot(beck.sx[i] - B.ford.x, beck.sz[i] - B.ford.y) < 70) continue;                   // the ford is kept open
      if (hash(i, 1) > 0.34) continue;
      const a = Math.max(0, i - 1), b = Math.min(beck.n - 1, i + 1), tx = beck.sx[b] - beck.sx[a], tz = beck.sz[b] - beck.sz[a], L = Math.hypot(tx, tz) || 1, side = hash(i, 2) < 0.5 ? -1 : 1;
      for (let c = 0; c < 3; c++) { const off = B.half * (0.72 + hash(i, 3 + c) * 0.62); tryAt(beck.sx[i] - tz / L * off * side + (hash(i, 6 + c) - 0.5) * 14, beck.sz[i] + tx / L * off * side + (hash(i, 7 + c) - 0.5) * 14, i * 10 + c); }
    }
    for (let k = 0; k < Math.round(M.r * 1.1); k++) { const a = hash(k, 11) * Math.PI * 2, r = M.r * (0.9 + hash(k, 12) * 0.36); tryAt(M.x + Math.cos(a) * r, M.y + Math.sin(a) * r, 5000 + k); }
    if (spots.length) {
      const r = (k) => hash(k, 21), P = [], Nn = [], C = [], T = [];
      for (let bl = 0; bl < 7; bl++) {                       // seven leaves, and two of them carry a brown head
        const a = bl * 0.9 + r(bl) * 0.6, out = r(bl + 9) * 3, h = 17 + r(bl + 20) * 14, lean = 1.5 + r(bl + 30) * 4.5, w = 0.55 + r(bl + 40) * 0.4;
        const cx = Math.cos(a) * out, cz = Math.sin(a) * out, px = -Math.sin(a) * w, pz = Math.cos(a) * w, tx = cx + Math.cos(a) * lean, tz = cz + Math.sin(a) * lean;
        P.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, tx, h, tz);
        for (let v = 0; v < 3; v++) { Nn.push(0, 1, 0); const g = v === 2 ? 1.15 : 0.55; C.push(0.34 * g, 0.44 * g, 0.20 * g); T.push(v === 2 ? 1 : 0); }
        if (bl < 2) {                                         // the head: a short dark spindle near the top
          const y0 = h * 0.74, y1 = h * 0.96, f0 = 0.74, f1 = 0.96, hw = 1.0;
          const at = (f) => [cx + (tx - cx) * f, cz + (tz - cz) * f];
          const [x0, z0] = at(f0), [x1, z1] = at(f1);
          for (const [qx, qz] of [[px / w, pz / w], [Math.cos(a), Math.sin(a)]]) {
            P.push(x0 - qx * hw, y0, z0 - qz * hw, x0 + qx * hw, y0, z0 + qz * hw, x1, y1, z1, x0 - qx * hw, y0, z0 - qz * hw, x1, y1, z1, x0 + qx * hw, y0, z0 + qz * hw);
            for (let v = 0; v < 6; v++) { Nn.push(0, 1, 0); C.push(0.26, 0.15, 0.08); T.push(0.8); }
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('aTip', new THREE.Float32BufferAttribute(T, 1));
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uWT = U.uWT;
        sh.vertexShader = 'attribute float aTip; uniform float uWT;\n' + sh.vertexShader.replace('#include <lights_lambert_vertex>', '#include <lights_lambert_vertex>\n  #ifdef DOUBLE_SIDED\n    vLightBack = vLightFront; vIndirectBack = vIndirectFront;\n  #endif').replace('#include <project_vertex>', `
  vec4 rW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    vec4 rO = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    rW = instanceMatrix * rW;
    float rS = sin(uWT * 1.3 + rO.x * 0.017 + rO.z * 0.013) * 0.7 + sin(uWT * 2.3 + rO.z * 0.04) * 0.3;
    rW.x += aTip * rS * 2.6; rW.z += aTip * rS * 1.4;
  #endif
  vec4 mvPosition = modelViewMatrix * rW;
  gl_Position = projectionMatrix * mvPosition;`);
      };
      mat.customProgramCacheKey = () => 'wildsReeds1';
      reeds = new THREE.InstancedMesh(g, mat, spots.length);
      reeds.name = 'wildsReeds'; reeds.frustumCulled = false; reeds.castShadow = false; reeds.userData.noShadowCaster = true;
      const d = new THREE.Object3D();
      spots.forEach(([x, z, y, key], k) => { const s = 0.75 + hash(key, 31) * 0.6; d.position.set(x, y - 1.5, z); d.rotation.set(0, hash(key, 32) * 6.283, 0); d.scale.set(s, s * (0.85 + hash(key, 33) * 0.4), s); d.updateMatrix(); reeds.setMatrixAt(k, d.matrix); });
      group.add(reeds);
    }
  }
  scene.add(group);
  return {
    group, reeds: reeds ? reeds.count : 0,
    update(t, sky, tint) { U.uWT.value = t; if (sky) U.uWSky.value.copy(sky); if (reeds && tint) reeds.material.color.copy(tint); },
  };
}
