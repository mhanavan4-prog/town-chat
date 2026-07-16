// ---------------------------------------------------------------------------
// Town scene builders (Tier 3.4 Phase C). The daytime town's populated set
// dressing: NPCs + their structures (delve stone, midnight peddler, locksmith),
// the notice board, the nightly ritual torches, the Torchkeepers' temple with
// its altar props, and the KayKit Halloween dressing. Called from initScene.
// THREE/LEGEND_FX are globals; textures/sprites, createHumanoid, door helpers,
// and TOWN_NPCS/KK/kiosk data are injected; `me` via getter.
// ---------------------------------------------------------------------------
export default function createTownScene({ KK, OUTDOOR_KIOSKS, TOWN_NPCS, createHumanoid, getDoorSide, getDoorWorldPos, kkPlace, makeNpcNameSprite, makePentacleTexture, makeSigilFloorTexture, makeSignSprite, makeWhiteStoneTexture, getMe, setDelveStoneGroup, setPeddlerStallGroup, setLocksmithGroup }) {
function buildTownNPCs(scene) {
  for (const npc of TOWN_NPCS) {
    const mesh = createHumanoid(npc.charId).group;
    mesh.position.set(npc.x, 0, npc.y);
    // Face toward the spawn hub (1600, 1100) so they look natural
    mesh.rotation.y = Math.atan2(1600 - npc.x, 1100 - npc.y);
    scene.add(mesh);
    const label = makeNpcNameSprite(npc.name);
    label.position.set(npc.x, 90, npc.y);
    scene.add(label);
    OUTDOOR_KIOSKS.push({ x: npc.x, z: npc.y, npc: 'npc', npcId: npc.id, npcName: npc.name });
  }
  buildMidnightPeddler(scene);
  buildTownBoard(scene);
  buildDelveStone(scene);
  buildLocksmith(scene);
}

// ── The Town Board (Session L) — the leaderboards' physical home, a big
// noticeboard on the square. "Give the nightly trophy and hunt streaks a
// board in the town square." Client dressing + kiosk, data via board_state.
const BOARD_SPOT = { x: 2010, y: 1150 };
function buildTownBoard(scene) {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x4a3b2c });
  for (const px of [-30, 30]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 58, 6), wood);
    post.position.set(px, 29, 0);
    g.add(post);
  }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(76, 44, 4), new THREE.MeshLambertMaterial({ color: 0x2c2340 }));
  panel.position.y = 40;
  g.add(panel);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(86, 4, 16), wood);
  roof.position.y = 65;
  roof.rotation.z = 0.03;
  g.add(roof);
  // Pinned "pages" — pale rectangles, one gold like a first-place sheet.
  const pages = [[-24, 46, 0xd8ccb8], [-2, 42, 0xd8ccb8], [20, 45, 0xffd9a0], [10, 32, 0xcfc3e8], [-16, 31, 0xd8ccb8]];
  for (const [px, py, c] of pages) {
    const page = new THREE.Mesh(new THREE.PlaneGeometry(14, 10 + Math.abs(px % 7)), new THREE.MeshBasicMaterial({ color: c }));
    page.position.set(px, py, 2.4);
    page.rotation.z = (px % 5) * 0.02;
    g.add(page);
  }
  g.position.set(BOARD_SPOT.x, 0, BOARD_SPOT.y);
  g.rotation.y = -0.4;
  scene.add(g);
  const label = makeNpcNameSprite('🏆 The Town Board');
  label.position.set(BOARD_SPOT.x, 80, BOARD_SPOT.y);
  scene.add(label);
  OUTDOOR_KIOSKS.push({ x: BOARD_SPOT.x, z: BOARD_SPOT.y, npc: 'board' });
}

