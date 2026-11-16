// Ashminster by night: the one place in the Ember Wastes that is lit, to be seen from a long way off and steered by.
//
// Two things are done to the minster's model once it is set down (client/ember-scene.js):
//   - its stone is drawn as stone: coursed blocks with mortar between them, each block a shade of its own, soot
//     run down from the wall-heads, slates on the roofs. The model's walls are flat slabs; the courses are worked
//     out in the shader from where each fragment stands in the world, so they cost no geometry.
//   - it is lit: a lantern in the belfry with a pale beam standing over it, lamps at the west door, candles down
//     the nave and on the altar, the east window, and warm light lying on the ground all round.
// It also stops taking shadows from the sky's light: across a model this big they broke up into a hatched moire
// on any wall the light ran along. It still casts them.
//
// The game's own dressing; nothing here is from the record.

// Where the lights are, in the model's own plan (x along the nave: tower west at -x; y: + is the breached side;
// z up), in model units. tools/models/build_home.py minster() has the same places.
export const MINSTER_FLAMES = {
  belfry: [-4.15, 0, 5.4],
  door: [[-5.72, -0.78, 1.34], [-5.72, 0.78, 1.34]],
  altar: [[2.62, -0.36, 0.69], [2.62, 0.36, 0.69]],
  nave: [[-2.3, -1.12], [-2.3, 1.12], [-1.2, -1.12], [-1.2, 1.12], [-0.1, -1.12], [-0.1, 1.12], [1.0, -1.12], [2.1, -1.12]].map(([x, y]) => [x, y, 0.9]),
  eastWindow: [4.95, 0, 1.5],
  // the windows with candle-light behind them: the nave's whole side, the chancel's two sides, the transept's end
  windows: [[-2.4, -1.66, 1.6], [-1.3, -1.66, 1.6], [-0.2, -1.66, 1.6], [0.9, -1.66, 1.6], [3.4, -1.3, 1.2], [4.2, -1.3, 1.2], [3.4, 1.3, 1.2], [4.2, 1.3, 1.2], [2.6, -2.9, 1.45]],
};
// How many real lights each quality gets (the rest is glow, which costs nothing to the other shaders).
// Kept few: every real light is paid for by every lit surface in the Wastes, near it or not. Medium has no more than
// the Wastes had before the minster was lit (this one replaces the old east-window lamp).
export const MINSTER_LIGHTS = { low: 0, medium: 1, high: 3 };

const MN_VERT_DECL = 'varying vec3 vMnW; varying vec3 vMnN;\n';
const MN_FRAG = `
  {
    vec3 an = abs(normalize(vMnN));
    float mnFade = 1.0 - smoothstep(1500.0, 3200.0, distance(vMnW, cameraPosition));   // no shimmer far off
    float mnK = 1.0;
    // timber, glass and flame are left as they are: only what is grey is stone
    bool mnStone = diffuseColor.r < diffuseColor.b * 1.7;
    if (!mnStone) { mnK = 1.0; } else if (an.y < 0.55) {
      // a wall: courses 34 high, blocks 80 long, every other course set half a block along
      float along = an.x > an.z ? vMnW.z : vMnW.x;
      float cy = vMnW.y / 34.0, row = floor(cy);
      float u = along / 80.0 + mod(row, 2.0) * 0.5, col = floor(u);
      float fy = fract(cy), fx = fract(u);
      float joint = smoothstep(0.0, 0.08, fy) * smoothstep(1.0, 0.92, fy) * smoothstep(0.0, 0.035, fx) * smoothstep(1.0, 0.965, fx);
      float h = fract(sin(dot(vec2(col, row), vec2(127.1, 311.7))) * 43758.5453);
      mnK = mix(0.58, 1.0, joint) * (0.84 + 0.3 * h);
      // soot, run down from the wall-head in streaks and thick at the foot
      float st = fract(sin(floor(along / 21.0) * 91.7) * 4375.5);
      mnK *= 1.0 - 0.2 * smoothstep(0.5, 1.0, st) * (0.4 + 0.6 * fract(cy * 0.11 + st));
      mnK *= 0.82 + 0.18 * smoothstep(0.0, 260.0, vMnW.y);
    } else if (an.y < 0.97) {
      // a roof: slates in rows, each row lapping the one below
      float ry = vMnW.y / 20.0, row = floor(ry);
      float along = an.x > an.z ? vMnW.z : vMnW.x;
      float u = along / 30.0 + mod(row, 2.0) * 0.5;
      float lap = smoothstep(0.0, 0.16, fract(ry)) * smoothstep(0.0, 0.07, fract(u));
      float h = fract(sin(dot(vec2(floor(u), row), vec2(41.3, 289.1))) * 43758.5453);
      mnK = mix(0.6, 1.0, lap) * (0.86 + 0.26 * h);
    }
    diffuseColor.rgb *= mix(1.0, mnK, mnFade);
  }
`;
// Draw this material as coursed stone (walls) and slates (roofs). Returns the material it should be replaced with.
export function minsterStone(mat) {
  const m = mat.clone();
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = MN_VERT_DECL + sh.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  vMnN = mat3(modelMatrix) * objectNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vMnW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = MN_VERT_DECL + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + MN_FRAG);
  };
  m.customProgramCacheKey = () => 'minster-stone';
  return m;
}

