// ---------------------------------------------------------------------------
// Ember Wastes scene (Tier 3.4 Phase C, 3D slice) — the Wilds-styled hostile
// outdoor map behind the temple portal. THREE global; prop-helpers + EMBER_WORLD
// injected; scene/camera/kiosk-lists/mob-visuals written back via get/set.
// ---------------------------------------------------------------------------
export default function createEmberScene({ makeGrassTexture, makeEmberFloorTexture, makeRock, makeTree, buildPortalMesh, EMBER_WORLD, emberHeightAt, KK, setEmberScene, setEmberCamera, getEmberStaticKiosks, setEmberStaticKiosks, setEmberKiosks, getEmberMobVisuals, setEmberMobVisuals, getEmberLandmarks, makeNpcNameSprite }) {
const H = (x, z) => (typeof emberHeightAt === 'function' ? emberHeightAt(x, z) : 0);
// Burnt-over any mesh: pull its colours toward charcoal/scorch so KayKit's
// bright pack tints read as ember-scorched without needing new textures.
function scorch(group, amt) {
  group.traverse(c => {
    if (c.isMesh && c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      c.material = mats.map(mm => {
        const m = mm.clone();
        if (m.color) { m.color.offsetHSL(-0.02, -0.18, -(amt || 0.14)); m.color.lerp(new THREE.Color(0x2a1810), 0.22); }
        return m;
      });
      if (!Array.isArray(c.material)) c.material = c.material[0];
    }
  });
  return group;
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
  for (let i = 0; i < 160; i++) spots.push([m + rnd() * (W - m * 2), m + rnd() * (Hh - m * 2)]);
  const landmarks = (typeof getEmberLandmarks === 'function' && getEmberLandmarks().length)
    ? getEmberLandmarks()
    : [{ x: 5000, y: 6000 }, { x: 15000, y: 8000 }, { x: 10000, y: 3000 }, { x: 16500, y: 15800 }];
  for (const lm of landmarks) {
    for (let i = 0; i < 22; i++) spots.push([lm.x + (rnd() - 0.5) * (lm.radius ? lm.radius * 1.6 : 2400), lm.y + (rnd() - 0.5) * (lm.radius ? lm.radius * 1.6 : 2400)]);
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
  spots.forEach(([x, y], i) => {
    let group = null;
    if (canKK) {
      const [key, size, mode] = DEAD[Math.floor(rnd() * DEAD.length)];
      group = KK.staticInstance(key, size * (0.8 + rnd() * 0.5), mode);
      if (group) { group.rotation.y = rnd() * Math.PI * 2; group.position.set(x, 0, y); scorch(group, 0.1 + rnd() * 0.12); }
    }
    if (!group) { // procedural fallback (cold load)
      group = (i % 2 === 0) ? makeRock(x, y, 1.1 + rnd() * 0.9) : makeTree(x, y, 2.2 + rnd() * 1.4);
      group.traverse(c => { if (c.isMesh && c.material && c.material.color) { c.material = c.material.clone(); c.material.color.offsetHSL(0, 0, -0.08); } });
    }
    scene.add(group);
  });

  // Tombs + ruined gateways clustered at each landmark — gives the POIs the
  // look of a long-dead necropolis on the ember flat.
  if (canKK) {
    for (const lm of landmarks) {
      if (lm.x === undefined) continue;
      const tombs = [['prop_crypt', 110, 'fit'], ['prop_grave_a', 30, 'height'], ['prop_grave_b', 30, 'height'], ['prop_arch', 150, 'fit']];
      for (let i = 0; i < 6; i++) {
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
  const hut = new THREE.Group();
  const hw = 220, hd = 170, hh = 150, wt = 16;
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x4a3a34 });
  const doorGap = 70; // centred gap on the south (+z) wall
  // Four walls; the south wall is split to leave a doorway.
  const wallParts = [
    [hw, hh, wt, 0, hh / 2, -hd / 2],                              // north (back)
    [wt, hh, hd, -hw / 2, hh / 2, 0],                             // west
    [wt, hh, hd, hw / 2, hh / 2, 0],                              // east
    [(hw - doorGap) / 2, hh, wt, -(doorGap + (hw - doorGap) / 2) / 2, hh / 2, hd / 2], // south-left
    [(hw - doorGap) / 2, hh, wt, (doorGap + (hw - doorGap) / 2) / 2, hh / 2, hd / 2]   // south-right
  ];
  for (const [w, h, d, x, y, z] of wallParts) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
    seg.position.set(x, y, z);
    hut.add(seg);
  }
  // A lintel over the door + a peaked roof.
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorGap + 40, 28, wt), stoneMat);
  lintel.position.set(0, hh - 14, hd / 2);
  hut.add(lintel);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(hw * 0.92, 90, 4),
    new THREE.MeshLambertMaterial({ color: 0x2a1c16 })
  );
  roof.position.set(0, hh + 44, 0);
  roof.rotation.y = Math.PI / 4;
  hut.add(roof);
  // Warm light spilling from the doorway + a glow plane so it reads as a haven.
  const doorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(doorGap, hh - 30),
    new THREE.MeshBasicMaterial({ color: 0xffb257, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  doorGlow.position.set(0, (hh - 30) / 2, hd / 2 - 2);
  hut.add(doorGlow);
  const doorLight = new THREE.PointLight(0xffa64d, 1.3, 520);
  doorLight.position.set(0, hh * 0.5, hd / 2 + 40);
  hut.add(doorLight);
  // A hanging sign so it's legible as a refuge from a distance.
  if (typeof makeNpcNameSprite === 'function') {
    const sign = makeNpcNameSprite('⛺ Refuge');
    sign.position.set(0, hh + 110, 0);
    hut.add(sign);
  }
  hut.position.set(REFUGE_X, 0, REFUGE_Z);
  scene.add(hut);
  // Interact door kiosk, just outside the south threshold.
  const refugeKiosk = { x: REFUGE_X, z: REFUGE_Z + hd / 2 + 30, portal: 'refuge_enter' };

  setEmberStaticKiosks([{ x: exitX, z: exitY, portal: 'ember_exit' }, refugeKiosk]);
  setEmberKiosks(getEmberStaticKiosks().slice());

  const _mv = getEmberMobVisuals(); for (const id in _mv) scene.remove(_mv[id].group);
  setEmberMobVisuals({});
}

  return { buildEmberScene };
}