// ── The Delve Stone (Session L) — the two-tap door down. A split standing
// stone breathing violet light on the square's south edge.
const DELVE_STONE_SPOT = { x: 2050, y: 870 };
function buildDelveStone(scene) {
  const g = new THREE.Group();
  const rock = new THREE.MeshLambertMaterial({ color: 0x2e283a });
  const left = new THREE.Mesh(new THREE.CylinderGeometry(10, 14, 64, 5), rock);
  left.position.set(-11, 32, 0);
  left.rotation.z = 0.12;
  g.add(left);
  const right = new THREE.Mesh(new THREE.CylinderGeometry(9, 13, 56, 5), rock);
  right.position.set(11, 28, 0);
  right.rotation.z = -0.14;
  g.add(right);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: LEGEND_FX.glowTexture(), color: 0x9a76ff, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  glow.scale.set(40, 52, 1);
  glow.position.set(0, 28, 0);
  g.add(glow);
  g.userData.tick = (t) => { glow.material.opacity = 0.4 + Math.sin(t * 1.4) * 0.18; };
  setDelveStoneGroup(g);
  g.position.set(DELVE_STONE_SPOT.x, 0, DELVE_STONE_SPOT.y);
  scene.add(g);
  const label = makeNpcNameSprite('🕳️ The Delve Stone');
  label.position.set(DELVE_STONE_SPOT.x, 76, DELVE_STONE_SPOT.y);
  scene.add(label);
  OUTDOOR_KIOSKS.push({ x: DELVE_STONE_SPOT.x, z: DELVE_STONE_SPOT.y, npc: 'delve' });
}

// ── The Midnight Peddler's stall (Session I) — a cloaked figure under a
// violet canopy, hung with a lantern; the town-side door to the weekly
// legendary shop. Client-only dressing (fairy-ring precedent: no collider);
// the kiosk entry is what makes it interactive.
const PEDDLER_SPOT = { x: 1350, y: 1180 };
function buildMidnightPeddler(scene) {
  const g = new THREE.Group();
  const post = new THREE.MeshLambertMaterial({ color: 0x3b2c4a });
  const cloth = new THREE.MeshLambertMaterial({ color: 0x241a3b });
  // canopy on four posts
  for (const [px, pz] of [[-26, -18], [26, -18], [-26, 18], [26, 18]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 46, 6), post);
    p.position.set(px, 23, pz);
    g.add(p);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(62, 3, 46), cloth);
  roof.position.y = 47;
  roof.rotation.z = 0.05;
  g.add(roof);
  // table
  const table = new THREE.Mesh(new THREE.BoxGeometry(46, 4, 20), new THREE.MeshLambertMaterial({ color: 0x4a3b2c }));
  table.position.set(0, 16, 8);
  g.add(table);
  // the peddler — a proper hooded humanoid, built on the SAME rig every other
  // character uses (createHumanoid) instead of the old cone+sphere blob, so he
  // reads as a person in the game's style. A bespoke dark-violet cloak preset
  // (like the Ember mobs' custom palettes) keeps him distinct + mysterious, and
  // a low-poly hood (dome + peak + shoulder cape) is layered on top.
  const peddler = createHumanoid(0, {
    skin: 0xb9a9d6,       // pale, shadowed face under the hood
    hair: 0x1a1430, hairStyle: 'bald', // hood covers the head
    eye: 0xd6dcff,        // faint moonstone glow for eyes
    shirt: 0x2a2144,      // deep-violet cloak (torso + arms)
    pants: 0x1c1630       // near-black legs
  });
  const pg = peddler.group;
  pg.scale.setScalar(0.9);        // sit comfortably under the canopy
  pg.position.set(0, 0, -9);      // stand behind the table
  pg.rotation.y = Math.PI;        // face the customer side; flip if reversed in playtest
  const hy = peddler.head.position.y;
  const hr = (peddler.head.geometry.parameters && peddler.head.geometry.parameters.radius) || 8;
  const cloakMat = new THREE.MeshLambertMaterial({ color: 0x241a3b });
  const hoodMat = new THREE.MeshLambertMaterial({ color: 0x2c2340 });
  // shoulder cape draping over the shoulders
  const cape = new THREE.Mesh(new THREE.ConeGeometry(14, 20, 8), cloakMat);
  cape.position.set(0, hy - 22, -0.5);
  pg.add(cape);
  // hood dome over the crown — the face stays open at the front
  const hoodDome = new THREE.Mesh(
    new THREE.SphereGeometry(hr * 1.5, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hoodMat
  );
  hoodDome.position.set(0, hy + hr * 0.15, -hr * 0.15);
  pg.add(hoodDome);
  // pointed hood peak, tilted back
  const peak = new THREE.Mesh(new THREE.ConeGeometry(hr * 1.15, hr * 2, 8), hoodMat);
  peak.position.set(0, hy + hr * 0.3, -hr * 0.7);
  peak.rotation.x = -0.4;
  pg.add(peak);
  g.add(pg);
  // hanging lantern + glow
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), new THREE.MeshBasicMaterial({ color: 0xd9b8ff }));
  lantern.position.set(20, 40, 0);
  g.add(lantern);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: LEGEND_FX.glowTexture(), color: 0xc9a8ff, transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  glow.scale.set(34, 34, 1);
  glow.position.set(20, 40, 0);
  g.add(glow);
  // two slow moonstone motes drifting over the table
  const motes = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({
      map: LEGEND_FX.glowTexture(), color: 0xd0d0ff, transparent: true, opacity: 0.8,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    m.scale.set(7, 7, 1);
    g.add(m);
    motes.push(m);
  }
  g.userData.tick = (t) => motes.forEach((m, i) => {
    const a = t * 0.8 + i * Math.PI;
    m.position.set(Math.cos(a) * 14, 26 + Math.sin(t * 1.3 + i) * 4, 8 + Math.sin(a) * 6);
  });
  setPeddlerStallGroup(g);
  g.position.set(PEDDLER_SPOT.x, 0, PEDDLER_SPOT.y);
  scene.add(g);
  const label = makeNpcNameSprite('🌒 The Midnight Peddler');
  label.position.set(PEDDLER_SPOT.x, 62, PEDDLER_SPOT.y);
  scene.add(label);
  OUTDOOR_KIOSKS.push({ x: PEDDLER_SPOT.x, z: PEDDLER_SPOT.y, npc: 'legend', npcName: 'The Midnight Peddler' });
}