// Stone, and no hatching: any of the Wastes' stone-built models (the minster, the town's ruined houses, its crosses,
// the ring's stones) drawn in courses, and no longer taking the sky light's shadows. One patched copy is kept of
// each material, however many models share it.
const _mnStoneOf = new Map();
export function dressStone(g, quality = 'high') {
  g.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.receiveShadow = false;
    const one = (mt) => {
      if ((mt.emissive && mt.emissive.getHex() !== 0) || /glow/i.test(mt.name || '') || quality === 'low') return mt;
      if (!_mnStoneOf.has(mt)) _mnStoneOf.set(mt, minsterStone(mt));
      return _mnStoneOf.get(mt);
    };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
}

// Dress the minster `g` (already placed in `scene`). at(mx, my, mz) turns a place in the model into one in the world.
// Returns tick(seconds), to be called every frame while the Wastes are on screen.
// The paved yard (tools/models/build_home.py: 11.6 by 7.0 units about x = -0.35, 0.026 proud of the ground), in model units.
export const MINSTER_YARD = { cx: -0.35, cy: 0, hx: 5.8, hy: 3.5, top: 0.026 };
// how far the banked ash runs out from the yard's edge, and how far the cooled crust runs beyond that (model units)
export const YARD_BANK = 0.42, YARD_CRUST = 1.7;

// The yard's edge, walked round: [x, y, nx, ny] in model units, the corners turned in a few steps.
export function yardEdge(step = 0.3) {
  const { cx, cy, hx, hy } = MINSTER_YARD, out = [];
  const side = (x0, y0, x1, y1, nx, ny) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / step)); for (let i = 0; i < n; i++) { const t = i / n; out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, nx, ny]); } };
  const corner = (x, y, a0) => { for (let i = 0; i <= 4; i++) { const a = a0 + (i / 4) * Math.PI / 2; out.push([x, y, Math.cos(a), Math.sin(a)]); } };
  side(cx - hx, cy - hy, cx + hx, cy - hy, 0, -1); corner(cx + hx, cy - hy, -Math.PI / 2);
  side(cx + hx, cy - hy, cx + hx, cy + hy, 1, 0);  corner(cx + hx, cy + hy, 0);
  side(cx + hx, cy + hy, cx - hx, cy + hy, 0, 1);  corner(cx - hx, cy + hy, Math.PI / 2);
  side(cx - hx, cy + hy, cx - hx, cy - hy, -1, 0); corner(cx - hx, cy - hy, Math.PI);
  return out;
}

