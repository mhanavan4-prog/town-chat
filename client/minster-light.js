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
export const MINSTER_LIGHTS = { low: 1, medium: 3, high: 5 };

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

// Dress the minster `g` (already placed in `scene`). at(mx, my, mz) turns a place in the model into one in the world.
// Returns tick(seconds), to be called every frame while the Wastes are on screen.
export function dressMinster(THREE, scene, g, at, { quality = 'high', glowTex, unit = 250 } = {}) {
  // stone, and no hatching
  g.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.receiveShadow = false;
    const one = (mt) => ((mt.emissive && mt.emissive.getHex() !== 0) || /glow/i.test(mt.name || '') || quality === 'low' ? mt : minsterStone(mt));
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
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
    const pool = new THREE.Mesh(new THREE.CircleGeometry(unit * 9.5, 40), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff9440, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(mid.x, 4, mid.z); pool.renderOrder = 2; scene.add(pool);
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
  for (const [w, color, power, reach] of want.slice(0, MINSTER_LIGHTS[quality] || 1)) {
    const l = new THREE.PointLight(color, power, reach, 1.6); l.position.set(w.x, w.y, w.z); scene.add(l);
    lights.push({ l, base: power, k: 2.1 + lights.length * 1.3 });
  }
  return function tick(t) {
    for (const f of flick) f.s.material.opacity = f.base * (1 - f.amp * 0.5 + f.amp * 0.5 * Math.sin(t * f.k) * Math.sin(t * f.k * 0.37 + f.k));
    for (const f of lights) f.l.intensity = f.base * (0.9 + 0.1 * Math.sin(t * f.k) * Math.sin(t * 1.7 + f.k));
  };
}