// ── The Locksmith (by the Bank) — resets the password on a LOCKED Hard Drive
// for 10 gold, so a forgotten password (or a looted locked drive) is never a
// permanent lockout. See tryInteract 'locksmith' + server 'harddrive_reset_lock'.
const LOCKSMITH_SPOT = { x: 1730, y: 1760 };
function buildLocksmith(scene) {
  const g = new THREE.Group();
  // Tumbler is a proper humanoid now — the same createHumanoid build the town's
  // other NPCs and players use (charId 4, the Rogue, suits a lock-man). A
  // rotating brass key floats over him as the sign of his trade.
  const figure = createHumanoid(4).group;
  figure.rotation.y = Math.atan2(1600 - LOCKSMITH_SPOT.x, 1100 - LOCKSMITH_SPOT.y);
  g.add(figure);
  const keyMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const keyGrp = new THREE.Group();
  const bow = new THREE.Mesh(new THREE.TorusGeometry(4, 1.4, 8, 14), keyMat); bow.position.y = 6;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 12, 6), keyMat); shaft.position.y = -2;
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 1.5), keyMat); tooth.position.set(2, -7, 0);
  keyGrp.add(bow); keyGrp.add(shaft); keyGrp.add(tooth);
  keyGrp.position.set(0, 64, 10); g.add(keyGrp);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: LEGEND_FX.glowTexture(), color: 0xffd27a, transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  glow.scale.set(30, 30, 1); glow.position.set(0, 64, 10); g.add(glow);
  setLocksmithGroup(g);
  g.position.set(LOCKSMITH_SPOT.x, 0, LOCKSMITH_SPOT.y);
  scene.add(g);
  const label = makeNpcNameSprite('Tumbler', 'the Locksmith');
  label.position.set(LOCKSMITH_SPOT.x, 82, LOCKSMITH_SPOT.y);
  label.material.transparent = true;
  label.material.opacity = 0;
  scene.add(label);
  g.userData.tick = (t) => {
    keyGrp.rotation.y = t * 1.2;
    keyGrp.position.y = 64 + Math.sin(t * 1.6) * 2;
    if (getMe()) {
      const d = Math.hypot(getMe().x - LOCKSMITH_SPOT.x, getMe().y - LOCKSMITH_SPOT.y);
      const target = d < 150 ? 1 : d > 340 ? 0 : (340 - d) / 190;
      label.material.opacity += (target - label.material.opacity) * 0.15;
    }
  };
  OUTDOOR_KIOSKS.push({ x: LOCKSMITH_SPOT.x, z: LOCKSMITH_SPOT.y, npc: 'locksmith', npcName: 'Tumbler the Locksmith' });
}