// The yard was a flat plate with a straight dark edge standing over bright lava, and read as a board in the air.
// Now ash and cinder are banked up against it all round, and the fire in the ground has gone cold for a way out
// from it: the pavement comes up out of dead ground, and the dead ground out of the burning.
export function bankYard(THREE, scene, at, unit = 250) {
  const edge = yardEdge(), n = edge.length;
  let sd = 0x7a11 >>> 0; const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const topY = MINSTER_YARD.top * unit;
  // the bank: three courses of points, the pavement's lip, the shoulder, the toe
  const pos = [], col = [], idx = [];
  const C = [[0.33, 0.35, 0.36], [0.24, 0.2, 0.17], [0.12, 0.085, 0.07]];
  const toe = [];
  for (let i = 0; i < n; i++) {
    const [x, y, nx, ny] = edge[i];
    const reach = YARD_BANK * (0.55 + rnd() * 0.9), lump = 0.5 + rnd() * 0.5;
    const rows = [[-0.03, topY + 0.4], [reach * 0.45, topY * (0.55 + 0.6 * lump)], [reach, 0.6]];
    rows.forEach(([d, h], r) => {
      const w = at(x + nx * d, y + ny * d, 0);
      pos.push(w.x, h, w.z);
      const k = 0.85 + rnd() * 0.3; col.push(C[r][0] * k, C[r][1] * k, C[r][2] * k);
    });
    toe.push(reach);
    const a = i * 3, b = ((i + 1) % n) * 3;
    for (let r = 0; r < 2; r++) idx.push(a + r, a + r + 1, b + r, b + r, a + r + 1, b + r + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const bank = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
  scene.add(bank);
  // the cold crust beyond it: dark at the bank's toe, thinning to nothing, ragged along its length
  const W = 64, H = 16, px = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const v = j / (H - 1), rag = 0.72 + 0.28 * Math.sin(i * 0.61) * Math.sin(i * 0.23 + 1.3) + (rnd() - 0.5) * 0.12;
    const a = Math.max(0, Math.min(1, Math.pow(1 - v, 1.4) * 1.05 * rag + (v < 0.25 ? 0.25 : 0)));
    const o = (j * W + i) * 4; px[o] = 20; px[o + 1] = 13; px[o + 2] = 10; px[o + 3] = Math.round(a * 235);
  }
  const tex = new THREE.DataTexture(px, W, H, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const cp = [], cu = [], ci = [];
  for (let i = 0; i <= n; i++) {
    const [x, y, nx, ny] = edge[i % n], t = toe[i % n];
    const a0 = at(x + nx * (t - 0.06), y + ny * (t - 0.06), 0), a1 = at(x + nx * (t + YARD_CRUST), y + ny * (t + YARD_CRUST), 0);
    cp.push(a0.x, 1.1, a0.z, a1.x, 1.1, a1.z); cu.push(i / 9, 0, i / 9, 1);
    if (i < n) { const a = i * 2; ci.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  cg.setAttribute('uv', new THREE.Float32BufferAttribute(cu, 2));
  cg.setIndex(ci);
  const crust = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  crust.renderOrder = 1; scene.add(crust);
  return { bank, crust };
}

export function dressMinster(THREE, scene, g, at, { quality = 'high', glowTex, unit = 250 } = {}) {
  dressStone(g, quality);
  bankYard(THREE, scene, at, unit);
  const F = MINSTER_FLAMES, flick = [];
  const glow = (p, size, color, opacity, far) => {
    if (!glowTex) return null;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: !far }));
    s.scale.set(size, size, 1); s.position.copy(p); scene.add(s);
    flick.push({ s, base: opacity, k: 3 + flick.length * 1.7, amp: far ? 0.08 : 0.22 });
    return s;
  };
  const P = (a) => { const w = at(a[0], a[1], a[2]); return new THREE.Vector3(w.x, w.y, w.z); };
  // the belfry lantern: the light to steer by. Its glow is not fogged, so it shows from right across the field.
  const belfry = P(F.belfry);
  glow(belfry, unit * 2.6, 0xffc070, 0.75, true);
  glow(belfry, unit * 7, 0xff9a40, 0.16, true);
  if (glowTex) { // a pale beam standing over the tower
    const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a0, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    beam.scale.set(unit * 0.9, unit * 14, 1); beam.position.set(belfry.x, belfry.y + unit * 5.5, belfry.z); scene.add(beam);
    flick.push({ s: beam, base: 0.2, k: 0.7, amp: 0.25 });
  }
  for (const d of F.door) { const p = P(d); glow(p, unit * 0.9, 0xffb860, 0.8); }
  for (const d of F.altar) { const p = P(d); glow(p, unit * 0.5, 0xffd890, 0.85); }
  for (const d of F.nave) { const p = P(d); glow(p, unit * 0.42, 0xffc878, 0.8); }
  glow(P(F.eastWindow), unit * 3.4, 0xff9a50, 0.4);
  for (const d of F.windows) glow(P(d), unit * 1.5, 0xffa040, 0.42);
  // warm light on the ground all round: the place stands in a pool of it
  if (glowTex) {
    const mid = at(0.2, 0, 0);
    // (not fogged: from out on the field the lit ground is what shows the minster standing on something)
    const poolMat = (op) => new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff9440, transparent: true, opacity: op, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    // on the field, lying on the ground itself (a sheet of light hung above it cut every foot and stone at the ankle)
    const field = new THREE.Mesh(new THREE.CircleGeometry(unit * 9.5, 40), poolMat(0.3));
    field.rotation.x = -Math.PI / 2; field.position.set(mid.x, 2.6, mid.z); field.renderOrder = 2; scene.add(field);
    // and on the pavement, just over it and a little wider, so the light runs out over the banked edge
    const yc = at(MINSTER_YARD.cx, MINSTER_YARD.cy, 0);
    const paved = new THREE.Mesh(new THREE.PlaneGeometry(unit * MINSTER_YARD.hx * 2 * 1.3, unit * MINSTER_YARD.hy * 2 * 1.45), poolMat(0.36));
    paved.rotation.x = -Math.PI / 2; paved.position.set(yc.x, MINSTER_YARD.top * unit + 0.9, yc.z); paved.renderOrder = 2; scene.add(paved);
  }
  // real lights, as many as the quality allows: the nave first, then the door, the altar end, the belfry, the west bays
  const want = [
    [at(0.2, 0, 1.5), 0xffb060, 1.5, unit * 6.5],
    [at(-6.0, 0, 1.2), 0xffb868, 1.2, unit * 4.5],
    [at(2.2, 0, 1.0), 0xffd090, 1.1, unit * 4],
    [at(-4.15, -1.6, 5.2), 0xffc070, 0.9, unit * 7],
    [at(-2.0, 0, 1.4), 0xffb060, 1.0, unit * 5],
  ];
  const lights = [];
  for (const [w, color, power, reach] of want.slice(0, MINSTER_LIGHTS[quality] || 0)) {
    const l = new THREE.PointLight(color, power, reach, 1.6); l.position.set(w.x, w.y, w.z); scene.add(l);
    lights.push({ l, base: power, k: 2.1 + lights.length * 1.3 });
  }
  return function tick(t) {
    for (const f of flick) f.s.material.opacity = f.base * (1 - f.amp * 0.5 + f.amp * 0.5 * Math.sin(t * f.k) * Math.sin(t * f.k * 0.37 + f.k));
    for (const f of lights) f.l.intensity = f.base * (0.9 + 0.1 * Math.sin(t * f.k) * Math.sin(t * 1.7 + f.k));
  };
}

// ── The town south of the minster: lamps down the one street and round the square ───────────────────────────────
// Where they stand, from the town's middle (x east, y south). The street runs south from the square to the barricade;
// the last two stand either side of the breach in the minster's wall.
export const TOWN_LAMPS = [[-190, 3380], [190, 3060], [-190, 2740], [200, 2420], [-330, 2060], [330, 1840], [-210, 1500], [210, 1180], [-560, 500], [60, 500]];
export const TOWN_LIGHTS = { low: 0, medium: 0, high: 1 };
// Set the lamps down. Returns tick(seconds).
export function lightTown(THREE, scene, mid, { quality = 'high', glowTex } = {}) {
  const iron = new THREE.MeshLambertMaterial({ color: 0x1c1a1a }), flame = new THREE.MeshBasicMaterial({ color: 0xffc878 });
  const pole = new THREE.CylinderGeometry(3, 4.5, 150, 6), arm = new THREE.BoxGeometry(34, 4, 4), box = new THREE.BoxGeometry(13, 18, 13), cap = new THREE.ConeGeometry(11, 9, 4);
  const flick = [];
  TOWN_LAMPS.forEach(([dx, dy], i) => {
    const x = mid.x + dx, z = mid.y + dy, side = dx < 0 ? 1 : -1;       // the lantern hangs toward the street
    const add = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); scene.add(m); return m; };
    add(pole, iron, x, 75, z); add(arm, iron, x + side * 15, 146, z); add(box, flame, x + side * 30, 132, z); add(cap, iron, x + side * 30, 146, z).rotation.y = Math.PI / 4;
    if (glowTex) {
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb860, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.scale.set(150, 150, 1); g.position.set(x + side * 30, 132, z); scene.add(g);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(230, 20), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff9a48, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(x + side * 30, 3.2, z); pool.renderOrder = 2; scene.add(pool);
      flick.push({ a: g.material, b: pool.material, k: 2.3 + i * 0.9 });
    }
  });
  // a real light or two, where they will show most: the square, and the breach
  const lights = [];
  for (const [dx, dy] of [[0, 1950], [-250, 520]].slice(0, TOWN_LIGHTS[quality] || 0)) {
    const l = new THREE.PointLight(0xffb060, 1.1, 1100, 1.6); l.position.set(mid.x + dx, 170, mid.y + dy); scene.add(l); lights.push(l);
  }
  return function tick(t) {
    for (const f of flick) { const k = 0.9 + 0.1 * Math.sin(t * f.k) * Math.sin(t * 1.3 + f.k); f.a.opacity = 0.8 * k; f.b.opacity = 0.4 * k; }
    for (let i = 0; i < lights.length; i++) lights[i].intensity = 1.1 * (0.92 + 0.08 * Math.sin(t * (2 + i)));
  };
}

