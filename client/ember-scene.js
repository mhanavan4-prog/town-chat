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
    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld); // bake unit scale + local offset: prop at size 1, base y=0
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
  scene.add(new THREE.AmbientLight(0xff6a4a, 0.62));
  const emberSun = new THREE.DirectionalLight(0xffb070, 0.8);
  emberSun.position.set(400, 700, 250);
  scene.add(emberSun);
  // A low red hemisphere fill so the undersides of props + the far gem field
  // keep a warm ember blush instead of going flat black.
  scene.add(new THREE.HemisphereLight(0xff5533, 0x1a0604, 0.4));

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
      if (lm.x === undefined) continue;
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
      if (g) scene.add(g);
    }
  }
  if (canKK) {
    // Crystal fields scattered the whole zone over, so bare floor is rare.
    for (let i = 0; i < 80; i++) gemCluster(m + rnd() * (W - m * 2), m + rnd() * (Hh - m * 2), 3 + Math.floor(rnd() * 4), 90 + rnd() * 130);
    // A dense ruby reef beside each non-warlord POI.
    for (const lm of landmarks) { if (lm.x !== undefined && !lm.warlord) gemCluster(lm.x + 500, lm.y + 300, 7, 150); }
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
    const crust = new THREE.Mesh(new THREE.RingGeometry(rad, rad + 36, 26), new THREE.MeshBasicMaterial({ color: 0x2e0c06, side: THREE.DoubleSide }));
    crust.rotation.x = -Math.PI / 2; crust.position.set(x, 1.4, z); scene.add(crust);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(rad, 24), new THREE.MeshBasicMaterial({ color: 0xff5a1e }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, 1.8, z); scene.add(pool);
    // a darker molten swirl inset for a bit of depth
    const core = new THREE.Mesh(new THREE.CircleGeometry(rad * 0.5, 20), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    core.rotation.x = -Math.PI / 2; core.position.set(x + (rnd() - 0.5) * rad * 0.3, 2.0, z + (rnd() - 0.5) * rad * 0.3); scene.add(core);
  }

  // ── Ember geysers ────────────────────────────────────────────────────────
  // Thin glowing columns venting from the ground — vertical interest + more
  // silhouettes. Additive, so they read as hot gas rather than solid pillars.
  for (let i = 0; i < 30; i++) {
    const x = m + rnd() * (W - m * 2), z = m + rnd() * (Hh - m * 2), gh = 200 + rnd() * 320;
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
    if (lm.x === undefined) continue;
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

  setEmberStaticKiosks([{ x: exitX, z: exitY, portal: 'ember_exit' }, refugeKiosk, wardenKiosk]);
  setEmberKiosks(getEmberStaticKiosks().slice());

  const _mv = getEmberMobVisuals(); for (const id in _mv) scene.remove(_mv[id].group);
  setEmberMobVisuals({});
}

  return { buildEmberScene };
}