function kkTownDressing(scene, w) {
  if (!KK.settled) return;
  // twin jack-o'-lanterns flanking every door
  for (const b of w.buildings) {
    const side = getDoorSide(b);
    const dp = getDoorWorldPos(b);
    const pw = (w.doorWidth || 64) * 0.85 + 22;
    const out = side === 'south' ? [0, 18] : side === 'north' ? [0, -18] : side === 'east' ? [18, 0] : [-18, 0];
    const perp = side === 'south' || side === 'north' ? [pw, 0] : [0, pw];
    kkPlace(scene, 'prop_pumpkin', dp.x + out[0] + perp[0], dp.y + out[1] + perp[1], 12, Math.PI * 0.15);
    kkPlace(scene, 'prop_pumpkin2', dp.x + out[0] - perp[0], dp.y + out[1] - perp[1], 10, -Math.PI * 0.2);
  }
  // a small fenced graveyard tucked behind the Town Hall
  const hall = w.buildings.find(b => b.id === 'hall');
  if (hall) {
    // A little churchyard in the wooded pocket beside the Town Hall — the
    // hall backs onto the map edge, so "behind" would be invisible (and
    // half off-world). Beside it reads from the plaza approach instead.
    const gx = Math.min(hall.x + hall.w + 150, (w.width || 3200) - 170);
    const gy = Math.max(150, hall.y + 60);
    kkPlace(scene, 'prop_crypt', gx, gy - 26, 52, Math.PI);
    kkPlace(scene, 'prop_grave_a', gx - 34, gy + 16, 20, 0.3);
    kkPlace(scene, 'prop_grave_b', gx - 8, gy + 22, 18, -0.15);
    kkPlace(scene, 'prop_grave_a', gx + 20, gy + 18, 19, 0.5);
    kkPlace(scene, 'prop_grave_b', gx + 44, gy + 10, 17, -0.4);
    kkPlace(scene, 'prop_fence', gx - 52, gy + 34, 52, 0);
    kkPlace(scene, 'prop_fence', gx + 52, gy + 34, 52, 0);
    kkPlace(scene, 'prop_deadtree2', gx + 66, gy - 18, 46, 0.7);
  }
  // a candle shrine at the fae-touched fairy ring
  kkPlace(scene, 'prop_shrine', 2450, 890, 24, -0.5);
}

// A torch that starts unlit (no flame, no light) and gets toggled lit by
// the nightly ritual (see applyTownTorchState) — unlike buildTorch() above,
// which is always-lit decor with no on/off state.
function buildTownRitualTorch(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4, 60, 6),
    new THREE.MeshLambertMaterial({ color: 0x4a3320 })
  );
  pole.position.set(x, 30, z);
  g.add(pole);
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 6, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
  );
  bowl.position.set(x, 62, z);
  g.add(bowl);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(7, 18, 8),
    new THREE.MeshBasicMaterial({ color: 0xff9d3c })
  );
  flame.position.set(x, 74, z);
  flame.visible = false;
  g.add(flame);
  const light = new THREE.PointLight(0xff9d3c, 0, 260);
  light.position.set(x, 74, z);
  g.add(light);
  return { group: g, flame, light };
}

