// ---------------------------------------------------------------------------
// The Wilds scene (Tier 3.4 Phase C, 3D slice). A second outdoor map reached
// via the portal: buildWildsScene assembles the terrain, then its sub-builders
// drop in the ruined village, the unbound circle, the Thornwarden camp, and the
// giant werewolf tree (Lexton's), and buildWildsNPCs spawns the faction NPCs +
// quest kiosks. THREE is a global; layout tables, prop makers, and mob/decor
// helpers are injected; scene/camera + lextonNpc are written back via setters.
// ---------------------------------------------------------------------------
export default function createWildsScene({ KK, createKayKitByKey, kkSetState, hasKK, GFX, WILDS_CAMPFIRES, WILDS_KIOSKS, WILDS_NPCS, WILDS_WALLS, WILDS_WAYMARKERS, WITCH_CAVE_ENTRANCE_X, WITCH_CAVE_ENTRANCE_Z, getAddMobs2, getAddMobs3, addNatureDecor, addSpookyDecor, buildPortalMesh, createHumanoid, kkWildsDressing, kkWildsGroundDetail, kkPlace, makeSpookyTree, makeWaymarkerStone, makeWildsCampfire, wildsCollide, makeMoorTexture, makeWildsFloorTexture, makeSigilTextures, makeGroundSigilTextures, makeGlowTexture, makeSignSprite, makeNpcNameSprite, makeFlowerPatch, makePlantBloom, getDecorVisuals2, getAddAnimals2, setWildsScene, setWildsCamera, setLextonNpc, wildsHeightAt }) {
function buildWildsScene(w2) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd0ef);
  // Fog/camera-far tuned the same way the town's are — distances like this
  // don't need to scale with total map size, just with how far the
  // close-behind third-person camera can usefully see along the ground.
  scene.fog = new THREE.Fog(0x8fd0ef, 700, 2200);

  // Idempotent-rebuild support: this build PUSHES to the collider + kiosk lists,
  // so clear them first — otherwise the upgrade rebuild (re-run once the KayKit
  // models finish streaming, so the Artificer, Lexton and the village buildings
  // appear instead of placeholders) would stack a second set of colliders and
  // interact points. The campfire/waymarker lists are static input data this
  // build only reads, so they're left untouched; the mob/animal visual pools
  // reset themselves inside addMobs2/addMobs3/addAnimals2 below.
  WILDS_WALLS.length = 0;
  WILDS_KIOSKS.length = 0;

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 6, 4000); // near=6 for depth precision (kills edge z-fighting); see town camera note

  const grassTex = makeWildsFloorTexture(); // reskinned forest floor (KayKit-matched)
  const groundSpan = Math.max(w2.width, w2.height) + 200;
  grassTex.repeat.set(groundSpan / 170, groundSpan / 170);
  // Rolling terrain: a segmented plane displaced by the shared wilds heightfield
  // (flat under the developed zones; see wildsHeightAt in main.js). The geometry
  // is pre-rotated so each vertex's local x/z already read as world x/z once the
  // mesh is centred, which is what we sample.
  const cx0 = w2.width / 2, cz0 = w2.height / 2;
  const groundGeo = new THREE.PlaneGeometry(w2.width + 200, w2.height + 200, 160, 160);
  groundGeo.rotateX(-Math.PI / 2);
  let tinted = false;
  if (typeof wildsHeightAt === 'function') {
    const gp = groundGeo.attributes.position;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < gp.count; i++) {
      const y = wildsHeightAt(cx0 + gp.getX(i), cz0 + gp.getZ(i));
      gp.setY(i, y);
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    gp.needsUpdate = true;
    groundGeo.computeVertexNormals();
    // Height tinting — bog-dark/earthy in the hollows, brighter moss on the
    // rises. Vertex colors MULTIPLY the floor texture (so the whole floor still
    // reads as one surface, just shaded by elevation).
    const span = maxY - minY;
    if (span > 1) {
      const low = new THREE.Color(0x6a6450);  // dim, earthy — lowland/bog
      const high = new THREE.Color(0xdfe6c0); // bright, mossy — highland
      const tmp = new THREE.Color();
      const colors = new Float32Array(gp.count * 3);
      for (let i = 0; i < gp.count; i++) {
        let t = (gp.getY(i) - minY) / span;
        t = t * t * (3 - 2 * t); // smoothstep for a gentler gradient
        tmp.copy(low).lerp(high, t);
        colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
      }
      groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      tinted = true;
    }
  }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ map: grassTex, vertexColors: tinted }));
  ground.position.set(cx0, 0, cz0);
  scene.add(ground);

  // ── Hexstone Roads — glowing witch-sigil paths linking the landmarks. Flat,
  // walk-on planks (no colliders); a faint self-glow (emissiveMap) + green
  // sigils read at night. Each plank bakes its own random rotated sigil mix, so
  // no stretch repeats (sigil set: THORNREACH-HEXSTONE-SIGILS.html). Routed as a
  // north-south spine from the portal to the village, with branches out to the
  // giant tree, both faction camps, and the Witch's Cave. ──
  // ── Scattered witch-glyphs — glowing sigils burned into the Wilds ground all
  // over (no formal paths). Flat decals, unlit + additive so they glow green in
  // the dark; a fixed seed so every player sees the same marks. ──
  // Each glyph is now TWO stacked planes (see makeGroundSigilTextures): a
  // dark scorch/char stain burned into the ground, and a molten witchfire
  // glow riding just above it. The scorch is unlit + normal-blended so the
  // mark reads as scorched dead earth in daylight and at night alike; the
  // glow is additive + tinted so it still burns green/teal/violet in the
  // dark. The glow breathes — but each glyph gets its OWN phase and speed so
  // the whole map never pulses in unison (it'd look like one switch).
  const sigilTex = makeGroundSigilTextures(); // [{ scorch, glow }, …]
  const glyphCols = [0x7dffb0, 0x7dffb0, 0x7dffb0, 0x9be7ff, 0xc69bff]; // mostly green, some teal/violet
  let gseed = 0x51611 >>> 0; const grand = () => { gseed = (gseed * 1664525 + 1013904223) >>> 0; return gseed / 4294967296; };

  // A glyph is no longer a single flat quad — on rolling terrain a flat plane
  // set to the ground height at its CENTRE gets swallowed by any rise across
  // its footprint (reported: half the pentacle vanishing into a hill). So
  // each decal is a subdivided grid draped over the heightfield: every vertex
  // rides wildsHeightAt(worldX, worldZ) + a small lift, so the mark hugs the
  // hills and conforms to slopes instead of cutting a flat slice through them.
  // (We sample more densely than the terrain mesh's own segments, so the decal
  // can only ride on or just above the surface, never below it.) The mesh sits
  // at (gx, 0, gz); a vertex's local (x,z) carries the glyph's random spin, and
  // its y is the absolute terrain height there plus `lift`.
  const sampleH = (typeof wildsHeightAt === 'function') ? wildsHeightAt : () => 0;
  const SEG = 12;
  function conformingDecal(gx, gz, size, rot, lift) {
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const n = SEG + 1, pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        const u = k / SEG, v = j / SEG;
        const px = (u - 0.5) * size, pz = (v - 0.5) * size; // centred local plane
        const rx = px * cos - pz * sin, rz = px * sin + pz * cos; // apply glyph spin
        const idx = j * n + k;
        pos[idx * 3] = rx;
        pos[idx * 3 + 1] = sampleH(gx + rx, gz + rz) + lift;
        pos[idx * 3 + 2] = rz;
        uv[idx * 2] = u; uv[idx * 2 + 1] = v;
      }
    }
    const index = [];
    for (let j = 0; j < SEG; j++) {
      for (let k = 0; k < SEG; k++) {
        const a = j * n + k, b = a + 1, c = a + n, d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    return geo;
  }

  // Landmarks players actually stand on. The scattered glyphs used to burn
  // straight through the arrival clearing, the portals, the ritual altar, the
  // village and the camps — a sigil cutting across whatever you walked up to.
  // A glyph that rolls inside one of these rings is pushed radially out to the
  // ring's edge; every glyph that DIDN'T land on a landmark keeps its exact
  // spot (the RNG stream is untouched), so this only relocates the offenders.
  const glyphKeepClear = [
    { x: w2.spawn.x,            z: w2.spawn.y,            r: 300 }, // arrival clearing
    { x: w2.spawn.x + 170,      z: w2.spawn.y + 20,       r: 130 }, // return portal
    { x: WITCH_CAVE_ENTRANCE_X, z: WITCH_CAVE_ENTRANCE_Z, r: 230 }, // Witch's Cave mouth
    { x: 2200, z: 5000, r: 240 }, // the Unbound Circle ritual altar
    { x: 5000, z: 3000, r: 620 }, // the village (town-scale buildings spread wider)
    { x: 6500, z: 6200, r: 220 }, // the giant werewolf tree
    { x: 7800, z: 5000, r: 230 }, // the Thornwarden camp
  ];
  const nudgeOffLandmarks = (x, z) => {
    for (const c of glyphKeepClear) {
      let dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
      if (d < c.r) {
        if (d < 1e-3) { dx = 1; dz = 0; d = 1; } // dead-centre: pick any direction
        const nd = c.r + 40;
        x = c.x + dx / d * nd;
        z = c.z + dz / d * nd;
      }
    }
    return [x, z];
  };
  for (let i = 0; i < 220; i++) {
    let gx = 300 + grand() * (w2.width - 600), gz = 300 + grand() * (w2.height - 600);
    [gx, gz] = nudgeOffLandmarks(gx, gz);
    const size = 55 + grand() * 120;
    const rot = grand() * Math.PI * 2;
    const pick = sigilTex[(grand() * sigilTex.length) | 0];
    const col = glyphCols[(grand() * glyphCols.length) | 0];

    // scorch stain — sits lowest, a touch wider than the glyph, darkens ground
    const scorchMat = new THREE.MeshBasicMaterial({ map: pick.scorch, transparent: true, depthWrite: false, opacity: 0.82 + grand() * 0.14 });
    const scorch = new THREE.Mesh(conformingDecal(gx, gz, size * 1.3, rot, 0.6), scorchMat);
    scorch.position.set(gx, 0, gz);
    scorch.renderOrder = 1;
    scene.add(scorch);

    // molten glow — additive, tinted, breathing on its own clock
    const glowMat = new THREE.MeshBasicMaterial({ map: pick.glow, transparent: true, color: col, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 });
    const glow = new THREE.Mesh(conformingDecal(gx, gz, size, rot, 1.0), glowMat);
    glow.position.set(gx, 0, gz);
    glow.renderOrder = 2;
    const phase = grand() * Math.PI * 2;           // where in the breath it starts
    const speed = 0.0009 + grand() * 0.0013;        // rad/ms — each glyph drifts
    const baseOp = 0.5 + grand() * 0.22, amp = 0.2 + grand() * 0.08;
    glow.onBeforeRender = () => { glowMat.opacity = baseOp + amp * Math.sin(performance.now() * speed + phase); };
    scene.add(glow);
  }

  // ── Spirit-wisps — small will-o'-the-wisp motes that drift and bob slowly
  // over the moor, mostly sickly green with a few violet (the Hagstone's
  // otherworld bleeding through). Each rides the heightfield under it and
  // wanders a slow lissajous path on its own clock, so the field shimmers
  // with faint wandering lights at night rather than sitting dead still.
  // Additive, depthWrite off, unlit — they glow in the dark and fade by day
  // along with everything else the night grading dims. ──
  // One GPU-animated THREE.Points carries the whole field instead of 46 CPU
  // sprites. Each mote's drift (lissajous on x/z), bob and opacity breath are
  // computed in the vertex shader from a single uTime uniform, so the field is
  // ONE draw call and costs ~0 CPU per frame (vs 46 onBeforeRender callbacks
  // each doing trig + a heightfield sample). The ground height is sampled ONCE
  // per mote at build — they wander only ~40-90u over gentle moor, so a constant
  // base reads identically — and additive blending keeps them glowing at night
  // and washing out by day, exactly like the sprites.
  const WISP_N = 46;
  const wispGeo = new THREE.BufferGeometry();
  const wPos = new Float32Array(WISP_N * 3);    // base wx, groundY, wz
  const wWander = new Float32Array(WISP_N * 4); // rx, rz, hoverBase, bob
  const wFreq = new Float32Array(WISP_N * 3);   // sx, sz, sy
  const wPhase = new Float32Array(WISP_N * 3);  // px, pz, py
  const wPulse = new Float32Array(WISP_N * 3);  // baseOp, opAmp, sop
  const wSize = new Float32Array(WISP_N);
  const wColor = new Float32Array(WISP_N * 3);
  const wGreen = new THREE.Color(0x8dffbe), wViolet = new THREE.Color(0xbfa0ff);
  for (let i = 0; i < WISP_N; i++) {
    const wx = 300 + grand() * (w2.width - 600), wz = 300 + grand() * (w2.height - 600);
    wPos[i * 3] = wx; wPos[i * 3 + 1] = sampleH(wx, wz); wPos[i * 3 + 2] = wz;
    wWander[i * 4] = 40 + grand() * 90; wWander[i * 4 + 1] = 40 + grand() * 90; wWander[i * 4 + 2] = 28 + grand() * 90; wWander[i * 4 + 3] = 10 + grand() * 22;
    wFreq[i * 3] = 0.00012 + grand() * 0.0003; wFreq[i * 3 + 1] = 0.00012 + grand() * 0.0003; wFreq[i * 3 + 2] = 0.0004 + grand() * 0.0008;
    wPhase[i * 3] = grand() * 6.2832; wPhase[i * 3 + 1] = grand() * 6.2832; wPhase[i * 3 + 2] = grand() * 6.2832;
    wPulse[i * 3] = 0.4 + grand() * 0.35; wPulse[i * 3 + 1] = 0.18 + grand() * 0.14; wPulse[i * 3 + 2] = 0.0009 + grand() * 0.0016;
    wSize[i] = 7 + grand() * 10;
    const c = ((grand() * 4) | 0) === 3 ? wViolet : wGreen; // ~3/4 green, 1/4 violet
    wColor[i * 3] = c.r; wColor[i * 3 + 1] = c.g; wColor[i * 3 + 2] = c.b;
  }
  wispGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
  wispGeo.setAttribute('aWander', new THREE.BufferAttribute(wWander, 4));
  wispGeo.setAttribute('aFreq', new THREE.BufferAttribute(wFreq, 3));
  wispGeo.setAttribute('aPhase', new THREE.BufferAttribute(wPhase, 3));
  wispGeo.setAttribute('aPulse', new THREE.BufferAttribute(wPulse, 3));
  wispGeo.setAttribute('aSize', new THREE.BufferAttribute(wSize, 1));
  wispGeo.setAttribute('aColor', new THREE.BufferAttribute(wColor, 3));
  // Match the old sprite's world-size → on-screen-size mapping (perspective
  // attenuation): pixels = worldSize * (viewportH/2) / (tan(fov/2) * dist).
  const wispPixelScale = (window.innerHeight * 0.5) / Math.tan((62 * Math.PI / 180) / 2);
  const wispMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTex: { value: makeGlowTexture() }, uPixelScale: { value: wispPixelScale } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime; uniform float uPixelScale;
      attribute vec4 aWander; attribute vec3 aFreq; attribute vec3 aPhase; attribute vec3 aPulse; attribute float aSize; attribute vec3 aColor;
      varying vec3 vColor; varying float vOpacity;
      void main() {
        float t = uTime;
        vec3 p = position;
        p.x += sin(t * aFreq.x + aPhase.x) * aWander.x;
        p.z += cos(t * aFreq.y + aPhase.y) * aWander.y;
        p.y += aWander.z + sin(t * aFreq.z + aPhase.z) * aWander.w;
        vColor = aColor;
        vOpacity = max(0.0, aPulse.x + aPulse.y * sin(t * aPulse.z + aPhase.x));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (uPixelScale / -mv.z);
      }`,
    fragmentShader: `
      uniform sampler2D uTex;
      varying vec3 vColor; varying float vOpacity;
      void main() {
        vec4 tex = texture2D(uTex, gl_PointCoord);
        gl_FragColor = vec4(vColor * tex.rgb, tex.a * vOpacity);
      }`,
  });
  const wisps = new THREE.Points(wispGeo, wispMat);
  wisps.frustumCulled = false;
  wisps.renderOrder = 3;
  wisps.onBeforeRender = () => { wispMat.uniforms.uTime.value = performance.now(); };
  scene.add(wisps);

  addNatureDecor(scene, w2, getDecorVisuals2(), WILDS_WALLS);
  getAddAnimals2()(scene);
  getAddMobs2()(scene);
  getAddMobs3()(scene);
  addSpookyDecor(scene, w2);
  addVillageBuildings(scene);
  addUnboundCircleSet(scene);
  addThornwardenCamp(scene);
  addGiantWerewolfTree(scene);
  buildWildsNPCs(scene);

  // The return portal back to town — parked EAST of the arrival spot, not
  // north of it. It used to sit at spawn.y - 80, squarely in the walking
  // line toward everything worth seeing (all the content is north), so
  // players strolled straight into its interact radius and the mobile tap
  // button popped up right under the thumb that was about to turn the
  // camera — instant accidental bounce back to town. Off to the side, you
  // only reach it on purpose.
  const returnPortalX = w2.spawn.x + 170, returnPortalY = w2.spawn.y + 20;
  scene.add(buildPortalMesh(returnPortalX, returnPortalY));
  WILDS_KIOSKS.push({ x: returnPortalX, z: returnPortalY, portal: 'town' });

  // Witch cave entrance — a mound of KayKit Forest boulders shouldering each
  // other around a dark maw, a little moss on the high stones, rubble at the
  // foot. (Was flat-shaded dodecahedra; the KayKit rocks match the reskinned
  // Wilds.)
  const CX = WITCH_CAVE_ENTRANCE_X, CZ = WITCH_CAVE_ENTRANCE_Z;
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x4a4550 });
  const rockDark = new THREE.MeshLambertMaterial({ color: 0x38343f });
  const mossMat = new THREE.MeshLambertMaterial({ color: 0x2f4a30 });
  // [rockKey, size, dx, y, dz] — base on the ground except the capstone, which
  // is lifted to bridge over the mouth. Procedural fallback keeps the formation
  // if the rock models haven't streamed in yet.
  const CAVE_ROCKS = [
    ['rock1', 230,    0,  0, -70], // the back mountain
    ['rock1', 160, -125,  0, -15], // west shoulder
    ['rock1', 155,  120,  0, -18], // east shoulder
    ['rock2', 150,    0, 80,  -8], // capstone bridging the maw
    ['rock3',  72,  -62,  0,  52], // rubble west of the mouth
    ['rock3',  64,   64,  0,  54], // rubble east of the mouth
    ['rock2',  52, -158,  0,  48], // outlying stone
    ['rock3',  46,  156,  0,  44]  // outlying stone
  ];
  CAVE_ROCKS.forEach(([key, size, dx, y, dz], i) => {
    const b = (KK && KK.staticInstance) ? KK.staticInstance(key, size, 'fit') : null;
    if (b) {
      b.position.set(CX + dx, y, CZ + dz);
      b.rotation.y = i * 1.3;
      scene.add(b);
    } else {
      const fb = new THREE.Mesh(new THREE.DodecahedronGeometry(size * 0.46, 0), i % 2 ? rockDark : rockMat);
      fb.position.set(CX + dx, y + size * 0.32, CZ + dz);
      fb.rotation.set(i * 0.7, i * 1.3, i * 0.5);
      scene.add(fb);
    }
  });
  // Collision on the back mass + two shoulders; the maw side (toward the
  // approach) stays open so you can walk up and press F. Server entry allows
  // anywhere within 140 of the centre (enter_witch_cave), so this never blocks.
  wildsCollide(CX + 0,   CZ - 70, 80); // back mountain
  wildsCollide(CX - 125, CZ - 15, 62); // west shoulder
  wildsCollide(CX + 120, CZ - 18, 60); // east shoulder
  // A little moss on the high stones.
  for (const [dx, y, dz, r] of [[0, 212, -70, 34], [-118, 150, -15, 24], [116, 148, -18, 22]]) {
    const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mossMat);
    moss.scale.y = 0.4;
    moss.position.set(CX + dx, y, CZ + dz);
    scene.add(moss);
  }
  // The maw — a dark mouth low in the face, purple candlelight inside
  const maw = new THREE.Mesh(new THREE.CylinderGeometry(34, 40, 62, 10), new THREE.MeshLambertMaterial({ color: 0x040106 }));
  maw.position.set(CX, 30, CZ + 28);
  scene.add(maw);
  const caveGlow = new THREE.PointLight(0x8822cc, 0.9, 260);
  caveGlow.position.set(CX, 30, CZ + 10);
  scene.add(caveGlow);
  const mawGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0x8822cc, transparent: true, opacity: 0.35, depthWrite: false }));
  mawGlow.scale.set(80, 80, 1);
  mawGlow.position.set(CX, 34, CZ + 30);
  scene.add(mawGlow);
  // A pair of gnarled trees leaning over the formation
  scene.add(makeSpookyTree(CX - 175, CZ - 60));
  scene.add(makeSpookyTree(CX + 180, CZ - 45));
  const caveSign = makeSignSprite('🕯️ Witch\'s Cave — Press F to enter');
  caveSign.position.set(CX, 185, CZ);
  scene.add(caveSign);
  WILDS_KIOSKS.push({ x: CX, z: CZ, portal: 'cave_enter' });

  // Campfires (server-healing rest stops) + lore waymarkers
  for (const f of WILDS_CAMPFIRES) scene.add(makeWildsCampfire(f.x, f.y));
  for (const m of WILDS_WAYMARKERS) {
    scene.add(makeWaymarkerStone(m.x, m.y));
    WILDS_KIOSKS.push({ x: m.x, z: m.y, npc: 'waymark', markerId: m.id, radius: 95 });
  }

  kkWildsDressing(scene, w2);
  kkWildsGroundDetail(scene, w2);
  GFX.addFireflies(scene, [[w2.spawn.x, w2.spawn.y - 300], [w2.width * 0.3, w2.height * 0.42], [w2.width * 0.55, w2.height * 0.3], [w2.width * 0.71, w2.height * 0.6], [w2.width * 0.45, w2.height * 0.55]], 26);
  setWildsScene(scene);
  setWildsCamera(camera);
}

// ---------------------------------------------------------------------------
// Village buildings — placed in the wildlands scene at server-matching coords.
// All positions use world (x, z) → Three.js (x, 0, z). Called once from
// buildWildsScene(); no dynamic state — the NPCs are handled separately.
// ---------------------------------------------------------------------------
const VX = 5000, VZ = 3000; // village center (mirrors VILLAGE_CENTER on server)

function addVillageBuildings(scene) {
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8a7c6e });
  const woodMat  = new THREE.MeshLambertMaterial({ color: 0x6b4226 });

  // Sit the whole village on the rolling moor: lift every added object by the
  // terrain height at its own x/z (mirrors kkWildsDressing). KayKit buildings
  // placed via kkPlace(scene, …) ride this too, since kkPlace adds through it.
  const rawScene = scene;
  scene = { add: (o) => { if (o && o.position) o.position.y += wildsHeightAt(o.position.x, o.position.z); rawScene.add(o); } };

  function box(w, h, d, mat, px, py, pz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz);
    scene.add(m);
    return m;
  }

  // ── KayKit Hexagon buildings replace the old box huts. Weathered green/yellow
  // so the Wildlands Village reads as its own rough settlement, not the red
  // town. kkPlace falls back to null only if the models haven't loaded — but
  // the Wilds is built lazily on first portal entry, long after KK settles.
  // Town-scale buildings (the town places its own at ~375-475 'fit'), spread
  // out so the bigger footprints don't overlap. Weathered green/yellow so the
  // Wildlands Village still reads as its own settlement, not the red town.
  // Footprints spread much wider than before (the old ±470-505 ring crowded the
  // hall and left the Artificer squeezed against the blacksmith stall). Each
  // building now sits on its own plot around a roomy commons, with the Artificer
  // given his own corner to the far east (below).
  kkPlace(scene, 'vil_hall', VX, VZ, 440, Math.PI, 'fit');                    // Village Hall (big yellow hall) — the anchor, dead center
  const lhSign = makeSignSprite('🏚️ Village Hall');
  lhSign.position.set(VX, 660, VZ); scene.add(lhSign);
  kkPlace(scene, 'vil_home', VX - 720, VZ - 40, 390, Math.PI / 2, 'fit');     // Barn (far west)
  kkPlace(scene, 'vil_tower', VX - 150, VZ - 660, 400, 0, 'fit');             // Guard tower (green, far north)
  kkPlace(scene, 'vil_home', VX - 620, VZ + 560, 375, 0.3, 'fit');            // Cottage A (yellow, far SW)
  kkPlace(scene, 'bld_arcade', VX + 640, VZ + 560, 375, -0.35, 'fit');        // Cottage B (red, far SE)
  kkPlace(scene, 'prop_stall', VX + 330, VZ + 330, 220, -Math.PI / 2, 'fit'); // Market stall (front-east commons — moved off the Artificer's plot)
  kkPlace(scene, 'prop_well', VX, VZ + 360, 60, 0, 'fit');                    // Village well (front courtyard)

  // ── The Artificer's forge-tower — the vampire lord now has a structure of his
  // own on a dedicated plot at the far east of the commons, instead of a throne
  // marooned in the open between the hall and a stall. His red forge-tower stands
  // at the back (north); the forge, anvil and his throne sit in front of its door
  // (south), facing the players who approach from the village entrance. Press F
  // here opens the same Workshop UI as the menu (see the 'artificer' kiosk
  // handler in main.js); crafting still fires the craft_item quest event
  // server-side, so nothing else changes.
  const ABX = VX + 720, ABZ = VZ - 150;              // the forge-tower (his own corner)
  kkPlace(scene, 'bld_lounge', ABX, ABZ, 360, Math.PI, 'fit'); // The Artificer's forge-tower (dark red keep)
  const AFX = ABX, AFZ = ABZ + 200;                  // forge in the yard in front of the tower
  const ironMat = new THREE.MeshLambertMaterial({ color: 0x2b2b30 });
  const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(18, 20, 12), ironMat);
  anvilBase.position.set(AFX - 40, 10, AFZ); scene.add(anvilBase);
  const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(36, 9, 16), ironMat);
  anvilTop.position.set(AFX - 40, 24, AFZ); scene.add(anvilTop);
  const anvilHorn = new THREE.Mesh(new THREE.ConeGeometry(5, 16, 6), ironMat);
  anvilHorn.rotation.z = -Math.PI / 2; anvilHorn.position.set(AFX - 64, 24, AFZ); scene.add(anvilHorn);
  // Forge hearth with glowing coals + warm light
  const hearth = new THREE.Mesh(new THREE.CylinderGeometry(20, 24, 28, 8), stoneMat);
  hearth.position.set(AFX + 60, 14, AFZ); scene.add(hearth);
  const coals = new THREE.Mesh(new THREE.SphereGeometry(14, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xff5a1e, emissive: 0xff3300, emissiveIntensity: 0.9 }));
  coals.scale.y = 0.5; coals.position.set(AFX + 60, 29, AFZ); scene.add(coals);
  const forgeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xff7a2a, transparent: true, opacity: 0.5, depthWrite: false }));
  forgeGlow.scale.set(80, 80, 1); forgeGlow.position.set(AFX + 60, 36, AFZ); scene.add(forgeGlow);
  const forgeLight = new THREE.PointLight(0xff7a2a, 1.1, 280);
  forgeLight.position.set(AFX + 60, 42, AFZ); scene.add(forgeLight);
  // The Artificer — a vampire lord on his throne before the forge, now sized like
  // a lord rather than a giant (85 vs the old 140; a plain villager is 68). The
  // throne scales by the SAME factor as before (ratio 134/140 preserved) so the
  // shared-rig Sit_Chair_Idle clip still lands him on the seat; both face +z
  // toward approaching players. Falls back to the procedural smith until the
  // bodies stream in.
  const artX = AFX + 10, artZ = AFZ + 40;
  let artLabelY = 60;
  const vampReady = hasKK && hasKK('npc_vampire') && hasKK('prop_throne') && createKayKitByKey && KK.staticInstance;
  if (vampReady) {
    const throne = KK.staticInstance('prop_throne', 81, 'height');
    if (throne) { throne.position.set(artX, 0, artZ); scene.add(throne); }
    const built = createKayKitByKey('npc_vampire', 85);
    if (kkSetState && built.kk) kkSetState(built.kk, 'Sit_Chair_Idle');
    built.group.position.set(artX, 0, artZ);
    scene.add(built.group);
    artLabelY = 104;
  } else {
    const artificer = createHumanoid(1).group;
    artificer.position.set(artX, 0, artZ); artificer.rotation.y = Math.PI; scene.add(artificer);
  }
  const artLabel = makeNpcNameSprite('⚒️ The Artificer');
  artLabel.position.set(artX, artLabelY, artZ); scene.add(artLabel);
  const forgeSign = makeSignSprite('🔨 Artificer\'s Workshop — Press F');
  forgeSign.position.set(AFX + 30, 118, AFZ); scene.add(forgeSign);
  WILDS_KIOSKS.push({ x: AFX + 10, z: AFZ + 40, npc: 'artificer', radius: 120 });

  // ── Mother Yarrow's garden — the Green Path's hedgewitch, on her own fenced
  // plot just north-west of the Artificer's forge. A low KayKit fence rings a
  // little bed of flowers and growing herbs; walking up and pressing F opens the
  // Garden (and its Almanac), the same UI as the menu. Placed clear of the hall
  // (center) and the forge-tower (east). ──
  const GX = VX + 430, GZ = VZ - 320;        // the garden plot center
  const GW = 150, GH = 120;                   // half-extents of the fenced bed
  // A three-sided fence (open on the south, where players approach Yarrow).
  if (hasKK && hasKK('prop_fence')) {
    const fencePost = (fx, fz, rot) => { try { kkPlace(scene, 'prop_fence', fx, fz, 56, rot, 'fit'); } catch (e) {} };
    for (let x = -GW; x <= GW; x += 50) { fencePost(GX + x, GZ - GH, 0); }          // north rail
    for (let z = -GH; z <= GH - 30; z += 50) { fencePost(GX - GW, GZ + z, Math.PI / 2); fencePost(GX + GW, GZ + z, Math.PI / 2); } // east/west rails
  }
  // Flower beds + growing herbs inside the plot (procedural, always present).
  const gardenColors = [0xff8fb3, 0xf4c838, 0xc07ad0, 0xffffff, 0xff9a3c, 0x9a7bc8];
  try {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const px = GX - 90 + c * 60 + (r % 2 ? 14 : 0);
        const pz = GZ - 70 + r * 52;
        const col = gardenColors[(r * 4 + c) % gardenColors.length];
        if ((r + c) % 2 === 0 && makeFlowerPatch) { const fp = makeFlowerPatch(px, pz, 1.1); if (fp) scene.add(fp); }
        else if (makePlantBloom) { const pb = makePlantBloom(px, pz, col, false); if (pb) scene.add(pb); }
      }
    }
  } catch (e) { /* decorative only */ }
  // Mother Yarrow herself — a hooded hedgewitch (charId 2), at the south edge of
  // her bed, facing the players who walk up from the village commons.
  const myX = GX, myZ = GZ + GH - 6;
  try {
    const yarrow = createHumanoid(2).group;
    yarrow.position.set(myX, 0, myZ); yarrow.rotation.y = 0; scene.add(yarrow);
  } catch (e) { /* model may still be streaming */ }
  const yarrowLabel = makeNpcNameSprite('🌿 Mother Yarrow');
  yarrowLabel.position.set(myX, 60, myZ); scene.add(yarrowLabel);
  const gardenSign = makeSignSprite('🌿 Mother Yarrow — the Green Path · Press F');
  gardenSign.position.set(myX, 104, myZ); scene.add(gardenSign);
  WILDS_KIOSKS.push({ x: myX, z: myZ, npc: 'yarrow', radius: 110 });

  // ── Fire pit (SW courtyard, clear of the hall and the Artificer's east plot)
  const FPX = VX - 230, FPZ = VZ + 360;
  const emberMat = new THREE.MeshLambertMaterial({ color: 0xff5500, emissive: 0xff2200, emissiveIntensity: 0.8 });
  const fireMesh = new THREE.Mesh(new THREE.SphereGeometry(14, 8, 6), emberMat);
  fireMesh.position.set(FPX, 8, FPZ); scene.add(fireMesh);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 10), stoneMat);
    stone.position.set(FPX + Math.cos(a) * 22, 5, FPZ + Math.sin(a) * 22);
    stone.rotation.y = a; scene.add(stone);
  }
  const fireLight = new THREE.PointLight(0xff6600, 1.4, 320);
  fireLight.position.set(FPX, 35, FPZ); scene.add(fireLight);

  // (Cottages A/B now placed as KayKit homes above.)

  // ── Construction site (half-built wall segments + scaffolding), out at the NW
  // corner so it clears the hall and the Artificer's east forge-tower plot.
  const CSX = VX - 480, CSZ = VZ - 470;
  const csMat = new THREE.MeshLambertMaterial({ color: 0x9a8a76 });
  box(90, 30, 10, csMat, CSX - 40, 15, CSZ);
  box(10, 55, 80, csMat, CSX - 85, 27, CSZ);
  box(10, 42, 80, csMat, CSX + 5,  21, CSZ);
  box(100, 4, 85, woodMat, CSX - 40, 3, CSZ);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x8b6330 });
  for (const [px, pz] of [[CSX - 80, CSZ + 40], [CSX - 80, CSZ - 40], [CSX + 5, CSZ + 40], [CSX + 5, CSZ - 40]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 90, 6), poleMat);
    pole.position.set(px, 45, pz); scene.add(pole);
  }
  box(92, 5, 8, woodMat, CSX - 38, 72, CSZ + 40);
  box(92, 5, 8, woodMat, CSX - 38, 72, CSZ - 40);
  box(8, 5, 88, woodMat, CSX - 80, 72, CSZ);
  box(8, 5, 88, woodMat, CSX + 5, 72, CSZ);

  // ── Village entrance sign (south approach)
  const entranceSign = makeSignSprite('🏘️ Wildlands Village');
  entranceSign.position.set(VX, 200, VZ + 560); scene.add(entranceSign);
}

// ---------------------------------------------------------------------------
// Wildlands NPC factions — set pieces + humanoid meshes + kiosk registration
// ---------------------------------------------------------------------------

// The Unbound Circle — standing-stone ritual site in the western wilds
function addUnboundCircleSet(scene) {
  const CX = 2200, CZ = 5000;   // world coords (Three.js x/z)
  const stoneMat  = new THREE.MeshLambertMaterial({ color: 0x4a4a5a });
  const altarMat  = new THREE.MeshLambertMaterial({ color: 0x2a2035 });
  const runeMat   = new THREE.MeshLambertMaterial({ color: 0x7722cc, emissive: 0x4411aa, emissiveIntensity: 0.6 });
  const fireMat   = new THREE.MeshLambertMaterial({ color: 0x8800ff, emissive: 0x5500cc, emissiveIntensity: 1 });

  // 8 standing megaliths arranged in a ring, radius 110
  const stoneHeights = [105, 88, 115, 78, 98, 120, 85, 95];
  const stoneWidths  = [22,  18, 25,  16, 20, 24,  17, 21];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const sx = CX + Math.sin(angle) * 110;
    const sz = CZ + Math.cos(angle) * 110;
    const h  = stoneHeights[i], w = stoneWidths[i];
    const stone = new THREE.Mesh(new THREE.BoxGeometry(w, h, 15), stoneMat);
    stone.position.set(sx, h / 2, sz);
    stone.rotation.y = angle + 0.08 * (i % 3 - 1);   // slight individual tilt
    stone.rotation.z = (Math.sin(i * 2.7) * 0.04);
    scene.add(stone);
    // Carved rune glyph on inner face
    const rune = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, h * 0.3, 1), runeMat);
    rune.position.set(sx - Math.sin(angle) * 8, h * 0.55, sz - Math.cos(angle) * 8);
    rune.rotation.y = angle;
    scene.add(rune);
  }

  // Flat central altar slab
  const altar = new THREE.Mesh(new THREE.BoxGeometry(70, 18, 45), altarMat);
  altar.position.set(CX, 9, CZ);
  scene.add(altar);
  // Glowing rune surface on top of altar
  const runeTop = new THREE.Mesh(new THREE.BoxGeometry(58, 1, 35), runeMat);
  runeTop.position.set(CX, 18.5, CZ);
  scene.add(runeTop);

  // Ritual fire above altar — two concentric spheres
  const outerFlame = new THREE.Mesh(new THREE.SphereGeometry(9, 9, 9), fireMat);
  outerFlame.position.set(CX, 32, CZ);
  scene.add(outerFlame);
  const innerFlame = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xcc44ff, emissive: 0xaa22ee, emissiveIntensity: 1 }));
  innerFlame.position.set(CX, 34, CZ);
  scene.add(innerFlame);

  // Arcane glow illuminating the whole circle
  const circleGlow = new THREE.PointLight(0x7700cc, 1.2, 350);
  circleGlow.position.set(CX, 40, CZ);
  scene.add(circleGlow);
  const ambientPurple = new THREE.PointLight(0x440088, 0.5, 600);
  ambientPurple.position.set(CX, 5, CZ);
  scene.add(ambientPurple);

  // 4 torch sticks around the perimeter (inside the ring)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const tx = CX + Math.sin(angle) * 70, tz = CZ + Math.cos(angle) * 70;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 55, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a2208 }));
    stick.position.set(tx, 27.5, tz);
    scene.add(stick);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(5, 7, 7),
      new THREE.MeshLambertMaterial({ color: 0xcc44ff, emissive: 0x8800bb, emissiveIntensity: 1 }));
    flame.scale.y = 1.5; flame.position.set(tx, 60, tz);
    scene.add(flame);
    const tLight = new THREE.PointLight(0xaa33cc, 0.7, 130);
    tLight.position.set(tx, 62, tz);
    scene.add(tLight);
  }

  // Scattered boundary stones (smaller, leaning markers outside the ring)
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const bx = CX + Math.sin(angle) * 155, bz = CZ + Math.cos(angle) * 155;
    const bh = 20 + (i % 3) * 8;
    const bstone = new THREE.Mesh(new THREE.BoxGeometry(10, bh, 8), stoneMat);
    bstone.position.set(bx, bh / 2, bz);
    bstone.rotation.y = angle;
    bstone.rotation.z = Math.sin(i * 1.9) * 0.15;
    scene.add(bstone);
  }

  // Circle name sign
  const circleSign = makeNpcNameSprite('The Unbound Circle');
  circleSign.position.set(CX, 155, CZ);
  scene.add(circleSign);
}

// The Thornwarden Scouts — fortified camp in the eastern wilds
function addThornwardenCamp(scene) {
  const CX = 7800, CZ = 5000;
  const postMat   = new THREE.MeshLambertMaterial({ color: 0x2a1a08 });
  const tentMat   = new THREE.MeshLambertMaterial({ color: 0x7a5a28 });
  const tentDkMat = new THREE.MeshLambertMaterial({ color: 0x5a3e18 });
  const metalMat  = new THREE.MeshLambertMaterial({ color: 0x6a6a74 });
  const fireMat   = new THREE.MeshLambertMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 1 });

  // Palisade perimeter: staked posts in a rough rectangle 320×240
  const pW = 320, pH = 240, postSpacing = 38;
  const perimeter = [];
  for (let x = -pW/2; x <= pW/2; x += postSpacing) perimeter.push([x, -pH/2], [x, pH/2]);
  for (let z = -pH/2 + postSpacing; z < pH/2; z += postSpacing) perimeter.push([-pW/2, z], [pW/2, z]);
  for (const [px, pz] of perimeter) {
    const h = 72 + Math.sin(px * 0.3 + pz * 0.2) * 12;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, h, 5), postMat);
    post.position.set(CX + px, h / 2, CZ + pz);
    post.rotation.y = Math.sin(px + pz) * 0.08;
    scene.add(post);
    // Sharpened top cap
    const tip = new THREE.Mesh(new THREE.ConeGeometry(5, 18, 5), postMat);
    tip.position.set(CX + px, h + 9, CZ + pz);
    scene.add(tip);
  }

  // Top crossbeam rails connecting posts on north/south edges
  for (const pz of [-pH/2, pH/2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(pW, 10, 10), postMat);
    rail.position.set(CX, 70, CZ + pz);
    scene.add(rail);
  }

  // Tent 1 — western half (pyramid/cone tent)
  function addTent(tx, tz, rot) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(110, 4, 80), tentDkMat);
    base.position.set(tx, 2, tz);
    scene.add(base);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0, 64, 90, 4, 1), tentMat);
    body.position.set(tx, 47, tz);
    body.rotation.y = rot;
    scene.add(body);
    const opening = new THREE.Mesh(new THREE.BoxGeometry(28, 55, 6), tentDkMat);
    opening.position.set(tx, 28, tz + 42);
    opening.rotation.y = rot;
    scene.add(opening);
  }
  addTent(CX - 80, CZ - 60, Math.PI / 4);
  addTent(CX + 80, CZ - 60, Math.PI / 4);

  // Supply crates — stacked in corner
  for (let ci = 0; ci < 5; ci++) {
    const cw = 35 + (ci % 2) * 5, ch = 30 + (ci % 3) * 5;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, 30),
      new THREE.MeshLambertMaterial({ color: 0x5a3a18 }));
    const row = Math.floor(ci / 3), col = ci % 3;
    crate.position.set(CX - 110 + col * 38, ch / 2 + row * 32, CZ + 70);
    scene.add(crate);
    // Iron banding on crate
    const band = new THREE.Mesh(new THREE.BoxGeometry(cw + 2, 5, 32), metalMat);
    band.position.set(CX - 110 + col * 38, ch / 2 + row * 32, CZ + 70);
    scene.add(band);
  }

  // Watch tower — north-east corner
  const twX = CX + 120, twZ = CZ - 95;
  for (const [ox, oz] of [[-22,-22],[22,-22],[-22,22],[22,22]]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 130, 6), postMat);
    pillar.position.set(twX + ox, 65, twZ + oz);
    scene.add(pillar);
  }
  const platform = new THREE.Mesh(new THREE.BoxGeometry(80, 12, 80), postMat);
  platform.position.set(twX, 131, twZ);
  scene.add(platform);
  const railing = new THREE.Mesh(new THREE.BoxGeometry(84, 18, 84), postMat);
  railing.position.set(twX, 149, twZ);
  // Hollow it out with an inner box — use wireframe approximation with 4 thin planks
  for (const [rox, roz, rw, rd] of [
    [0, -42, 84, 6], [0, 42, 84, 6], [-42, 0, 6, 84], [42, 0, 6, 84]
  ]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(rw, 18, rd), postMat);
    plank.position.set(twX + rox, 149, twZ + roz);
    scene.add(plank);
  }
  // Ladder rungs on south face of tower
  for (let ri = 0; ri < 6; ri++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 38, 5), postMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(twX, 18 + ri * 18, twZ + 23);
    scene.add(rung);
  }

  // Central bonfire
  const fireBase = new THREE.Mesh(new THREE.CylinderGeometry(24, 28, 8, 10),
    new THREE.MeshLambertMaterial({ color: 0x555544 }));
  fireBase.position.set(CX, 4, CZ + 55);
  scene.add(fireBase);
  for (let fi = 0; fi < 8; fi++) {
    const angle = (fi / 8) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 50, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a2208 }));
    log.rotation.z = Math.PI / 2 - 0.3;
    log.rotation.y = angle;
    log.position.set(CX + Math.sin(angle) * 12, 8, CZ + 55 + Math.cos(angle) * 12);
    scene.add(log);
  }
  const fireFlame = new THREE.Mesh(new THREE.SphereGeometry(14, 9, 9), fireMat);
  fireFlame.scale.y = 1.8; fireFlame.position.set(CX, 28, CZ + 55);
  scene.add(fireFlame);
  const campLight = new THREE.PointLight(0xff6600, 1.4, 320);
  campLight.position.set(CX, 35, CZ + 55);
  scene.add(campLight);

  // Weapon rack — crossed swords shape
  const rackX = CX + 90, rackZ = CZ + 40;
  const rackPost = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 80, 6), postMat);
  rackPost.position.set(rackX, 40, rackZ);
  scene.add(rackPost);
  const crossBar = new THREE.Mesh(new THREE.BoxGeometry(70, 8, 8), postMat);
  crossBar.position.set(rackX, 65, rackZ);
  scene.add(crossBar);
  for (const ox of [-28, -10, 10, 28]) {
    const sword = new THREE.Mesh(new THREE.BoxGeometry(7, 45, 4), metalMat);
    sword.position.set(rackX + ox, 43, rackZ);
    sword.rotation.z = (ox < 0 ? 1 : -1) * 0.15;
    scene.add(sword);
  }

  // Flag pole with pennant
  const flagX = CX, flagZ = CZ - 108;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 140, 5), metalMat);
  pole.position.set(flagX, 70, flagZ);
  scene.add(pole);
  const pennant = new THREE.Mesh(new THREE.BoxGeometry(50, 30, 2),
    new THREE.MeshLambertMaterial({ color: 0x8a1010 }));
  pennant.position.set(flagX + 25, 135, flagZ);
  scene.add(pennant);

  // Camp sign
  const campSign = makeNpcNameSprite('Thornwarden Scout Camp');
  campSign.position.set(CX, 160, CZ);
  scene.add(campSign);
}

// ---------------------------------------------------------------------------
// The Ancient One — a massive primordial oak at (6500, 6200) in the Wilds,
// with a treehouse platform where Lexton Greyfur (werewolf) lives. He offers
// the Wolf's Pact Brew in exchange for the player's "contact list" (flavor
// only). At night he howls at the moon, arms raised, head tilted back.
// ---------------------------------------------------------------------------
function addGiantWerewolfTree(scene) {
  const TX = 6500, TZ = 6200;
  const TRUNK_H = 400;
  const PLATFORM_Y = 180; // treehouse floor height

  const darkBark  = new THREE.MeshLambertMaterial({ color: 0x2d1a0a });
  const midBark   = new THREE.MeshLambertMaterial({ color: 0x3d2510 });
  const woodPlank = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
  const darkWood  = new THREE.MeshLambertMaterial({ color: 0x3d2010 });
  const roofMat   = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
  const leafMat   = new THREE.MeshLambertMaterial({ color: 0x1a3d0a });
  const leafMat2  = new THREE.MeshLambertMaterial({ color: 0x0f2d04 });
  const leafMat3  = new THREE.MeshLambertMaterial({ color: 0x243d10 });
  const ropeMat   = new THREE.MeshLambertMaterial({ color: 0x8a7040 });

  function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }
  function cyl(rt, rb, h, seg, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }

  // ── Trunk — ancient, gnarled, widens at base
  cyl(60, 85, TRUNK_H, 14, darkBark, TX, TRUNK_H / 2, TZ);
  // Outer texture ring (lighter band)
  cyl(62, 87, TRUNK_H, 14, midBark,  TX, TRUNK_H / 2, TZ);

  // ── Surface roots — 6 large buttress wedges radiating from base
  const ROOT_ANGLES = [0, 60, 120, 180, 240, 300];
  for (const deg of ROOT_ANGLES) {
    const ang = deg * Math.PI / 180;
    const rx = TX + Math.cos(ang) * 90, rz = TZ + Math.sin(ang) * 90;
    const rootMesh = new THREE.Mesh(
      new THREE.BoxGeometry(30, 22, 60),
      darkBark
    );
    rootMesh.position.set(rx, 11, rz);
    rootMesh.rotation.y = ang;
    rootMesh.rotation.z = Math.PI * 0.08;
    scene.add(rootMesh);
    // Tapered knob at end
    const knob = new THREE.Mesh(new THREE.SphereGeometry(14, 7, 7), darkBark);
    knob.position.set(TX + Math.cos(ang) * 115, 5, TZ + Math.sin(ang) * 115);
    scene.add(knob);
  }

  // ── Foliage — stacked sphere clusters spanning y=320 to y=580
  const FOLIAGE = [
    { r: 130, y: 350, dx:  0,  dz:  0,  mat: leafMat  },
    { r: 110, y: 430, dx: 30,  dz:-20,  mat: leafMat2 },
    { r: 115, y: 395, dx:-40,  dz: 30,  mat: leafMat3 },
    { r: 120, y: 460, dx: 20,  dz: 40,  mat: leafMat  },
    { r:  95, y: 500, dx:-25,  dz:-35,  mat: leafMat2 },
    { r: 105, y: 525, dx: 10,  dz: 10,  mat: leafMat3 },
    { r:  80, y: 555, dx:-10,  dz: 20,  mat: leafMat  },
  ];
  for (const f of FOLIAGE) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(f.r, 9, 8), f.mat);
    m.position.set(TX + f.dx, f.y, TZ + f.dz);
    scene.add(m);
  }

  // ── Ladder — cylinder rungs on trunk's south-east face, y=20 to PLATFORM_Y
  const LADDER_ANG = Math.PI * 0.25; // SE side
  const ladderX = TX + Math.cos(LADDER_ANG) * 68;
  const ladderZ = TZ + Math.sin(LADDER_ANG) * 68;
  const sideX = Math.cos(LADDER_ANG + Math.PI / 2);
  const sideZ = Math.sin(LADDER_ANG + Math.PI / 2);
  for (let ry = 22; ry < PLATFORM_Y - 10; ry += 14) {
    // Left rail
    const rungL = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2, 6), ropeMat);
    rungL.position.set(ladderX + sideX * 8, ry, ladderZ + sideZ * 8);
    scene.add(rungL);
    // Right rail
    const rungR = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2, 6), ropeMat);
    rungR.position.set(ladderX - sideX * 8, ry, ladderZ - sideZ * 8);
    scene.add(rungR);
    // Rung crossbar
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 16, 5), darkWood);
    rung.rotation.z = Math.PI / 2;
    rung.rotation.y = LADDER_ANG;
    rung.position.set(ladderX, ry, ladderZ);
    scene.add(rung);
  }

  // ── Treehouse platform — a clean 16-sided wooden deck around the trunk
  // (replaces the old gappy radial planks that splayed out past the railing).
  const PLANK_COUNT = 12, PLANK_H = 6;
  const DECK_R = 140;
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(DECK_R, DECK_R + 4, PLANK_H, 16), woodPlank);
  deck.position.set(TX, PLATFORM_Y + PLANK_H / 2, TZ);
  scene.add(deck);
  // A thin darker underside rim so the deck reads as a solid platform from below.
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(DECK_R + 4, DECK_R - 8, 10, 16), darkWood);
  rim.position.set(TX, PLATFORM_Y - 4, TZ);
  scene.add(rim);

  // Platform railing posts and rails
  for (let i = 0; i < PLANK_COUNT; i++) {
    const ang = (i / PLANK_COUNT) * Math.PI * 2;
    const rx = TX + Math.cos(ang) * 148;
    const rz = TZ + Math.sin(ang) * 148;
    cyl(2, 2, 26, 5, darkWood, rx, PLATFORM_Y + 19, rz);
  }
  // Two rail rings at different heights
  for (const yOff of [8, 18]) {
    for (let i = 0; i < PLANK_COUNT; i++) {
      const a0 = (i / PLANK_COUNT) * Math.PI * 2;
      const a1 = ((i + 1) / PLANK_COUNT) * Math.PI * 2;
      const x0 = TX + Math.cos(a0) * 148, z0 = TZ + Math.sin(a0) * 148;
      const x1 = TX + Math.cos(a1) * 148, z1 = TZ + Math.sin(a1) * 148;
      const midX = (x0 + x1) / 2, midZ = (z0 + z1) / 2;
      const span = Math.hypot(x1 - x0, z1 - z0);
      const railAng = Math.atan2(x1 - x0, z1 - z0);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(span, 2, 3), ropeMat);
      rail.position.set(midX, PLATFORM_Y + PLANK_H + yOff, midZ);
      rail.rotation.y = railAng;
      scene.add(rail);
    }
  }

  // ── Treehouse cabin — a KayKit cottage on the north side of the platform
  // (replaces the old boxy procedural hut), dark-wood tinted so it reads as a
  // weathered treehouse den. Door faces +z toward Lexton + approaching players.
  const HX = TX, HZ = TZ - 90;
  const HOUSE_Y = PLATFORM_Y + PLANK_H;
  let cabinPlaced = false;
  if (KK && KK.staticInstance) {
    // 88 deep (door face lands at ~TZ-46, clearing Lexton at TZ-40); back rests
    // at the north deck edge.
    const house = KK.staticInstance('vil_home', 88, 'fit');
    if (house) {
      house.traverse(c => {
        if (!c.isMesh || !c.material) return;
        const wasArr = Array.isArray(c.material);
        const mats = wasArr ? c.material : [c.material];
        const cl = mats.map(mm => { const m = mm.clone(); if (m.color) m.color.lerp(new THREE.Color(0x3a2a1a), 0.42); return m; });
        c.material = wasArr ? cl : cl[0];
      });
      house.position.set(HX, HOUSE_Y, HZ);
      scene.add(house);
      // warm glow spilling from the cottage + a couple of props for a lived-in den
      const winGlow = new THREE.PointLight(0xffd06a, 1.1, 240);
      winGlow.position.set(HX, HOUSE_Y + 50, HZ + 10); scene.add(winGlow);
      const barrel = KK.staticInstance('prop_barrel', 24, 'height');
      if (barrel) { barrel.position.set(HX + 58, HOUSE_Y, HZ + 8); scene.add(barrel); }
      const crate = KK.staticInstance('prop_crate', 26, 'fit');
      if (crate) { crate.position.set(HX - 58, HOUSE_Y, HZ + 14); crate.rotation.y = 0.5; scene.add(crate); }
      cabinPlaced = true;
    }
  }
  if (!cabinPlaced) {
    // Procedural cold-load fallback — the original boxy hut.
    box(92, 60, 6, woodPlank, HX, HOUSE_Y + 30, HZ - 33);
    box(92, 60, 6, woodPlank, HX, HOUSE_Y + 30, HZ + 33);
    box(6, 60, 66, woodPlank, HX - 46, HOUSE_Y + 30, HZ);
    box(6, 60, 66, woodPlank, HX + 46, HOUSE_Y + 30, HZ);
    box(92, 6, 66, woodPlank, HX, HOUSE_Y + 57, HZ);
    box(20, 36, 8, new THREE.MeshLambertMaterial({ color: 0x080408 }), HX, HOUSE_Y + 18, HZ + 33);
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(8, 14, 8), new THREE.MeshLambertMaterial({ color: 0xffd06a, emissive: 0xffd06a, emissiveIntensity: 0.5 }));
      win.position.set(HX + side * 46, HOUSE_Y + 35, HZ); scene.add(win);
    }
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 60, 50, 4), roofMat);
    roof.position.set(HX, HOUSE_Y + 85, HZ); roof.rotation.y = Math.PI / 4; scene.add(roof);
  }

  // ── Point lights
  // Warm candle glow from inside the treehouse
  const houseLight = new THREE.PointLight(0xffcc66, 1.2, 320);
  houseLight.position.set(HX, HOUSE_Y + 35, HZ);
  scene.add(houseLight);
  // Eerie moonlit blue light at base of tree
  const treeGlow = new THREE.PointLight(0x3355aa, 0.5, 280);
  treeGlow.position.set(TX, 40, TZ);
  scene.add(treeGlow);

  // ── Tree sign
  const treeSign = makeNpcNameSprite('The Ancient One');
  treeSign.position.set(TX, 620, TZ);
  scene.add(treeSign);

  // ── Lexton Greyfur — the KayKit werewolf, out on the balcony looking over the
  // Wilds. Animated via the shared rig (Idle) so he stands naturally rather than
  // in the model's T-pose; the old procedural humanoid is the cold-load fallback.
  let lextonMesh, lextonRefs;
  if (hasKK && hasKK('npc_werewolf') && createKayKitByKey) {
    const built = createKayKitByKey('npc_werewolf', 150);
    lextonMesh = built.group;
    if (kkSetState && built.kk) kkSetState(built.kk, 'Idle');
    lextonRefs = { group: lextonMesh, armL: null, armR: null, head: null, lastHowlAt: 0 };
  } else {
    const b = createHumanoid(1); // charId 1 = Werewolf (procedural fallback)
    lextonMesh = b.group;
    lextonRefs = { group: lextonMesh, armL: b.armL, armR: b.armR, head: b.head, lastHowlAt: 0 };
  }
  // Out on the deck beside the cabin, NOT at TZ-40: the trunk is ~75 units wide
  // at deck height (cyl 60→85 over h400), so the old spot buried him inside it —
  // which is why the werewolf on the balcony was never actually visible. (TX+85,
  // TZ-95) sits him ~127u from the trunk centre: clear of the ~75u trunk, inside
  // the 140u deck, and off to the side of the cabin so nothing hides him.
  lextonMesh.position.set(TX + 85, PLATFORM_Y + PLANK_H, TZ - 95);
  lextonMesh.rotation.y = Math.PI; // faces out over the open Wilds / the approach
  scene.add(lextonMesh);

  const lextonLabel = makeNpcNameSprite('Lexton Greyfur', 'Voice of the Howl');
  lextonLabel.position.set(TX + 85, PLATFORM_Y + PLANK_H + 175, TZ - 95);
  scene.add(lextonLabel);

  setLextonNpc(lextonRefs);

  // ── Register kiosk — 'wolf_pact' type. Large radius so players can interact
  // from anywhere around the wide trunk base without needing to clip into it.
  WILDS_KIOSKS.push({ x: TX, z: TZ, npc: 'wolf_pact', npcName: 'Lexton Greyfur', radius: 200 });
}

// Spawn humanoid NPCs for both factions and register quest kiosks
function buildWildsNPCs(scene) {
  for (const npc of WILDS_NPCS) {
    const mesh = createHumanoid(npc.charId).group;
    mesh.position.set(npc.x, 0, npc.y);
    // Face roughly toward the center of the map (spawn side)
    mesh.rotation.y = Math.atan2(5000 - npc.x, 8800 - npc.y);
    scene.add(mesh);
    const label = makeNpcNameSprite(npc.name);
    label.position.set(npc.x, 90, npc.y);
    scene.add(label);
    WILDS_KIOSKS.push({ x: npc.x, z: npc.y, npc: 'quest', npcId: npc.id, npcName: npc.name });
  }
}

  return { buildWildsScene };
}