// ── The witches' ring: the elder alive in the middle of it ──────────────────────────────────────────────────────
export const RING_MOTES = 40;
// A green glow in the elder's head, moss at its foot, light lying on the ground inside the stones, and motes
// drifting up through the leaves. `lamp` is the ring's own light (it breathes with the rest). Returns tick(seconds).
export function quickenRing(THREE, scene, at, { glowTex, lamp = null, stoneR = 560 } = {}) {
  const moss = new THREE.Mesh(new THREE.CircleGeometry(190, 24), new THREE.MeshLambertMaterial({ color: 0x3f7a2c, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  moss.rotation.x = -Math.PI / 2; moss.position.set(at.x, 2.6, at.y); scene.add(moss);
  const mats = [];
  if (glowTex) {
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x8fe070, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    head.scale.set(620, 520, 1); head.position.set(at.x, 230, at.y); scene.add(head); mats.push([head.material, 0.5]);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(stoneR * 0.95, 36), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x6fd060, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(at.x, 3.4, at.y); pool.renderOrder = 2; scene.add(pool); mats.push([pool.material, 0.32]);
  }
  const pos = new Float32Array(RING_MOTES * 3), seed = new Float32Array(RING_MOTES);
  for (let i = 0; i < RING_MOTES; i++) seed[i] = (i * 0.6180339887) % 1;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(geo, new THREE.PointsMaterial({ size: 9, map: glowTex || null, color: 0xc8ff9a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.frustumCulled = false; scene.add(motes);
  const lampBase = lamp ? lamp.intensity : 0;
  return function tick(t) {
    for (let i = 0; i < RING_MOTES; i++) {
      const s = seed[i], life = (t * (0.05 + 0.05 * s) + s * 9.0) % 1, a = s * 6.283 * 3 + t * (0.1 + 0.2 * s), r = 40 + 190 * ((s * 7.3) % 1);
      pos[i * 3] = at.x + Math.cos(a) * r; pos[i * 3 + 1] = 20 + life * 330; pos[i * 3 + 2] = at.y + Math.sin(a) * r;
    }
    geo.attributes.position.needsUpdate = true;
    const br = 0.85 + 0.15 * Math.sin(t * 0.8);
    for (const [m, base] of mats) m.opacity = base * br;
    if (lamp) lamp.intensity = lampBase * br;
  };
}