function makeAltarSkull(x, y, z) {
  const g = new THREE.Group();
  const boneMat = new THREE.MeshLambertMaterial({ color: 0xe4dcc4 });
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 8), boneMat);
  cranium.scale.set(1, 0.9, 1.05);
  g.add(cranium);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.5, 4), boneMat);
  jaw.position.set(0, -4, 1);
  g.add(jaw);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0605 });
  for (const side of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(1.3, 6, 6), eyeMat);
    socket.position.set(side * 2, 0.5, 4.2);
    g.add(socket);
  }
  g.position.set(x, y, z);
  return g;
}

function makeAltarCandle(x, y, z) {
  const g = new THREE.Group();
  const wax = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.5, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xf0e6c8 })
  );
  wax.position.y = 6;
  g.add(wax);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4, 8), new THREE.MeshBasicMaterial({ color: 0xffaa44 }));
  flame.position.y = 14;
  g.add(flame);
  const flicker = new THREE.PointLight(0xffaa44, 0.5, 50);
  flicker.position.y = 14;
  g.add(flicker);
  g.position.set(x, y, z);
  return g;
}

function makeAltarDagger(x, y, z, rotY) {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.6, 16),
    new THREE.MeshLambertMaterial({ color: 0xc7ccd4 })
  );
  blade.position.z = -6;
  g.add(blade);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.3, 7, 8),
    new THREE.MeshLambertMaterial({ color: 0x3a2418 })
  );
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 5.5;
  g.add(handle);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 8), new THREE.MeshLambertMaterial({ color: 0x7a6238 }));
  pommel.position.z = 9.5;
  g.add(pommel);
  g.rotation.y = rotY || 0;
  g.position.set(x, y, z);
  return g;
}

function makeIncenseBowl(x, y, z) {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 3, 3, 12),
    new THREE.MeshLambertMaterial({ color: 0x4a3626 })
  );
  bowl.position.y = 1.5;
  g.add(bowl);
  const ashMat = new THREE.MeshLambertMaterial({ color: 0x2a2420 });
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.6, 12), ashMat);
  ash.position.y = 3;
  g.add(ash);
  // A thin rising wisp of smoke — a few small, slightly offset, tapering
  // translucent spheres rather than an actual particle system, since it
  // never needs to look like more than a lazy curl at this scale.
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0xcfd0d2, transparent: true, opacity: 0.35 });
  const smokeOffsets = [[0, 6, 0, 1.1], [0.8, 10, 0.4, 1.4], [0.2, 14, -0.6, 1.7], [-0.6, 18, 0.3, 2.0]];
  for (const [sx, sy, sz, sr] of smokeOffsets) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(sr, 6, 6), smokeMat);
    puff.position.set(sx, sy, sz);
    g.add(puff);
  }
  g.position.set(x, y, z);
  return g;
}

function makePentacleMedallion(x, y, z) {
  const tex = makePentacleTexture();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(15, 24),
    new THREE.MeshLambertMaterial({ map: tex })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(x, y, z);
  return disc;
}

