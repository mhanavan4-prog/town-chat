// ---------------------------------------------------------------------------
// The Wilds scene (Tier 3.4 Phase C, 3D slice). A second outdoor map reached
// via the portal: buildWildsScene assembles the terrain, then its sub-builders
// drop in the ruined village, the unbound circle, the Thornwarden camp, and the
// giant werewolf tree (Lexton's), and buildWildsNPCs spawns the faction NPCs +
// quest kiosks. THREE is a global; layout tables, prop makers, and mob/decor
// helpers are injected; scene/camera + lextonNpc are written back via setters.
// ---------------------------------------------------------------------------
export default function createWildsScene({ GFX, WILDS_CAMPFIRES, WILDS_KIOSKS, WILDS_NPCS, WILDS_WALLS, WILDS_WAYMARKERS, WITCH_CAVE_ENTRANCE_X, WITCH_CAVE_ENTRANCE_Z, getAddMobs2, getAddMobs3, addNatureDecor, addSpookyDecor, buildPortalMesh, createHumanoid, kkWildsDressing, makeSpookyTree, makeWaymarkerStone, makeWildsCampfire, wildsCollide, makeMoorTexture, makeHexstoneTexture, makeGlowTexture, makeSignSprite, makeNpcNameSprite, getDecorVisuals2, getAddAnimals2, setWildsScene, setWildsCamera, setLextonNpc }) {
function buildWildsScene(w2) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd0ef);
  // Fog/camera-far tuned the same way the town's are — distances like this
  // don't need to scale with total map size, just with how far the
  // close-behind third-person camera can usefully see along the ground.
  scene.fog = new THREE.Fog(0x8fd0ef, 700, 2200);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 4000);

  const grassTex = makeMoorTexture(); // Withered Moor ground — matches the town's spooky reskin
  const groundSpan = Math.max(w2.width, w2.height) + 200;
  grassTex.repeat.set(groundSpan / 140, groundSpan / 140);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(w2.width + 200, w2.height + 200),
    new THREE.MeshLambertMaterial({ map: grassTex })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(w2.width / 2, 0, w2.height / 2);
  scene.add(ground);

  // ── Hexstone Roads — glowing witch-sigil paths linking the landmarks. Flat,
  // walk-on planks (no colliders); a faint self-glow (emissiveMap) + green
  // sigils read at night. Each plank bakes its own random rotated sigil mix, so
  // no stretch repeats (sigil set: THORNREACH-HEXSTONE-SIGILS.html). Routed as a
  // north-south spine from the portal to the village, with branches out to the
  // giant tree, both faction camps, and the Witch's Cave. ──
  function hexPath(x1, z1, x2, z2, width) {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    const tex = makeHexstoneTexture();
    tex.repeat.set(Math.max(1, width / 150), Math.max(1, len / 150));
    const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.4 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 1.2, len), mat);
    mesh.rotation.y = Math.atan2(dx, dz);
    mesh.position.set((x1 + x2) / 2, 0.35, (z1 + z2) / 2);
    scene.add(mesh);
  }
  hexPath(w2.spawn.x, w2.spawn.y, 5000, 3000, 220); // spine: portal landing → village crossroads
  hexPath(5000, 6200, 6500, 6200, 170);             // → the Giant Werewolf Tree
  hexPath(5000, 5000, 2360, 5000, 170);             // → the coven camp (Morvaine & co.)
  hexPath(5000, 5000, 7800, 5000, 170);             // → the watch camp (Rhedyn & co.)
  hexPath(5000, 3000, 2000, 2120, 170);             // → the Witch's Cave

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

  // Witch cave entrance — a proper LARGE rock formation now: a mound of
  // huge weathered boulders shouldering each other around a dark maw,
  // mossy caps on top, rubble at the foot — not the old floating box.
  const CX = WITCH_CAVE_ENTRANCE_X, CZ = WITCH_CAVE_ENTRANCE_Z;
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x4a4550 });
  const rockDark = new THREE.MeshLambertMaterial({ color: 0x38343f });
  const mossMat = new THREE.MeshLambertMaterial({ color: 0x2f4a30 });
  // [dx, y, dz, radius, material] — one great back boulder, two shoulders,
  // a capstone bridging the maw, and rubble by the mouth.
  const CAVE_BOULDERS = [
    [0, 55, -55, 105, rockMat],     // the mountain of the thing
    [-105, 42, -10, 70, rockDark],  // west shoulder
    [102, 40, -14, 66, rockMat],    // east shoulder
    [-2, 118, -30, 52, rockDark],   // capstone over the maw
    [-58, 14, 48, 26, rockMat],     // rubble, west of the mouth
    [60, 12, 50, 22, rockDark],     // rubble, east of the mouth
    [-150, 10, 45, 16, rockMat],    // outlying stone
    [148, 9, 40, 14, rockDark]      // outlying stone
  ];
  CAVE_BOULDERS.forEach(([dx, y, dz, r, mat], i) => {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat);
    b.position.set(CX + dx, y, CZ + dz);
    b.rotation.set(i * 0.7, i * 1.3, i * 0.5);
    scene.add(b);
  });
  // Collision for the formation's ground boulders — the visuals alone let
  // players walk straight through the whole cave (reported). Square colliders
  // on the back mountain + two shoulders seal the mass; the maw side (toward
  // the approach) stays open so you can still walk up and press F. Server
  // entry allows anywhere within 140 of the centre (see enter_witch_cave), so
  // this never blocks entry.
  wildsCollide(CX + 0,   CZ - 55, 75); // back mountain
  wildsCollide(CX - 105, CZ - 10, 58); // west shoulder
  wildsCollide(CX + 102, CZ - 14, 55); // east shoulder
  // Moss caps draped on the high stones
  for (const [dx, y, dz, r] of [[-10, 148, -35, 30], [-95, 95, -20, 22], [95, 88, -25, 20]]) {
    const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mossMat);
    moss.scale.y = 0.45;
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
  const woodMat  = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8a7c6e });
  const roofMat  = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
  const thatchMat = new THREE.MeshLambertMaterial({ color: 0xb8933a });
  const darkWood = new THREE.MeshLambertMaterial({ color: 0x3d2410 });

  function box(w, h, d, mat, px, py, pz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz);
    scene.add(m);
    return m;
  }

  // ── Longhouse (main hall) centered at village origin
  box(260, 85, 110, woodMat, VX, 42, VZ);
  // Roof — two sloped panels meeting at a ridge
  const roofA = new THREE.Mesh(new THREE.BoxGeometry(275, 12, 75), roofMat);
  roofA.rotation.z = 0.45; roofA.position.set(VX, 107, VZ - 22); scene.add(roofA);
  const roofB = new THREE.Mesh(new THREE.BoxGeometry(275, 12, 75), roofMat);
  roofB.rotation.z = -0.45; roofB.position.set(VX, 107, VZ + 22); scene.add(roofB);
  // Ridge cap
  box(280, 10, 10, darkWood, VX, 120, VZ);
  // Door opening (dark box slightly proud of front wall)
  box(32, 52, 8, darkWood, VX, 26, VZ - 57);
  // Label sprite above longhouse
  const lhSign = makeSignSprite('🏚️ Village Hall');
  lhSign.position.set(VX, 145, VZ); scene.add(lhSign);

  // ── Blacksmith/Workshop (east of hall)
  box(90, 70, 80, stoneMat, VX + 135, 35, VZ - 50);
  // Chimney
  box(22, 55, 22, stoneMat, VX + 145, 75, VZ - 40);
  // Chimney cap (slightly wider)
  box(28, 8, 28, darkWood, VX + 145, 105, VZ - 40);
  box(35, 52, 8, darkWood, VX + 135, 26, VZ - 93); // door

  // ── Barn (west of hall)
  box(130, 80, 95, woodMat, VX - 135, 40, VZ - 45);
  // Barn roof (gambrel-ish — two-section pitched)
  const barnRoofA = new THREE.Mesh(new THREE.BoxGeometry(142, 10, 60), roofMat);
  barnRoofA.rotation.z = 0.4; barnRoofA.position.set(VX - 135, 90, VZ - 67); scene.add(barnRoofA);
  const barnRoofB = new THREE.Mesh(new THREE.BoxGeometry(142, 10, 60), roofMat);
  barnRoofB.rotation.z = -0.4; barnRoofB.position.set(VX - 135, 90, VZ - 23); scene.add(barnRoofB);
  box(138, 8, 8, darkWood, VX - 135, 97, VZ - 45); // ridge

  // ── Guard Tower (north of hall)
  box(58, 150, 58, stoneMat, VX + 50, 75, VZ - 175);
  // Battlements (4 merlons on top)
  for (let i = -1; i <= 1; i += 2) {
    box(14, 22, 12, stoneMat, VX + 50 + i * 18, 162, VZ - 175 - 27);
    box(14, 22, 12, stoneMat, VX + 50 + i * 18, 162, VZ - 175 + 27);
    box(12, 22, 14, stoneMat, VX + 50 - 27, 162, VZ - 175 + i * 18);
    box(12, 22, 14, stoneMat, VX + 50 + 27, 162, VZ - 175 + i * 18);
  }
  // Tower door
  box(22, 45, 8, darkWood, VX + 50, 22, VZ - 175 + 32);

  // ── Well (south of hall center)
  const wellBase = new THREE.Mesh(new THREE.CylinderGeometry(22, 24, 38, 10), stoneMat);
  wellBase.position.set(VX - 20, 19, VZ + 75); scene.add(wellBase);
  const wellTop = new THREE.Mesh(new THREE.CylinderGeometry(24, 22, 6, 10), darkWood);
  wellTop.position.set(VX - 20, 41, VZ + 75); scene.add(wellTop);
  // Well frame posts
  box(5, 50, 5, darkWood, VX - 20 - 18, 60, VZ + 75 - 18);
  box(5, 50, 5, darkWood, VX - 20 + 18, 60, VZ + 75 - 18);
  box(40, 5, 5, darkWood, VX - 20, 83, VZ + 75 - 18); // crossbar

  // ── Fire pit (southeast of hall)
  const emberMat = new THREE.MeshLambertMaterial({ color: 0xff5500, emissive: 0xff2200, emissiveIntensity: 0.8 });
  const fireMesh = new THREE.Mesh(new THREE.SphereGeometry(14, 8, 6), emberMat);
  fireMesh.position.set(VX + 60, 8, VZ + 80); scene.add(fireMesh);
  // Stone ring around fire
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 10), stoneMat);
    stone.position.set(VX + 60 + Math.cos(a) * 22, 5, VZ + 80 + Math.sin(a) * 22);
    stone.rotation.y = a; scene.add(stone);
  }
  const fireLight = new THREE.PointLight(0xff6600, 1.4, 320);
  fireLight.position.set(VX + 60, 35, VZ + 80); scene.add(fireLight);

  // ── Cottage A (southwest)
  box(80, 58, 68, woodMat, VX - 105, 29, VZ + 115);
  const cotARoofA = new THREE.Mesh(new THREE.BoxGeometry(88, 8, 45), thatchMat);
  cotARoofA.rotation.z = 0.5; cotARoofA.position.set(VX - 105, 68, VZ + 115 - 16); scene.add(cotARoofA);
  const cotARoofB = new THREE.Mesh(new THREE.BoxGeometry(88, 8, 45), thatchMat);
  cotARoofB.rotation.z = -0.5; cotARoofB.position.set(VX - 105, 68, VZ + 115 + 16); scene.add(cotARoofB);
  box(90, 6, 6, darkWood, VX - 105, 78, VZ + 115); // ridge
  box(24, 40, 8, darkWood, VX - 105, 20, VZ + 115 - 37); // door

  // ── Cottage B (southeast)
  box(80, 58, 68, woodMat, VX + 105, 29, VZ + 115);
  const cotBRoofA = new THREE.Mesh(new THREE.BoxGeometry(88, 8, 45), thatchMat);
  cotBRoofA.rotation.z = 0.5; cotBRoofA.position.set(VX + 105, 68, VZ + 115 - 16); scene.add(cotBRoofA);
  const cotBRoofB = new THREE.Mesh(new THREE.BoxGeometry(88, 8, 45), thatchMat);
  cotBRoofB.rotation.z = -0.5; cotBRoofB.position.set(VX + 105, 68, VZ + 115 + 16); scene.add(cotBRoofB);
  box(90, 6, 6, darkWood, VX + 105, 78, VZ + 115); // ridge
  box(24, 40, 8, darkWood, VX + 105, 20, VZ + 115 - 37); // door

  // ── Construction site (north — half-built wall segments + scaffolding)
  const csMat = new THREE.MeshLambertMaterial({ color: 0x9a8a76 });
  // Partial foundation walls at varying heights
  box(90, 30, 10, csMat, VX - 40, 15, VZ - 120);
  box(10, 55, 80, csMat, VX - 85, 27, VZ - 120);
  box(10, 42, 80, csMat, VX + 5,  21, VZ - 120);
  // Wooden floor boards (flat)
  box(100, 4, 85, woodMat, VX - 40, 3, VZ - 120);
  // Scaffolding poles
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x8b6330 });
  for (const [px, pz] of [[VX - 80, VZ - 80], [VX - 80, VZ - 160], [VX + 5, VZ - 80], [VX + 5, VZ - 160]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 90, 6), poleMat);
    pole.position.set(px, 45, pz); scene.add(pole);
  }
  // Horizontal scaffold planks
  box(92, 5, 8, woodMat, VX - 38, 72, VZ - 80);
  box(92, 5, 8, woodMat, VX - 38, 72, VZ - 160);
  box(8, 5, 88, woodMat, VX - 80, 72, VZ - 120);
  box(8, 5, 88, woodMat, VX + 5, 72, VZ - 120);

  // ── Dirt path from spawn toward village (just a flattened discolored strip)
  const pathMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(55, 4200), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(VX, 0.5, (VZ + 8800) / 2); // midpoint between village and spawn
  scene.add(path);

  // ── Village entrance sign (south approach)
  const entranceSign = makeSignSprite('🏘️ Wildlands Village');
  entranceSign.position.set(VX, 110, VZ + 240); scene.add(entranceSign);
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

  // ── Treehouse platform — circular ring around trunk at PLATFORM_Y
  // Represented as 8 planks forming a hexadecagonal deck
  const PLANK_COUNT = 12, PLANK_W = 38, PLANK_D = 50, PLANK_H = 6;
  const PLANK_R = 105; // distance from trunk center to plank center
  for (let i = 0; i < PLANK_COUNT; i++) {
    const ang = (i / PLANK_COUNT) * Math.PI * 2;
    const px = TX + Math.cos(ang) * PLANK_R;
    const pz = TZ + Math.sin(ang) * PLANK_R;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(PLANK_W, PLANK_H, PLANK_D), woodPlank);
    plank.position.set(px, PLATFORM_Y + PLANK_H / 2, pz);
    plank.rotation.y = ang;
    scene.add(plank);
  }
  // Center infill boards (cover the gap around trunk)
  box(120, PLANK_H, 120, woodPlank, TX, PLATFORM_Y + PLANK_H / 2, TZ);

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

  // ── Treehouse cabin — small wooden hut on the north side of the platform
  const HX = TX, HZ = TZ - 80;
  const HOUSE_Y = PLATFORM_Y + PLANK_H;
  // Walls (four separate panels to avoid z-fighting)
  box(92, 60, 6, woodPlank, HX,       HOUSE_Y + 30, HZ - 33); // back wall
  box(92, 60, 6, woodPlank, HX,       HOUSE_Y + 30, HZ + 33); // front wall (with door gap below)
  box(6, 60, 66, woodPlank, HX - 46,  HOUSE_Y + 30, HZ);       // left wall
  box(6, 60, 66, woodPlank, HX + 46,  HOUSE_Y + 30, HZ);       // right wall
  box(92, 6, 66, woodPlank, HX,       HOUSE_Y + 57, HZ);        // ceiling
  // Door opening — black inset on front wall
  box(20, 36, 8, new THREE.MeshLambertMaterial({ color: 0x080408 }), HX, HOUSE_Y + 18, HZ + 33);
  // Glowing windows on side walls
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(8, 14, 8),
      new THREE.MeshLambertMaterial({ color: 0xffd06a, emissive: 0xffd06a, emissiveIntensity: 0.5 }));
    win.position.set(HX + side * 46, HOUSE_Y + 35, HZ);
    scene.add(win);
  }
  // Peaked roof
  const roofGeo = new THREE.CylinderGeometry(0, 60, 50, 4);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(HX, HOUSE_Y + 60 + 25, HZ);
  roof.rotation.y = Math.PI / 4;
  scene.add(roof);

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

  // ── Lexton Greyfur — werewolf NPC on the treehouse platform
  const lextonBuilt = createHumanoid(1); // charId 1 = Werewolf
  const lextonMesh = lextonBuilt.group;
  lextonMesh.position.set(TX, PLATFORM_Y + PLANK_H, TZ - 40);
  lextonMesh.rotation.y = Math.PI; // faces south (toward approaching players)
  scene.add(lextonMesh);

  const lextonLabel = makeNpcNameSprite('Lexton Greyfur', 'Voice of the Howl');
  lextonLabel.position.set(TX, PLATFORM_Y + PLANK_H + 95, TZ - 40);
  scene.add(lextonLabel);

  // Store arm/head refs for night-howl animation
  setLextonNpc({
    armL: lextonBuilt.armL,
    armR: lextonBuilt.armR,
    head: lextonBuilt.head,
    group: lextonMesh,
    lastHowlAt: 0,
  });

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
