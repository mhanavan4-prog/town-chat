import { layRoadStones } from './road-stones.js';
import { bakeGeometry } from './bake-geometry.js';
// ---------------------------------------------------------------------------
// Ember Wastes scene (Tier 3.4 Phase C, 3D slice) — the Wilds-styled hostile
// outdoor map behind the temple portal. THREE global; prop-helpers + EMBER_WORLD
// injected; scene/camera/kiosk-lists/mob-visuals written back via get/set.
// ---------------------------------------------------------------------------
export default function createEmberScene({ makeGrassTexture, makeEmberFloorTexture, makeRock, makeTree, buildPortalMesh, EMBER_WORLD, emberHeightAt, KK, makeGlowTexture, setEmberAmbient, setEmberScene, setEmberCamera, getEmberStaticKiosks, setEmberStaticKiosks, setEmberKiosks, getEmberMobVisuals, setEmberMobVisuals, getEmberLandmarks, makeNpcNameSprite, createStaticNpc }) {
const H = (x, z) => (typeof emberHeightAt === 'function' ? emberHeightAt(x, z) : 0);
// Burnt-over any mesh: pull its colours toward charcoal/scorch so KayKit's
// bright pack tints read as ember-scorched without needing new textures.
function scorch(group, amt) {
  group.traverse(c => {
    if (c.isMesh && c.material) {
      // Preserve single-vs-array material shape: a mesh with no geometry groups
      // and a one-element material array draws nothing, so unwrap back to a bare
      // material when the original was not an array.
      const wasArr = Array.isArray(c.material);
      const mats = wasArr ? c.material : [c.material];
      const cloned = mats.map(mm => {
        const m = mm.clone();
        if (m.color) { m.color.offsetHSL(-0.02, -0.18, -(amt || 0.14)); m.color.lerp(new THREE.Color(0x2a1810), 0.22); }
        return m;
      });
      c.material = wasArr ? cloned : cloned[0];
    }
  });
  return group;
}
// Collapse a crowd of identical scorched props into ONE InstancedMesh per model
// (a single draw call instead of one per prop). The scorch is applied once to a
// size-1 reference and baked into the shared material; each prop's scale, turn
// and spot go into its instance matrix. `items` is [{x,y,scale,roty}] on the
// flat ember ground. The per-instance scorch jitter the per-mesh version had was
// a subtle lightness-only wobble, so a fixed mid-scorch reads the same across
// the haze-dimmed flat.
function addScorchedInstances(scene, key, mode, items) {
  if (!items.length || !(KK && KK.has && KK.has(key) && KK.staticInstance)) return;
  const unit = KK.staticInstance(key, 1, mode); // size-1 reference, base at y=0
  if (!unit) return;
  scorch(unit, 0.16);
  unit.updateMatrixWorld(true);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), yUp = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  unit.traverse((o) => {
    if (!o.isMesh) return;
    // normals kept whole through the bake (client/bake-geometry.js): the Wastes' dead trees once stood black against an ash storm
    const geo = bakeGeometry(o.geometry, o.matrixWorld); // prop at size 1, base y=0
    const im = new THREE.InstancedMesh(geo, o.material, items.length);
    im.frustumCulled = false;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      q.setFromAxisAngle(yUp, it.roty);
      pos.set(it.x, 0, it.y);
      scl.set(it.scale, it.scale, it.scale);
      m4.compose(pos, q, scl);
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
  });
}
// Ashminster (data/emberTown.js on the server; test/ember-town.test.js keeps
// these in step): where the minster stands, how big, and which way it faces.
const EMBER_TOWN = { x: 10000, y: 11000, unit: 250, height: 7.5, turn: Math.PI, name: 'Ashminster' };
// The town's ground (nothing of the Wastes is scattered inside it), what stands
// in it, and what can be stood at and used: copies of data/emberTown.js.
const TX = EMBER_TOWN.x, TY = EMBER_TOWN.y;
const ASH_GROUND = [{ x: TX, y: TY, r: 1700 }, { x: TX, y: TY + 1900, r: 1450 }, { x: TX, y: TY + 2950, r: 750 }];
const ASH_PIECES = [
  ['em_ash_cross', TX, TY + 1950, 0, 260, 'fit'],
  ['em_house_a', TX - 650, TY + 1700, 1.57, 440, 'fit'], ['em_house_b', TX - 700, TY + 2250, 1.4, 400, 'fit'],
  ['em_house_c', TX + 650, TY + 1700, -1.57, 470, 'fit'], ['em_house_a', TX + 700, TY + 2250, -1.5, 440, 'fit'],
  ['em_house_b', TX - 450, TY + 2700, 0.1, 400, 'fit'], ['em_house_c', TX + 470, TY + 2700, -0.1, 470, 'fit'],
  ['em_house_a', TX - 420, TY + 3200, 1.57, 440, 'fit'], ['em_house_b', TX + 420, TY + 3200, -1.57, 400, 'fit'],
  ['em_house_c', TX - 1000, TY + 1350, 0.4, 470, 'fit'], ['em_house_b', TX + 1000, TY + 1350, -0.3, 400, 'fit'],
  ['em_house_a', TX - 1350, TY + 1750, 0.8, 440, 'fit'], ['em_house_c', TX + 1350, TY + 1800, -0.6, 470, 'fit'],
  ['prop_well', TX + 300, TY + 2150, 0.3, 110, 'fit'],
  ['em_barricade', TX, TY + 3550, 0, 420, 'fit'], ['em_barricade', TX - 1050, TY + 2000, -1.57, 420, 'fit'], ['em_barricade', TX + 1050, TY + 2000, 1.57, 420, 'fit'],
  ['em_frith_cross', TX, TY + 1650, 0, 170, 'height'], ['em_frith_cross', TX + 1650, TY, 1.57, 170, 'height'],
  ['em_frith_cross', TX - 1650, TY, -1.57, 170, 'height'], ['em_frith_cross', TX, TY - 1650, 3.14, 170, 'height'],
];
const ASH_SPOTS = {
  knocker:   { x: TX + 1500, y: TY + 60, name: 'the sanctuary knocker', icon: '🚪', hint: 'take hold of the sanctuary knocker' },
  anchoress: { x: TX - 225, y: TY - 235, name: 'the anchoress\'s squint', icon: '🕯️', hint: 'speak at the anchoress\'s squint' },
  marks:     { x: TX - 525, y: TY + 440, name: 'marks cut in the stone', icon: '✴️', hint: 'look at the marks cut by the breach' },
  frith:     { x: TX + 70, y: TY + 1710, name: 'the south frith cross', icon: '✝️', hint: 'read the frith cross' },
};
// The field (data/emberField.js; test/ember-field.test.js keeps this copy in
// step): the worn track and its forks, and the twelve things the war left by it.
const FIELD_TRACK = [[[10000,18350],[9900,16800],[10100,15200],[10000,14400]],[[10000,9300],[10200,7500],[9800,5600],[10000,4300]],[[8300,10900],[7200,9600],[6200,7900],[5800,7300]],[[11700,10800],[12900,9900],[13900,8900]],[[10500,18250],[12800,17600],[14700,16700],[15300,16300]],[[8300,11200],[6500,12100],[4800,12800],[3950,13200]],[[3950,13200],[2900,12400],[1800,12650],[900,13100]]];
const FIELD_POSTS = [{"x":4050,"y":13420,"arms":["the March gate ↖","the witches' ring ↙","Ashminster →"]},{"x":10260,"y":18200,"arms":["Ashminster ↑","Emberfall ↗"]},{"x":10180,"y":14420,"arms":["Ashminster ↑","the portal ↓"]},{"x":8250,"y":11050,"arms":["Charhold ↖","the witches' ring ←"]},{"x":10180,"y":9250,"arms":["the Cinder Bazaar ↑"]},{"x":11750,"y":10950,"arms":["the Great Ossuary ↗"]}];
const FIELD_FINDS = [
  {"id":"standard_south","name":"A fallen standard","icon":"🚩","model":"em_standard","x":9720,"y":16150,"size":200,"turn":0.4,"hint":"search the fallen standard"},
  {"id":"bell","name":"A cracked bell","icon":"🔔","model":"em_bell","x":10260,"y":15150,"size":90,"turn":0.5,"hint":"look at the cracked bell"},
  {"id":"barrow_north","name":"A knight's barrow","icon":"⚱️","model":"em_barrow","x":9600,"y":5000,"size":280,"turn":1.2,"hint":"kneel at the barrow"},
  {"id":"trench_north","name":"A siege trench","icon":"⛏️","model":"em_trench","x":10350,"y":6650,"size":330,"turn":-0.2,"hint":"climb down into the trench"},
  {"id":"barrow_west","name":"A knight's barrow","icon":"⚱️","model":"em_barrow","x":6950,"y":9150,"size":280,"turn":-0.6,"hint":"kneel at the barrow"},
  {"id":"stakes_west","name":"The last line of stakes","icon":"⛏️","model":"em_trench","x":5950,"y":7650,"size":330,"turn":0.9,"hint":"walk the line of stakes"},
  {"id":"standard_east","name":"A fallen standard","icon":"🚩","model":"em_standard","x":12650,"y":10300,"size":200,"turn":-1.1,"hint":"search the fallen standard"},
  {"id":"long_grave","name":"The long grave","icon":"🪦","model":"em_barrow","x":13550,"y":9350,"size":520,"turn":0.6,"hint":"stand at the long grave"},
  {"id":"chapel","name":"The field chapel","icon":"⛪","model":"em_chapel","x":13350,"y":17450,"size":380,"turn":0.3,"hint":"go into the field chapel"},
  {"id":"wagons","name":"The Order's baggage","icon":"🛞","model":"em_barricade","x":14350,"y":16850,"size":380,"turn":1.8,"hint":"search the burnt wagons"},
  {"id":"bottle","name":"A witch-bottle at the crossroads","icon":"🏺","model":"em_bottle","x":6050,"y":12350,"size":160,"turn":2.2,"hint":"look at the witch-bottle"},
  {"id":"rowan","name":"Rowan and red thread","icon":"🧶","model":"em_rowan","x":4650,"y":12980,"size":130,"turn":0.2,"hint":"look at what is tied to the post"},
];
function nearTrack(x, z, r) {
  for (const run of FIELD_TRACK) for (let i = 0; i < run.length - 1; i++) {
    const [ax, ay] = run[i], [bx, by] = run[i + 1], L2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const u = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - ay) * (by - ay)) / L2));
    if (Math.hypot(x - (ax + (bx - ax) * u), z - (ay + (by - ay) * u)) < r) return true;
  }
  return FIELD_FINDS.some((f) => Math.hypot(x - f.x, z - f.y) < r + 120) || FIELD_POSTS.some((p) => Math.hypot(x - p.x, z - p.y) < r);
}
// The witches' ring in the west (data/witchRing.js; test/witch-ring.test.js keeps this copy in step).
const WITCH_RING = { x: 3000, y: 13600, stoneR: 560, stones: 13 };
const WITCH_FIVE = [
  { id: 'hazel', name: 'Hazel', x: 3000, y: 13300 }, { id: 'morwenna', name: 'Morwenna Tarrant', x: 3285, y: 13507 },
  { id: 'joan', name: 'Joan Ashby', x: 3176, y: 13843 }, { id: 'tamsin', name: 'Tamsin Rook', x: 2824, y: 13843 },
  { id: 'elspet', name: 'Elspet Grey', x: 2715, y: 13507 },
];
// How much of each piece is solid: a square about its middle, as a share of its size (a house is walked round, not into).
const ASH_SOLID = { em_house_a: 0.4, em_house_b: 0.42, em_house_c: 0.36, em_ash_cross: 0.36, prop_well: 0.42, em_frith_cross: 0.18, em_barricade: 0 };
// What of the minster is solid, in the model's own plan (x along the nave,
// tower at -x; y across, north at +y), as [x0, y0, x1, y1]. The nave is left
// open at the breach in its north wall, so it can be walked into.
const MINSTER_SOLID = [
  [-3.0, -1.62, 3.0, -1.38],            // nave, south wall
  [-3.0, 1.38, 0.1, 1.62], [2.1, 1.38, 3.0, 1.62],   // nave, north wall either side of the breach
  [2.88, -1.5, 4.85, 1.5],              // the crossing gable and the chancel behind it
  [1.79, -2.85, 3.41, -1.5],            // south transept
  [1.79, 1.5, 2.01, 2.75], [3.19, 1.5, 3.41, 2.75], [1.79, 2.59, 3.41, 2.81],   // what is left of the north one
  [-5.5, -1.35, -3.0, 1.35],            // the tower
  [-5.5, 2.0, -4.3, 3.0], [-4.5, 2.5, -3.6, 3.4], [-3.8, 2.9, -3.0, 3.8], [-2.8, 3.5, -1.3, 4.5],   // the spire where it lies
  [-3.95, -2.35, -3.25, -1.65],         // the bell
];
function minsterWalls() {
  const { x: cx, y: cy, unit: u, turn } = EMBER_TOWN, c = Math.cos(turn), s = Math.sin(turn);
  return MINSTER_SOLID.map(([x0, y0, x1, y1]) => {
    // model (x, y) -> three (x, -y); turned about the vertical; three z is the world's y
    const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([mx, my]) => { const X = mx * u, Z = -my * u; return [cx + X * c + Z * s, cy - X * s + Z * c]; });
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  });
}
function buildEmberScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a0f0a);
  // A vast zone (20000²): push the view distance + fog out so the scorched
  // dunes recede into haze rather than a hard wall a few strides ahead.
  scene.fog = new THREE.Fog(0x2a0f0a, 900, 5200);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 6, 7000);
  // Assign early so swapToEmberMap works even if geometry building throws below.
  setEmberScene(scene);
  setEmberCamera(camera);

  // Reddened light so the ruby floor smoulders. A touch brighter + redder sun
  // than before to throw a glassy highlight across the gem tiles.
  const emberAmbientLight = new THREE.AmbientLight(0xff6a4a, 0.62);
  scene.add(emberAmbientLight);
  const emberSun = new THREE.DirectionalLight(0xffb070, 0.8);
  emberSun.position.set(400, 700, 250);
  scene.add(emberSun);
  // The Wastes are open and seen a long way: the shadow box follows the player at twice the town's size, so its
  // edge (where shadows stop, and step on and off as you walk) stays off the screen rather than across the near ground.
  emberSun.userData.shadowSpan = 1440;
  // A low red hemisphere fill so the undersides of props + the far gem field
  // keep a warm ember blush instead of going flat black.
  const emberHemi = new THREE.HemisphereLight(0xff5533, 0x1a0604, 0.4);
  scene.add(emberHemi);
  // what client/ember-storm.js turns down for the night (and back up by day)
  scene.userData.lights = { ambient: emberAmbientLight, sun: emberSun, hemi: emberHemi, base: { ambient: 0.62, sun: 0.8, hemi: 0.4 } };

  // FLAT ember plain. A dead-level bedrock plane (deep ember red) sits just
  // under y=0 so there's always a floor even before the hex tiles stream in;
  // the ruby hex field (buildRubyFloor below) carpets over it. No height
  // displacement anymore — the zone is flat (emberHeightAt → 0).
  const groundTex = (typeof makeEmberFloorTexture === 'function') ? makeEmberFloorTexture() : makeGrassTexture();
  const cx0 = EMBER_WORLD.width / 2, cz0 = EMBER_WORLD.height / 2;
  const span = Math.max(EMBER_WORLD.width, EMBER_WORLD.height) + 400;
  groundTex.repeat.set(span / 220, span / 220);
  const groundGeo = new THREE.PlaneGeometry(EMBER_WORLD.width + 400, EMBER_WORLD.height + 400);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ map: groundTex, color: 0x5a1612 }));
  ground.position.set(cx0, -2, cz0);
  scene.add(ground);

  // ── Ruby hex floor ──────────────────────────────────────────────────────
  // Carpet the flat plain in KayKit hex tiles tinted like cut rubies — the
  // same pointy-top instanced-hex technique the town floor uses, but a field
  // of deep-red gems instead of grass. Three ruby shades scatter per tile for
  // a faceted shimmer, each an InstancedMesh (one draw call) with a glassy
  // Phong specular + red emissive so they smoulder under the ember sun.
  // Built lazily: tiles are in the gating set, so on a warm load KK.settled is
  // already true and it builds at once; on a cold load it waits for KK.
  let rubyFloorBuilt = false;
  const buildRubyFloor = () => {
    if (rubyFloorBuilt || !(KK && KK.settled && KK.has && KK.has('tile_grass') && KK.models && KK.models.tile_grass)) return;
    rubyFloorBuilt = true;
    // One tile model unit = S world units (matches town's hex floor scale).
    const S = 100, HW = 2.0 * S, ROW = 0.75 * 2.309 * S;
    const axToWorld = (q, r) => ({ x: HW * (q + r / 2), z: ROW * r });
    // Grab the hex tile's geometry once.
    let geo = null;
    KK.models.tile_grass.scene.traverse((ch) => { if (ch.isMesh && !geo) geo = ch.geometry; });
    if (!geo) { return; }
    // Three ruby cuts — deep garnet, bright ruby, dark wine — each a glossy
    // gem material. Phong gives the specular glint a flat Lambert can't.
    const RUBIES = [0x9e0b1a, 0xc21f2e, 0x6e0712];
    const rubyMat = (col) => new THREE.MeshPhongMaterial({
      color: col, emissive: 0x3a0206, emissiveIntensity: 0.4,
      specular: 0xff8878, shininess: 70
    });
    const variants = RUBIES.map(c => ({ mat: rubyMat(c), mats: [] }));
    scene.userData.rubyMats = variants.map((v) => ({ mat: v.mat, base: v.mat.color.clone() }));   // dimmed by night (client/ember-storm.js)
    let fseed = 0x51a5e1;
    const frnd = () => { fseed = (fseed * 1664525 + 1013904223) >>> 0; return fseed / 4294967296; };
    const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), pos = new THREE.Vector3();
    const scl = new THREE.Vector3(S, S, S);
    const rowMax = Math.ceil(EMBER_WORLD.height / ROW) + 2;
    for (let r = -2; r <= rowMax; r++) {
      const qLo = Math.floor(-2 - r / 2), qHi = Math.ceil(EMBER_WORLD.width / HW + 2 - r / 2);
      for (let q = qLo; q <= qHi; q++) {
        const wld = axToWorld(q, r);
        if (wld.x < -300 || wld.x > EMBER_WORLD.width + 300 || wld.z < -300 || wld.z > EMBER_WORLD.height + 300) continue;
        pos.set(wld.x, 0, wld.z);
        // random tiny yaw snap to a hex step so facets don't line up in rows
        qt.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.PI / 3) * Math.floor(frnd() * 6));
        m4.compose(pos, qt, scl);
        variants[Math.floor(frnd() * variants.length)].mats.push(m4.clone());
      }
    }
    for (const v of variants) {
      if (!v.mats.length) continue;
      const im = new THREE.InstancedMesh(geo, v.mat, v.mats.length);
      im.frustumCulled = false;
      for (let i = 0; i < v.mats.length; i++) im.setMatrixAt(i, v.mats[i]);
      im.instanceMatrix.needsUpdate = true;
      scene.add(im);
    }
  };
  buildRubyFloor();
  if (!rubyFloorBuilt && KK) {
    if (KK.promise && typeof KK.promise.then === 'function') KK.promise.then(buildRubyFloor).catch(() => {});
    if (KK.onAssetLoad) KK.onAssetLoad(buildRubyFloor);
  }

  // ── Scorched KayKit decor ───────────────────────────────────────────────
  // Cosmetic only (no harvest, no collision). Dead trees, bare trees, boulders
  // and tombs scattered across the plain, burnt-over by scorch() so the bright
  // KayKit pack reads as ember-charred. Procedural rock/tree is the cold-load
  // fallback until KK settles. Denser clusters at each named landmark.
  let seed = 0x1a2b3c4d;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const W = EMBER_WORLD.width, Hh = EMBER_WORLD.height, m = 500;
  const spots = [];
  for (let i = 0; i < 560; i++) spots.push([m + rnd() * (W - m * 2), m + rnd() * (Hh - m * 2)]);
  const landmarks = (typeof getEmberLandmarks === 'function' && getEmberLandmarks().length)
    ? getEmberLandmarks()
    : [{ x: 5000, y: 6000 }, { x: 15000, y: 8000 }, { x: 10000, y: 3000 }, { x: 16500, y: 15800 }];
  for (const lm of landmarks) {
    if (lm.town || lm.ring) continue;   // Ashminster and the ring are dressed below
    for (let i = 0; i < 44; i++) spots.push([lm.x + (rnd() - 0.5) * (lm.radius ? lm.radius * 1.6 : 2400), lm.y + (rnd() - 0.5) * (lm.radius ? lm.radius * 1.6 : 2400)]);
  }
  // Pool of scorched KayKit keys (all in the gating set, already loaded) with a
  // size + fit-mode for each. Weighted toward dead/bare trees + boulders.
  const DEAD = [
    ['prop_deadtree', 150, 'height'], ['prop_deadtree', 150, 'height'], ['prop_deadtree2', 120, 'height'],
    ['tree_bare1a', 150, 'height'], ['tree_bare1b', 150, 'height'], ['tree_bare2a', 160, 'height'], ['tree_bare2c', 160, 'height'],
    ['fl_deadwood', 150, 'height'], ['fl_thornsnarl', 70, 'height'],
    ['rock1', 90, 'fit'], ['rock2', 110, 'fit'], ['rock3', 100, 'fit']
  ];
  // nothing scattered stands in the minster or its yard
  // the town, and the track and what lies by it, are kept clear of the scatter
  const inTown = (x, z) => ASH_GROUND.some((g) => Math.hypot(x - g.x, z - g.y) < g.r) || nearTrack(x, z, 240) || Math.hypot(x - WITCH_RING.x, z - WITCH_RING.y) < 1000;
  for (let i = spots.length - 1; i >= 0; i--) if (inTown(spots[i][0], spots[i][1])) spots.splice(i, 1);
  const canKK = KK && KK.staticInstance;
  if (canKK) {
    // Bucket the ~700 scorched props by model, then emit one InstancedMesh each
    // (was one draw call per prop). rnd() is consumed in the SAME order/count as
    // the per-mesh version — pick, scale, turn, and the old per-instance scorch
    // amount — so the rest of the ember scene's seeded scatter is unchanged.
    const byKey = {};
    spots.forEach(([x, y]) => {
      const [key, size, mode] = DEAD[Math.floor(rnd() * DEAD.length)];
      const scale = size * (0.8 + rnd() * 0.5);
      const roty = rnd() * Math.PI * 2;
      rnd(); // was scorch(group, 0.1 + rnd()*0.12) — scorch is now a fixed per-key tint; keep the draw to preserve the RNG stream
      (byKey[key] || (byKey[key] = { mode, items: [] })).items.push({ x, y, scale, roty });
    });
    for (const key in byKey) addScorchedInstances(scene, key, byKey[key].mode, byKey[key].items);
  } else {
    // Procedural fallback (cold load, before the KayKit props stream in).
    spots.forEach(([x, y], i) => {
      const group = (i % 2 === 0) ? makeRock(x, y, 1.1 + rnd() * 0.9) : makeTree(x, y, 2.2 + rnd() * 1.4);
      group.traverse(c => { if (c.isMesh && c.material && c.material.color) { c.material = c.material.clone(); c.material.color.offsetHSL(0, 0, -0.08); } });
      scene.add(group);
    });
  }

  // Tombs + ruined gateways clustered at each landmark — gives the POIs the
  // look of a long-dead necropolis on the ember flat.
  if (canKK) {
    for (const lm of landmarks) {
      if (lm.x === undefined || lm.town || lm.ring) continue;
      const tombs = [['prop_crypt', 110, 'fit'], ['prop_grave_a', 30, 'height'], ['prop_grave_b', 30, 'height'], ['prop_arch', 150, 'fit']];
      for (let i = 0; i < 8; i++) {
        const [key, size, mode] = tombs[i % tombs.length];
        const g = KK.staticInstance(key, size * (0.85 + rnd() * 0.4), mode);
        if (!g) continue;
        g.rotation.y = rnd() * Math.PI * 2;
        g.position.set(lm.x + (rnd() - 0.5) * 900, 0, lm.y + (rnd() - 0.5) * 900);
        scorch(g, 0.08 + rnd() * 0.1);
        scene.add(g);
      }
    }
  }

  // ── Ruby crystal formations ──────────────────────────────────────────────
  // Giant glowing ruby gems jut from the ember flat in clusters — the zone's
  // signature landmark, tying to the ruby floor and giving big silhouettes to
  // steer by through the fog. Deep-red with a strong emissive so they glow on
  // their own (emissive = no per-light shader cost, unlike a PointLight each).
  function rubyGem(x, z, size) {
    const key = rnd() < 0.5 ? 'gem_large' : 'gem_medium';
    const g = KK.staticInstance(key, size, 'height');
    if (!g) return null;
    const shade = 0.9 + rnd() * 0.3;
    g.traverse(c => {
      if (!c.isMesh || !c.material) return;
      const wasArr = Array.isArray(c.material);
      const mats = wasArr ? c.material : [c.material];
      const cloned = mats.map(mm => {
        const m = mm.clone();
        if (m.color) m.color.setRGB(0.62 * shade, 0.05, 0.11 * shade);
        if ('emissive' in m) { m.emissive = new THREE.Color(0xc01525); m.emissiveIntensity = 0.55; }
        return m;
      });
      c.material = wasArr ? cloned : cloned[0];
    });
    g.position.set(x, 0, z);
    g.rotation.y = rnd() * Math.PI * 2;
    g.rotation.z = (rnd() - 0.5) * 0.35; // lean the spires
    return g;
  }
  function gemCluster(cx, cz, n, baseSize) {
    for (let i = 0; i < n; i++) {
      const ang = rnd() * Math.PI * 2, r = rnd() * baseSize * 1.5;
      const g = rubyGem(cx + Math.cos(ang) * r, cz + Math.sin(ang) * r, baseSize * (0.5 + rnd() * 1.2));
      if (g && !inTown(cx, cz)) scene.add(g);   // no crystals in the minster's yard
    }
  }
  if (canKK) {
    // Crystal fields scattered the whole zone over, so bare floor is rare.
    for (let i = 0; i < 80; i++) gemCluster(m + rnd() * (W - m * 2), m + rnd() * (Hh - m * 2), 3 + Math.floor(rnd() * 4), 90 + rnd() * 130);
    // A dense ruby reef beside each non-warlord POI.
    for (const lm of landmarks) { if (lm.x !== undefined && !lm.warlord && !lm.town && !lm.ring) gemCluster(lm.x + 500, lm.y + 300, 7, 150); }
  }

  // ── The Ashlord's Citadel ────────────────────────────────────────────────
  // A ruined dungeon-stone keep around the warlord's throne: a broken ring of
  // sloped walls + corners with gaps, crumbling pillars, and torches (emissive
  // flame + a few real lights at the heart) — the zone's one big structure.
  if (canKK) {
    const seat = landmarks.find(l => l.warlord && l.x !== undefined) || landmarks.find(l => l.x !== undefined);
    if (seat) {
      const cx = seat.x, cz = seat.y, RING = 460;
      for (let i = 0; i < 14; i++) {
        if (rnd() < 0.22) continue; // leave gaps so it reads as ruined, not walled
        const ang = (i / 14) * Math.PI * 2;
        const key = (i % 4 === 0) ? 'ruin_corner' : 'ruin_wall';
        const g = KK.staticInstance(key, 150 + rnd() * 40, 'fit');
        if (!g) continue;
        g.position.set(cx + Math.cos(ang) * RING, 0, cz + Math.sin(ang) * RING);
        g.rotation.y = -ang + Math.PI / 2 + (rnd() - 0.5) * 0.3;
        scorch(g, 0.14);
        scene.add(g);
      }
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        const p = KK.staticInstance(i % 2 ? 'ruin_pillar2' : 'ruin_pillar', 200 + rnd() * 90, 'height');
        if (p) { p.position.set(cx + Math.cos(ang) * RING * 0.52, 0, cz + Math.sin(ang) * RING * 0.52); p.rotation.y = rnd() * Math.PI; scorch(p, 0.1); scene.add(p); }
        const t = KK.staticInstance('ruin_torch', 95, 'height');
        if (t) {
          const tx = cx + Math.cos(ang) * RING * 0.82, tz = cz + Math.sin(ang) * RING * 0.82;
          t.position.set(tx, 0, tz); scene.add(t);
          const flame = new THREE.Mesh(new THREE.ConeGeometry(10, 30, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2e }));
          flame.position.set(tx, 95, tz); scene.add(flame);
        }
      }
      // A few real lights only at the citadel heart (kept to a handful for perf).
      for (const [dx, dz] of [[0, 0], [RING * 0.5, 0], [-RING * 0.5, 0]]) {
        const l = new THREE.PointLight(0xff6a28, 0.9, 900);
        l.position.set(cx + dx, 160, cz + dz);
        scene.add(l);
      }
    }
  }
  // ── Lava / ember pools ───────────────────────────────────────────────────
  // Molten pools break up the flat ruby field with bright self-lit glow and a
  // charred crust ring. Unlit (MeshBasic) so they read as glowing lava at no
  // light cost, laid just above the hex floor to avoid z-fighting.
  for (let i = 0; i < 42; i++) {
    const x = m + rnd() * (W - m * 2), z = m + rnd() * (Hh - m * 2), rad = 90 + rnd() * 170;
    const ox = (rnd() - 0.5) * rad * 0.3, oz = (rnd() - 0.5) * rad * 0.3;
    if (inTown(x, z)) continue;   // the town stands on cold ground
    const crust = new THREE.Mesh(new THREE.RingGeometry(rad, rad + 36, 26), new THREE.MeshBasicMaterial({ color: 0x2e0c06, side: THREE.DoubleSide }));
    crust.rotation.x = -Math.PI / 2; crust.position.set(x, 1.4, z); scene.add(crust);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(rad, 24), new THREE.MeshBasicMaterial({ color: 0xff5a1e }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, 1.8, z); scene.add(pool);
    // a darker molten swirl inset for a bit of depth
    const core = new THREE.Mesh(new THREE.CircleGeometry(rad * 0.5, 20), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    core.rotation.x = -Math.PI / 2; core.position.set(x + ox, 2.0, z + oz); scene.add(core);
  }

  // ── Ember geysers ────────────────────────────────────────────────────────
  // Thin glowing columns venting from the ground — vertical interest + more
  // silhouettes. Additive, so they read as hot gas rather than solid pillars.
  for (let i = 0; i < 30; i++) {
    const x = m + rnd() * (W - m * 2), z = m + rnd() * (Hh - m * 2), gh = 200 + rnd() * 320;
    if (inTown(x, z)) continue;
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 26, gh, 7, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    col.position.set(x, gh / 2, z); scene.add(col);
    const base = new THREE.Mesh(new THREE.CircleGeometry(34, 16), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    base.rotation.x = -Math.PI / 2; base.position.set(x, 2.2, z); scene.add(base);
  }

  // ── Drifting ember particles ─────────────────────────────────────────────
  // A field of glowing embers rising through the air, recentred on the camera
  // each tick (see updateEmberAmbient) so the whole zone feels alive without a
  // point per 20k² of floor. Same Points-with-velocity trick as the Manor.
  if (typeof makeGlowTexture === 'function' && typeof setEmberAmbient === 'function') {
    const N = 850, RAD = 2600, CEIL = 1500;
    const arr = new Float32Array(N * 3), vel = new Float32Array(N);
    const sx = EMBER_WORLD.spawn.x, sz = EMBER_WORLD.spawn.y;
    for (let i = 0; i < N; i++) {
      arr[i * 3] = sx + (rnd() - 0.5) * 2 * RAD;
      arr[i * 3 + 1] = rnd() * CEIL;
      arr[i * 3 + 2] = sz + (rnd() - 0.5) * 2 * RAD;
      vel[i] = 45 + rnd() * 95;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({ size: 30, map: makeGlowTexture(), color: 0xff7a2e, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    setEmberAmbient({ points, vel, RAD, CEIL });
  }

  // A tall beacon + floating nameplate at each landmark — a silhouette to steer
  // by across the vast zone, and the name once you draw near. The warlord's
  // throne gets a taller, redder spire.
  for (const lm of landmarks) {
    if (lm.x === undefined || lm.town || lm.ring) continue;   // the minster and the ring are their own beacons
    const warlord = !!lm.warlord;
    const beacon = new THREE.Group();
    const h = warlord ? 420 : 300;
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 46, h, 6),
      new THREE.MeshLambertMaterial({ color: warlord ? 0x1a0a08 : 0x1c1410 })
    );
    spire.position.y = h / 2;
    beacon.add(spire);
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(warlord ? 46 : 32, 0),
      new THREE.MeshLambertMaterial({ color: warlord ? 0xff3300 : 0xff7a33, emissive: warlord ? 0xff2200 : 0xcc4411, emissiveIntensity: 1.0 })
    );
    crown.position.y = h + 20;
    beacon.add(crown);
    if (lm.name && typeof makeNpcNameSprite === 'function') {
      const label = makeNpcNameSprite((warlord ? '⚔️ ' : '') + lm.name);
      label.position.set(0, h + 90, 0);
      beacon.add(label);
    }
    beacon.position.set(lm.x, H(lm.x, lm.y), lm.y);
    scene.add(beacon);
  }

  // ── Ashminster: the minster that stood through the war ───────────────────
  // One great model (tools/models/build_home.py minster), set down at the
  // middle of the Wastes with its breached side to the south, where people
  // come from. Solid where its walls are (scene.userData.walls, which the
  // game takes as this map's walls); the nave is open at the breach. Its
  // model streams in after the scene is first built, so it is set down when
  // it arrives.
  scene.userData.walls = minsterWalls();
  let minsterBuilt = false;
  const buildMinster = () => {
    if (minsterBuilt || !(KK && KK.has && KK.has('em_minster') && KK.staticInstance)) return;
    const g = KK.staticInstance('em_minster', EMBER_TOWN.height * EMBER_TOWN.unit, 'height');
    if (!g) return;
    minsterBuilt = true;
    g.rotation.y = EMBER_TOWN.turn;
    g.position.set(EMBER_TOWN.x, 0, EMBER_TOWN.y);
    scene.add(g);
    // the east window is the one warm thing in the place
    const lamp = new THREE.PointLight(0xffb060, 0.9, 1400);
    const c = Math.cos(EMBER_TOWN.turn), s = Math.sin(EMBER_TOWN.turn), ex = 5.3 * EMBER_TOWN.unit;
    lamp.position.set(EMBER_TOWN.x + ex * c, 300, EMBER_TOWN.y - ex * s);
    scene.add(lamp);
    if (typeof makeNpcNameSprite === 'function') {
      const label = makeNpcNameSprite('⛪ ' + EMBER_TOWN.name);
      label.scale.multiplyScalar(4);
      label.position.set(EMBER_TOWN.x, EMBER_TOWN.height * EMBER_TOWN.unit + 220, EMBER_TOWN.y);
      scene.add(label);
    }
  };
  buildMinster();
  if (!minsterBuilt && KK) {
    if (KK.promise && typeof KK.promise.then === 'function') KK.promise.then(buildMinster).catch(() => {});
    if (KK.onAssetLoad) KK.onAssetLoad(buildMinster);
  }
  // ── the town south of it: a market square with its cross broken, roofless
  // houses round it and down the one street, a well, barricades across the
  // ways in, shell-holes, and the four frith crosses at the edge of the
  // minster's peace. Each piece is set down as its model arrives.
  for (const [key, x, y, , size] of ASH_PIECES) {
    const half = size * (ASH_SOLID[key] || 0);
    if (half) scene.userData.walls.push({ x: x - half, y: y - half, w: half * 2, h: half * 2 });
    else if (key === 'em_barricade') { const along = Math.abs(Math.cos(ASH_PIECES.find((p) => p[1] === x && p[2] === y)[3])) > 0.5; scene.userData.walls.push(along ? { x: x - size * 0.45, y: y - 40, w: size * 0.9, h: 80 } : { x: x - 40, y: y - size * 0.45, w: 80, h: size * 0.9 }); }
  }
  const placed = new Set();
  const buildTown = () => {
    if (!(KK && KK.has && KK.staticInstance)) return;
    ASH_PIECES.forEach(([key, x, y, turn, size, mode], i) => {
      if (placed.has(i) || !KK.has(key)) return;
      const g = KK.staticInstance(key, size, mode);
      if (!g) return;
      placed.add(i);
      if (key === 'prop_well') scorch(g, 0.2);
      g.rotation.y = turn; g.position.set(x, 0, y);
      scene.add(g);
    });
  };
  buildTown();
  if (KK && placed.size < ASH_PIECES.length) {
    if (KK.promise && typeof KK.promise.then === 'function') KK.promise.then(buildTown).catch(() => {});
    if (KK.onAssetLoad) KK.onAssetLoad(buildTown);
  }
  // shell-holes in the square and the street: a scorched ring and a dark middle, laid just over the floor
  for (const [dx, dy, r] of [[-260, 1850, 90], [330, 2450, 120], [-120, 2950, 70], [180, 3350, 100], [-820, 2050, 80], [860, 1650, 110], [40, 1300, 130], [-560, 1150, 75]]) {
    const rim = new THREE.Mesh(new THREE.RingGeometry(r * 0.7, r, 18), new THREE.MeshBasicMaterial({ color: 0x1c0d09, side: THREE.DoubleSide }));
    rim.rotation.x = -Math.PI / 2; rim.position.set(TX + dx, 2.4, TY + dy); scene.add(rim);
    const pit = new THREE.Mesh(new THREE.CircleGeometry(r * 0.7, 16), new THREE.MeshBasicMaterial({ color: 0x0a0504 }));
    pit.rotation.x = -Math.PI / 2; pit.position.set(TX + dx, 2.6, TY + dy); scene.add(pit);
  }
  // ── the field: the worn track out from the portal and from Ashminster, a
  // fingerpost at each fork, waymarker stones along it, and the twelve things
  // the war left beside it (data/emberField.js)
  const trackMat = new THREE.MeshLambertMaterial({ color: 0x3a1c13, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const rutMat = new THREE.MeshLambertMaterial({ color: 0x24100b, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const strip = (ax, ay, bx, by, w, mat, y) => {
    const len = Math.hypot(bx - ax, by - ay);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len + w * 0.6, w), mat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(by - ay, bx - ax);
    m.position.set((ax + bx) / 2, y, (ay + by) / 2);
    scene.add(m);
  };
  const markerSpots = [];
  for (const run of FIELD_TRACK) {
    let carry = 700;
    for (let i = 0; i < run.length - 1; i++) {
      const [ax, ay] = run[i], [bx, by] = run[i + 1];
      strip(ax, ay, bx, by, 210, trackMat, 2.6);
      const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
      for (const side of [-1, 1]) strip(ax - uy * side * 38, ay + ux * side * 38, bx - uy * side * 38, by + ux * side * 38, 16, rutMat, 2.8);   // cart ruts
      for (let d = carry; d < len; d += 1400) { const side = markerSpots.length % 2 ? 1 : -1; markerSpots.push([ax + ux * d - uy * side * 135, ay + uy * d + ux * side * 135]); }
      carry = (carry - len) % 1400; if (carry < 0) carry += 1400;
    }
  }
  // where the track's lanterns hang in an ash storm (client/ember-storm.js): on every waymarker and fingerpost
  scene.userData.stormLights = [...markerSpots.map(([x, y]) => [x, y, 118]), ...FIELD_POSTS.map((p) => [p.x, p.y, 190])];
  const fieldKiosks = [];
  const fieldPlaced = new Set();
  const buildField = () => {
    if (!(KK && KK.has && KK.staticInstance)) return;
    layRoadStones(scene, KK, FIELD_TRACK, 105, H, (g) => scorch(g, 0.14), 11);   // the track's kerbs and worn flags
    markerSpots.forEach(([x, y], i) => {
      const k = 'm' + i; if (fieldPlaced.has(k) || !KK.has('wl_waymarker')) return;
      const g = KK.staticInstance('wl_waymarker', 110, 'height'); if (!g) return;
      fieldPlaced.add(k); scorch(g, 0.12); g.rotation.y = i * 1.7; g.position.set(x, 0, y); scene.add(g);
    });
    FIELD_POSTS.forEach((p, i) => {
      const k = 'p' + i; if (fieldPlaced.has(k) || !KK.has('em_fingerpost')) return;
      const g = KK.staticInstance('em_fingerpost', 175, 'height'); if (!g) return;
      fieldPlaced.add(k); g.rotation.y = i * 0.9; g.position.set(p.x, 0, p.y); scene.add(g);
    });
    FIELD_FINDS.forEach((f) => {
      if (fieldPlaced.has(f.id) || !KK.has(f.model)) return;
      const g = KK.staticInstance(f.model, f.size, 'fit'); if (!g) return;
      fieldPlaced.add(f.id);
      if (f.model === 'em_barricade' || f.model === 'em_chapel') scorch(g, 0.1);
      g.rotation.y = f.turn; g.position.set(f.x, 0, f.y); scene.add(g);
    });
  };
  for (const p of FIELD_POSTS) if (typeof makeNpcNameSprite === 'function') { const l = makeNpcNameSprite('🪧 ' + p.arms.join('  ·  ')); l.position.set(p.x, 215, p.y); scene.add(l); }
  for (const f of FIELD_FINDS) {
    fieldKiosks.push({ x: f.x, z: f.y, npc: 'field', fieldId: f.id, hint: f.hint, radius: 150 });
    if (/barrow|chapel/.test(f.model)) { const h = f.size * 0.32; scene.userData.walls.push({ x: f.x - h, y: f.y - h, w: h * 2, h: h * 2 }); }
    if (typeof makeNpcNameSprite === 'function') { const l = makeNpcNameSprite(`${f.icon} ${f.name}`); l.position.set(f.x, Math.max(130, f.size * 0.55), f.y); scene.add(l); }
  }
  buildField();
  if (KK && fieldPlaced.size < markerSpots.length + FIELD_POSTS.length + FIELD_FINDS.length) {
    if (KK.promise && typeof KK.promise.then === 'function') KK.promise.then(buildField).catch(() => {});
    if (KK.onAssetLoad) KK.onAssetLoad(buildField);
  }
  // ── the witches' ring: thirteen stones, the five worn places, and the elder
  // in the middle, green, the one living thing out here
  const ringKiosks = [];
  for (const w of WITCH_FIVE) {
    const hollow = new THREE.Mesh(new THREE.CircleGeometry(62, 20), new THREE.MeshLambertMaterial({ color: 0x0c0605, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    hollow.rotation.x = -Math.PI / 2; hollow.position.set(w.x, 2.8, w.y); scene.add(hollow);
    const rim = new THREE.Mesh(new THREE.RingGeometry(62, 74, 24), new THREE.MeshBasicMaterial({ color: 0x9a7a5a, side: THREE.DoubleSide, transparent: true, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    rim.rotation.x = -Math.PI / 2; rim.position.set(w.x, 2.9, w.y); scene.add(rim);
    ringKiosks.push({ x: w.x, z: w.y, npc: 'ring', ringId: w.id, hint: `stand in ${w.name}'s place`, radius: 95 });   // as near as the server allows (data/witchRing.js RING.range): a thumb on a joystick is not exact
    if (typeof makeNpcNameSprite === 'function') { const l = makeNpcNameSprite('🕯️ ' + w.name); l.position.set(w.x, 70, w.y); scene.add(l); }
  }
  ringKiosks.push({ x: WITCH_RING.x, z: WITCH_RING.y + 60, npc: 'ring', ringId: 'elder', hint: 'go to the elder', radius: 120 });
  // On a night the ring has not yet sung, it glows (client/ember-storm.js shows and breathes it): a pale
  // line round the ring of stones on the ground, and a light standing in each of the five places.
  {
    const glow = new THREE.Group(); glow.visible = false;
    const band = new THREE.Mesh(new THREE.RingGeometry(WITCH_RING.stoneR - 18, WITCH_RING.stoneR + 18, 96), new THREE.MeshBasicMaterial({ color: 0x9adf7a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    band.rotation.x = -Math.PI / 2; band.position.set(WITCH_RING.x, 3, WITCH_RING.y); glow.add(band);
    if (typeof makeGlowTexture === 'function') for (const w of WITCH_FIVE) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xb8f090, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      sp.scale.set(120, 220, 1); sp.position.set(w.x, 90, w.y); glow.add(sp);
    }
    scene.add(glow); scene.userData.ringGlow = glow;
  }
  scene.userData.walls.push({ x: WITCH_RING.x - 40, y: WITCH_RING.y - 40, w: 80, h: 80 });
  if (typeof makeNpcNameSprite === 'function') { const l = makeNpcNameSprite('🌿 The witches\' ring'); l.scale.multiplyScalar(2.5); l.position.set(WITCH_RING.x, 520, WITCH_RING.y); scene.add(l); }
  const ringPlaced = new Set();
  const buildRing = () => {
    if (!(KK && KK.has && KK.staticInstance)) return;
    for (let i = 0; i < WITCH_RING.stones; i++) {
      if (ringPlaced.has(i) || !KK.has('em_ring_stone')) continue;
      const a = (i / WITCH_RING.stones) * Math.PI * 2;
      const g = KK.staticInstance('em_ring_stone', 170 + ((i * 37) % 60), 'height'); if (!g) continue;
      ringPlaced.add(i);
      g.userData.camFade = true;   // the chase camera ghosts a stone it ends up inside
      g.rotation.y = -a + Math.PI / 2; g.position.set(WITCH_RING.x + Math.sin(a) * WITCH_RING.stoneR, 0, WITCH_RING.y - Math.cos(a) * WITCH_RING.stoneR);
      scene.add(g);
      const half = 40, sx = WITCH_RING.x + Math.sin(a) * WITCH_RING.stoneR, sz = WITCH_RING.y - Math.cos(a) * WITCH_RING.stoneR;
      scene.userData.walls.push({ x: sx - half, y: sz - half, w: half * 2, h: half * 2 });
    }
    if (!ringPlaced.has('elder') && KK.has('gv_elder')) {
      const g = KK.staticInstance('gv_elder', 300, 'height');
      if (g) {
        ringPlaced.add('elder'); g.position.set(WITCH_RING.x, 0, WITCH_RING.y); scene.add(g);
        const glow = new THREE.PointLight(0x9adf7a, 0.7, 700); glow.position.set(WITCH_RING.x, 200, WITCH_RING.y); scene.add(glow);
      }
    }
  };
  buildRing();
  if (KK && ringPlaced.size < WITCH_RING.stones + 1) {
    if (KK.promise && typeof KK.promise.then === 'function') KK.promise.then(buildRing).catch(() => {});
    if (KK.onAssetLoad) KK.onAssetLoad(buildRing);
  }
  // ── the March gate on the west edge (data/droveRoad.js GATE.wastes; test/drove-road.test.js keeps this
  // in step): through it, the drove road back into the Wilds, open at any hour.
  const MARCH_GATE = { x: 560, y: 13100 };
  const marchKiosks = [{ x: MARCH_GATE.x + 50, z: MARCH_GATE.y, npc: 'march', hint: 'go back through the March gate into the Wilds', radius: 140 }];
  for (const dy of [-150, 150]) scene.userData.walls.push({ x: MARCH_GATE.x - 35, y: MARCH_GATE.y + dy - 35, w: 70, h: 70 });
  if (typeof makeGlowTexture === 'function') {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0x9adf6a, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(380, 240, 1); glow.position.set(MARCH_GATE.x - 120, 90, MARCH_GATE.y); scene.add(glow);
  }
  if (typeof makeNpcNameSprite === 'function') { const l = makeNpcNameSprite('🚧 The March gate: back to the Wilds'); l.position.set(MARCH_GATE.x, 290, MARCH_GATE.y); scene.add(l); }
  let marchPlaced = false;
  const buildMarch = () => {
    if (marchPlaced || !(KK && KK.has && KK.staticInstance && KK.has('wd_march_gate'))) return;
    const g = KK.staticInstance('wd_march_gate', 260, 'height'); if (!g) return;
    marchPlaced = true; scorch(g, 0.1); g.rotation.y = Math.PI / 2; g.position.set(MARCH_GATE.x, 0, MARCH_GATE.y); scene.add(g);
  };
  buildMarch();
  if (KK && !marchPlaced) { if (KK.promise && typeof KK.promise.then === 'function') KK.promise.then(buildMarch).catch(() => {}); if (KK.onAssetLoad) KK.onAssetLoad(buildMarch); }

  // ── Ashminster, living in (data/ashFolk.js; test/ash-folk.test.js keeps this copy in step): the
  // people who come back to the town. Each stands in a holder the game shows only once she or he is
  // back for you (the ash_folk message); the KayKit body is swapped in inside the holder when it loads.
  const ASH_FOLK = [{"id":"kirsty","name":"Kirsty Halcrow, the wind-seller","icon":"🪢","charId":0,"x":10270,"y":13060,"facing":3.141592653589793},{"id":"wat","name":"Wat Ellery, the sexton","icon":"🔔","charId":4,"x":10900,"y":11520,"facing":-1.5707963267948966},{"id":"nan","name":"Nan Gethin, who keeps the well","icon":"🌸","charId":2,"x":10420,"y":13230,"facing":2.356194490192345}];
  scene.userData.folk = {};
  const folkKiosks = [];
  for (const f of ASH_FOLK) {
    const holder = new THREE.Group(); holder.visible = false; scene.add(holder);
    if (typeof createStaticNpc === 'function') {
      try { const npc = createStaticNpc(f.charId); if (npc && npc.group) { npc.group.position.set(f.x, 0, f.y); npc.group.rotation.y = f.facing; holder.add(npc.group); } } catch (e) { /* the kiosk still works */ }
    }
    if (typeof makeNpcNameSprite === 'function') { const l = makeNpcNameSprite(`${f.icon} ${f.name}`); l.position.set(f.x, 100, f.y); holder.add(l); }
    scene.userData.folk[f.id] = holder;
    folkKiosks.push({ x: f.x, z: f.y + 70, npc: 'folk', folkId: f.id, radius: 130 });
  }

  // what can be stood at and used, each with its name over it
  const ashKiosks = [...fieldKiosks, ...ringKiosks, ...marchKiosks, ...folkKiosks];
  for (const id in ASH_SPOTS) {
    const sp = ASH_SPOTS[id];
    ashKiosks.push({ x: sp.x, z: sp.y, npc: 'ash', ashId: id, hint: sp.hint, radius: 130 });
    if (typeof makeNpcNameSprite === 'function') { const lbl = makeNpcNameSprite(`${sp.icon} ${sp.name[0].toUpperCase() + sp.name.slice(1)}`); lbl.position.set(sp.x, 150, sp.y); scene.add(lbl); }
  }

  // Return portal near spawn (in the flattened arrival haven, so y≈0).
  const exitX = EMBER_WORLD.spawn.x, exitY = EMBER_WORLD.spawn.y - 120;
  const portal = buildPortalMesh(exitX, exitY);
  portal.position.y += H(exitX, exitY);
  scene.add(portal);

  // ── The Ember Refuge — a warm stone shelter a short walk from the return
  // portal, for a player who missed the portal back. Its glowing door is an
  // interact kiosk that drops you into the private refuge chat room. Position
  // kept in sync with the server's EMBER_REFUGE_SPOT (server.js). The door
  // faces south, toward the arrival portal.
  const REFUGE_X = 10720, REFUGE_Z = 18300;
  let refugeFrontZ = REFUGE_Z + 125; // front (door) face in +z, toward spawn — refined once the model is measured
  let refugePlaced = false;
  if (canKK) {
    // A KayKit stone keep, warm-ember tinted so it reads as a lit haven rather
    // than the grey town Bank it shares a model with. Door faces +z (toward the
    // arrival portal), so no rotation.
    const keep = KK.staticInstance('bld_refuge', 320, 'height');
    if (keep) {
      keep.traverse(c => {
        if (!c.isMesh || !c.material) return;
        const wasArr = Array.isArray(c.material);
        const mats = wasArr ? c.material : [c.material];
        const cloned = mats.map(mm => { const m = mm.clone(); if (m.color) { m.color.offsetHSL(0.015, 0.08, -0.04); m.color.lerp(new THREE.Color(0x6a2e12), 0.3); } return m; });
        c.material = wasArr ? cloned : cloned[0];
      });
      keep.position.set(REFUGE_X, 0, REFUGE_Z);
      keep.userData.camFade = true;
      scene.add(keep);
      const box = new THREE.Box3().setFromObject(keep);
      refugeFrontZ = box.max.z;
      // warm lantern light so the entrance reads as a haven. (The model's own
      // arched doorway already glows, so no overlay plane is needed — a flat
      // quad there just read as a tan rectangle covering the nicer door art.)
      const doorLight = new THREE.PointLight(0xffa64d, 1.4, 650);
      doorLight.position.set(REFUGE_X, 110, refugeFrontZ + 60); scene.add(doorLight);
      refugePlaced = true;
    }
  }
  if (!refugePlaced) {
    // Procedural cold-load fallback — a simple stone hut with a lit doorway.
    const hut = new THREE.Group();
    const hw = 220, hd = 170, hh = 150, wt = 16, doorGap = 70;
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x4a3a34 });
    const wallParts = [
      [hw, hh, wt, 0, hh / 2, -hd / 2], [wt, hh, hd, -hw / 2, hh / 2, 0], [wt, hh, hd, hw / 2, hh / 2, 0],
      [(hw - doorGap) / 2, hh, wt, -(doorGap + (hw - doorGap) / 2) / 2, hh / 2, hd / 2],
      [(hw - doorGap) / 2, hh, wt, (doorGap + (hw - doorGap) / 2) / 2, hh / 2, hd / 2]
    ];
    for (const [w, h, d, x, y, z] of wallParts) { const seg = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat); seg.position.set(x, y, z); hut.add(seg); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(hw * 0.92, 90, 4), new THREE.MeshLambertMaterial({ color: 0x2a1c16 }));
    roof.position.set(0, hh + 44, 0); roof.rotation.y = Math.PI / 4; hut.add(roof);
    const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(doorGap, hh - 30), new THREE.MeshBasicMaterial({ color: 0xffb257, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    doorGlow.position.set(0, (hh - 30) / 2, hd / 2 - 2); hut.add(doorGlow);
    const doorLight = new THREE.PointLight(0xffa64d, 1.3, 520); doorLight.position.set(0, hh * 0.5, hd / 2 + 40); hut.add(doorLight);
    hut.position.set(REFUGE_X, 0, REFUGE_Z); scene.add(hut);
    refugeFrontZ = REFUGE_Z + hd / 2;
  }
  // A hanging sign so it's legible as a refuge from a distance.
  if (typeof makeNpcNameSprite === 'function') {
    const sign = makeNpcNameSprite('⛺ Refuge');
    sign.position.set(REFUGE_X, 380, REFUGE_Z);
    scene.add(sign);
  }
  // Interact door kiosk, just outside the south threshold (within the server's
  // 220u enter radius of EMBER_REFUGE_SPOT).
  const refugeKiosk = { x: REFUGE_X, z: refugeFrontZ + 24, portal: 'refuge_enter' };

  // ── Warden Kol — the Ashblood Trials quest-giver ──────────────────────────
  // Stands in the arrival haven just off the refuge, facing the open flats, so
  // new arrivals meet the PvP line the moment they step out. He gives the arc
  // and (once done) the standing bounties. A 'quest' kiosk routes straight to
  // the quest dialogue (npcId must match data/quests.js: 'npc_warden').
  const WARDEN_X = REFUGE_X - 210, WARDEN_Z = refugeFrontZ + 70;
  const wardenGY = emberHeightAt ? emberHeightAt(WARDEN_X, WARDEN_Z) : 0;
  let wardenGroup = null;
  if (typeof createStaticNpc === 'function') {
    try {
      const warden = createStaticNpc(2); // charId 2 reads as a hard-bitten fighter
      if (warden && warden.group) {
        warden.group.position.set(WARDEN_X, wardenGY, WARDEN_Z);
        warden.group.rotation.y = Math.PI; // face south, toward arriving players
        scene.add(warden.group);
        wardenGroup = warden.group;
      }
    } catch (e) { /* fallback rig may not be ready; the kiosk still works */ }
  }
  if (typeof makeNpcNameSprite === 'function') {
    const wsign = makeNpcNameSprite('🔥 Warden Kol');
    if (wardenGroup) { wsign.position.set(0, 96, 0); wardenGroup.add(wsign); } // ride the figure, head-height
    else { wsign.position.set(WARDEN_X, wardenGY + 96, WARDEN_Z); scene.add(wsign); }
  }
  const wardenKiosk = { x: WARDEN_X, z: WARDEN_Z, npc: 'quest', npcId: 'npc_warden', npcName: '🔥 Warden Kol' };

  setEmberStaticKiosks([{ x: exitX, z: exitY, portal: 'ember_exit' }, refugeKiosk, wardenKiosk, ...ashKiosks]);
  setEmberKiosks(getEmberStaticKiosks().slice());

  const _mv = getEmberMobVisuals(); for (const id in _mv) scene.remove(_mv[id].group);
  setEmberMobVisuals({});
}

  return { buildEmberScene };
}