// The Torchkeepers' home shrine — a small open-air ritual platform near the
// tree line at the back of town. Purely a landmark/gathering spot, not an
// enterable building: no interior, no door, no room id — see server.js's
// TOWN_TEMPLE (the gathering point just north/in-front of this structure
// the 4 NPCs walk to each morning). No roof anymore — just the flat white
// stone platform, a corner pillar at each edge, and a central altar, kept
// open so the nightly portal (see buildEmberPortal(), positioned above the
// altar in initScene) reads clearly against the sky instead of being boxed
// in. Pillars are purely decorative (no collision) — only the altar itself
// blocks movement (see the walls.push in initScene), so the rest of the
// platform is walkable; getFloorHeight() raises a standing player's
// rendered Y to match platformH so they read as standing on top of it
// instead of clipping through.
function buildTownTemple(cx, cz) {
  const g = new THREE.Group();
  const platformW = 360, platformD = 260, platformH = 16;
  const whiteStoneTex = makeWhiteStoneTexture();
  whiteStoneTex.repeat.set(platformW / 50, platformD / 50);

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(platformW, platformH, platformD),
    new THREE.MeshLambertMaterial({ map: whiteStoneTex, color: 0xffffff })
  );
  platform.position.set(cx, platformH / 2, cz);
  g.add(platform);

  // Ritual sigils carved into the platform floor, ringing the altar — a
  // flat transparent-background decal laid just above the stone surface so
  // it reads as etched into it rather than pasted on top. Drawn before the
  // altar/pillars so it never overdraws anything sitting on top of it.
  const sigilPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial({ map: makeSigilFloorTexture(), transparent: true })
  );
  sigilPlane.rotation.x = -Math.PI / 2;
  sigilPlane.position.set(cx, platformH + 0.3, cz);
  g.add(sigilPlane);

  // Corner pillars — short, purely decorative, framing the platform now
  // that there's no roof for them to hold up. A simple capital cap on each
  // gives them a finished, "ruins" look rather than plain cylinders.
  const pillarH = 84;
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0xf5f2e6 });
  const pillarGeo = new THREE.CylinderGeometry(11, 13, pillarH, 8);
  const capGeo = new THREE.CylinderGeometry(16, 12, 9, 8);
  const marginX = 34, marginZ = 28;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = cx + sx * (platformW / 2 - marginX);
      const pz = cz + sz * (platformD / 2 - marginZ);
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, platformH + pillarH / 2, pz);
      g.add(pillar);
      const cap = new THREE.Mesh(capGeo, pillarMat);
      cap.position.set(px, platformH + pillarH + 4.5, pz);
      g.add(cap);
    }
  }

  // Altar — a two-tier stone pedestal at the platform's center, doubling as
  // the anchor point the portal hovers over once the torches are lit.
  const altarMat = new THREE.MeshLambertMaterial({ color: 0xefeade });
  const altarBase = new THREE.Mesh(new THREE.BoxGeometry(64, 30, 64), altarMat);
  altarBase.position.set(cx, platformH + 15, cz);
  g.add(altarBase);
  const altarTop = new THREE.Mesh(new THREE.BoxGeometry(40, 12, 40), altarMat);
  altarTop.position.set(cx, platformH + 36, cz);
  g.add(altarTop);
  // A faint permanent ember glow on the altar top hints at what happens at night.
  const emberGlow = new THREE.PointLight(0xff5522, 0.4, 90);
  emberGlow.position.set(cx, platformH + 46, cz);
  g.add(emberGlow);

  // Altar trinkets — the top surface sits at platformH + 42 (altarTop's
  // center 36 + half its 12 height). Pentacle medallion dead center, the
  // rest spread across the four corners of the 40x40 top with margin to spare.
  const topY = platformH + 42;
  g.add(makePentacleMedallion(cx, topY + 0.2, cz));
  g.add(makeIncenseBowl(cx - 12, topY, cz - 12));
  g.add(makeAltarSkull(cx + 12, topY + 5, cz - 12));
  g.add(makeAltarCandle(cx - 12, topY, cz + 12));
  g.add(makeAltarDagger(cx + 12, topY + 0.6, cz + 12, 0.6));

  const sign = makeSignSprite('⛩️ Temple of the Flame');
  sign.position.set(cx, platformH + pillarH + 40, cz);
  g.add(sign);

  return g;
}

  return { buildTownNPCs, buildTownRitualTorch, buildTownTemple, kkTownDressing };
}
