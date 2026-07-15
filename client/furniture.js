// ---------------------------------------------------------------------------
// Interior furniture (Tier 3.4 Phase C). Every prop that dresses a building's
// interior — torches, tables/benches/barrels, bookshelves, fireplaces, thrones,
// bar counters, chandeliers, arcade cabinets, display pedestals, the lounge
// platform + dining sets — and buildFurniture, the per-building-type dispatcher
// that lays them out (and drops in the NPCs/kiosks). Pure THREE geometry; the
// layout constants, the canvas, createHumanoid, the sign/name sprites and the
// wall-painting helper are injected. makeBarrel is re-used by the town props.
// ---------------------------------------------------------------------------
export default function createFurniture({ INDOOR_WALL_HEIGHT, LOUNGE_PLATFORM_HEIGHT, LOUNGE_STAIR_END_FRAC, LOUNGE_STAIR_START_FRAC, canvas, createHumanoid, makeNpcNameSprite, makeSignSprite, makeWallPainting }) {
function buildTorch(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2, 46, 6),
    new THREE.MeshLambertMaterial({ color: 0x4a3320 })
  );
  pole.position.set(x, 40, z);
  g.add(pole);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(7, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0xff9d3c })
  );
  flame.position.set(x, 68, z);
  g.add(flame);
  return g;
}

function makeTable(x, z, rotY) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(46, 4, 28), new THREE.MeshLambertMaterial({ color: 0x6b4a2e }));
  top.position.y = 26; g.add(top);
  const legGeo = new THREE.CylinderGeometry(2, 2, 26, 6);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x4a3320 });
  [[-20, -11], [20, -11], [-20, 11], [20, 11]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, 13, lz);
    g.add(leg);
  });
  g.position.set(x, 0, z); g.rotation.y = rotY || 0;
  return g;
}

function makeBench(x, z, rotY) {
  const seat = new THREE.Mesh(new THREE.BoxGeometry(40, 4, 12), new THREE.MeshLambertMaterial({ color: 0x5a3d24 }));
  seat.position.set(x, 14, z);
  seat.rotation.y = rotY || 0;
  return seat;
}

function makeBarrel(x, z) {
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 10, 22, 10),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2e })
  );
  barrel.position.set(x, 11, z);
  return barrel;
}

function makeBookshelf(x, z, rotY) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(36, 70, 12), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
  frame.position.y = 35; g.add(frame);
  const bookColors = [0x8a2e2e, 0x2e5a8a, 0x3a6b3a, 0x8a6b2e];
  for (let i = 0; i < 10; i++) {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(3, 12 + Math.random() * 6, 9),
      new THREE.MeshLambertMaterial({ color: bookColors[i % bookColors.length] })
    );
    book.position.set(-15 + i * 3.2, 16 + (i % 3) * 16, 0);
    g.add(book);
  }
  g.position.set(x, 0, z); g.rotation.y = rotY || 0;
  return g;
}

function makeBanner(x, y, z, rotY, color) {
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 46),
    new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
  );
  banner.position.set(x, y, z);
  banner.rotation.y = rotY || 0;
  return banner;
}

function makeFireplace(x, z, rotY) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(50, 60, 18), new THREE.MeshLambertMaterial({ color: 0x55504a }));
  body.position.y = 30; g.add(body);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(30, 34, 10), new THREE.MeshBasicMaterial({ color: 0xff7a30 }));
  hole.position.set(0, 20, 2); g.add(hole);
  // The unlit hole reads as bright regardless of scene lighting, but never
  // actually lit anything around it — a real hearth should throw warm light
  // across the room, not just glow in place.
  const glow = new THREE.PointLight(0xff8a3a, 1.1, 260);
  glow.position.set(0, 24, 12);
  g.add(glow);
  g.position.set(x, 0, z); g.rotation.y = rotY || 0;
  return g;
}

function makeThrone(x, z, rotY) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(34, 6, 30), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
  seat.position.y = 24; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(34, 60, 6), new THREE.MeshLambertMaterial({ color: 0x5a3d24 }));
  back.position.set(0, 54, -13); g.add(back);
  const armGeo = new THREE.BoxGeometry(5, 16, 28);
  const armMat = new THREE.MeshLambertMaterial({ color: 0x4a3320 });
  const armL = new THREE.Mesh(armGeo, armMat); armL.position.set(-15, 32, 0); g.add(armL);
  const armR = new THREE.Mesh(armGeo, armMat); armR.position.set(15, 32, 0); g.add(armR);
  g.position.set(x, 0, z); g.rotation.y = rotY || 0;
  return g;
}

function makeRug(x, z, w, d, color) {
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(x, 0.3, z);
  return rug;
}

function makeBarCounter(x, z1, z2) {
  const g = new THREE.Group();
  const len = Math.abs(z2 - z1);
  const midZ = (z1 + z2) / 2;
  const counter = new THREE.Mesh(new THREE.BoxGeometry(20, 34, len), new THREE.MeshLambertMaterial({ color: 0x5a3d24 }));
  counter.position.set(x, 17, midZ);
  g.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(24, 3, len + 4), new THREE.MeshLambertMaterial({ color: 0x3c2616 }));
  top.position.set(x, 35, midZ);
  g.add(top);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(8, 50, len * 0.88), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
  shelf.position.set(x - 18, 25, midZ);
  g.add(shelf);
  const bottleColors = [0x4a8a3a, 0x8a2e2e, 0x2e5a8a, 0x6b4a2e, 0x8a6b2e];
  const count = Math.max(3, Math.floor(len / 12));
  for (let i = 0; i < count; i++) {
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2, 7 + Math.random() * 3, 6),
      new THREE.MeshLambertMaterial({ color: bottleColors[i % bottleColors.length] })
    );
    bottle.position.set(x - 18, 52, z1 + (i + 0.5) * (len / count));
    g.add(bottle);
  }
  return g;
}

function makeChandelier(x, z) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(16, 1.6, 6, 16), new THREE.MeshLambertMaterial({ color: 0x3c2a1a }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = INDOOR_WALL_HEIGHT - 38;
  g.add(ring);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 22, 5), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
  chain.position.y = INDOOR_WALL_HEIGHT - 22;
  g.add(chain);
  const candleCount = 6;
  for (let i = 0; i < candleCount; i++) {
    const ang = (i / candleCount) * Math.PI * 2;
    const cdx = Math.cos(ang) * 16, cdz = Math.sin(ang) * 16;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 6, 6), new THREE.MeshLambertMaterial({ color: 0xe8dcb0 }));
    candle.position.set(cdx, INDOOR_WALL_HEIGHT - 35, cdz);
    g.add(candle);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.4, 6), new THREE.MeshBasicMaterial({ color: 0xffb84c }));
    flame.position.set(cdx, INDOOR_WALL_HEIGHT - 31, cdz);
    g.add(flame);
  }
  const light = new THREE.PointLight(0xffb86c, 0.9, 220);
  light.position.y = INDOOR_WALL_HEIGHT - 36;
  g.add(light);
  g.position.set(x, 0, z);
  return g;
}

function makeShield(x, y, z, rotY, color) {
  const shield = new THREE.Mesh(
    new THREE.CircleGeometry(13, 8),
    new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
  );
  shield.position.set(x, y, z);
  shield.rotation.y = rotY || 0;
  return shield;
}

// A weathered stone statue holding out a plaque/seal — doubles as the
// physical "buy a Town Pass" object. Purely decorative geometry; the
// interaction itself is driven by the kiosk point registered alongside it.
function makeStatue(x, z) {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x9a9a90 });
  const darkStoneMat = new THREE.MeshLambertMaterial({ color: 0x6e6e64 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 36), darkStoneMat);
  base.position.y = 5; g.add(base);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(24, 38, 24), stoneMat);
  plinth.position.y = 10 + 19; g.add(plinth);

  const figY = 10 + 38;
  const robe = new THREE.Mesh(new THREE.ConeGeometry(13, 46, 10), stoneMat);
  robe.position.y = figY + 23; g.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(8, 10, 10), stoneMat);
  head.position.y = figY + 50; g.add(head);

  const armGeo = new THREE.CylinderGeometry(2.4, 2.4, 20, 6);
  const armL = new THREE.Mesh(armGeo, stoneMat);
  armL.position.set(-11, figY + 28, 4); armL.rotation.z = 0.6; g.add(armL);
  const armR = new THREE.Mesh(armGeo, stoneMat);
  armR.position.set(11, figY + 28, 4); armR.rotation.z = -0.6; g.add(armR);

  // a plaque held out in front, representing the pass itself
  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(16, 12, 1.5),
    new THREE.MeshLambertMaterial({ color: 0xd9c89a })
  );
  plaque.position.set(0, figY + 18, 15);
  g.add(plaque);
  const seal = new THREE.Mesh(
    new THREE.CircleGeometry(4, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd27a })
  );
  seal.position.set(0, figY + 18, 15.8);
  g.add(seal);

  const glow = new THREE.PointLight(0xfff1c0, 0.5, 90);
  glow.position.set(0, figY + 18, 30);
  g.add(glow);

  g.position.set(x, 0, z);
  return g;
}

// A playable arcade cabinet — the kiosk point registered alongside it (see
// the 'alchemist' branch of buildFurniture()) is what actually opens the
// mini-game; this is just the standing geometry.
function makeArcadeCabinet(x, z, rotY, screenColor) {
  // Enchanted arcane machine — rune-etched night-blue body, crystal crown
  // where the wooden marquee used to be. Same footprint, same screen, same
  // kiosk interaction; only the dressing changed with the room.
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(30, 64, 26),
    new THREE.MeshLambertMaterial({ color: 0x141f3d, emissive: 0x060d1f, emissiveIntensity: 0.6 })
  );
  body.position.y = 32;
  g.add(body);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 18),
    new THREE.MeshBasicMaterial({ color: screenColor })
  );
  screen.position.set(0, 44, 13.1);
  g.add(screen);
  // Glowing rune etchings down the front panel, below the screen
  const runeMat = new THREE.MeshLambertMaterial({ color: 0x9fd4ff, emissive: 0x2a6fe0, emissiveIntensity: 0.8 });
  for (let i = 0; i < 4; i++) {
    const etch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.4, 0.8), runeMat);
    etch.position.set(-9 + i * 6, 24 - (i % 2) * 6, 13.2);
    g.add(etch);
  }
  // Crystal trim crown + a shard at each top corner
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(32, 5, 28),
    new THREE.MeshLambertMaterial({ color: 0xbfe2ff, emissive: 0x2f6fd0, emissiveIntensity: 0.55, transparent: true, opacity: 0.9 })
  );
  trim.position.y = 64;
  g.add(trim);
  const shardMat = new THREE.MeshLambertMaterial({ color: 0x9fd4ff, emissive: 0x1d5ecc, emissiveIntensity: 0.9 });
  for (const sx of [-13, 13]) {
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(4, 0), shardMat);
    shard.scale.y = 1.8;
    shard.position.set(sx, 70, 0);
    g.add(shard);
  }
  const glow = new THREE.PointLight(screenColor, 0.6, 60);
  glow.position.set(0, 44, 16);
  g.add(glow);
  g.position.set(x, 0, z);
  g.rotation.y = rotY || 0;
  return g;
}

function makeWindowGlow(x, y, z, rotY, color) {
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 30),
    new THREE.MeshBasicMaterial({ color: color != null ? color : 0xffd98a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  glow.position.set(x, y, z);
  glow.rotation.y = rotY || 0;
  return glow;
}

// A table + two benches at a fixed vertical offset, with no seats registered
// — used for the Rooftop Lounge's upstairs terrace, since the sit-down
// interaction (findNearestSeat()) only ever checks render-space x/z, not
// height, and isn't worth teaching about a second floor for purely
// decorative furniture.
function addElevatedTable(scene, tx, tz, baseY) {
  const table = makeTable(tx, tz);
  table.position.y += baseY;
  scene.add(table);
  const benchA = makeBench(tx, tz - 18, 0); benchA.position.y += baseY; scene.add(benchA);
  const benchB = makeBench(tx, tz + 18, 0); benchB.position.y += baseY; scene.add(benchB);
}

// The Rooftop Lounge's structural staircase + upstairs terrace: a row of
// rising steps from the ground floor up to a platform at
// LOUNGE_PLATFORM_HEIGHT, plus a couple of glowing "view" windows along the
// outer wall up there. No railing mesh — there's no collision physics in
// this engine, so a solid-looking railing you can walk straight through is
// worse than no railing at all. getFloorHeight() mirrors this same
// stairStart/stairEnd math to move the player's render Y.
function buildLoungeStructure(scene, roomW, roomD) {
  const stairStart = roomW * LOUNGE_STAIR_START_FRAC;
  const stairEnd = roomW * LOUNGE_STAIR_END_FRAC;
  const platformH = LOUNGE_PLATFORM_HEIGHT;

  const stepCount = 6;
  const stepWidth = (stairEnd - stairStart) / stepCount;
  // Mossy stone for the Phantom Parlor (was warm wood in Lounge days)
  const stepMat = new THREE.MeshLambertMaterial({ color: 0x25443a });
  for (let i = 0; i < stepCount; i++) {
    const stepH = platformH * (i + 1) / stepCount;
    const stepX = stairStart + stepWidth * (i + 0.5);
    const step = new THREE.Mesh(new THREE.BoxGeometry(stepWidth + 0.5, stepH, roomD * 0.86), stepMat);
    step.position.set(stepX, stepH / 2, roomD / 2);
    scene.add(step);
  }

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(roomW - stairEnd, 8, roomD),
    new THREE.MeshLambertMaterial({ color: 0x2e5346 })
  );
  platform.position.set((stairEnd + roomW) / 2, platformH - 4, roomD / 2);
  scene.add(platform);

  // Ghostlight seeps in through the watch windows
  scene.add(makeWindowGlow(roomW - 6, platformH + 40, roomD * 0.25, -Math.PI / 2, 0xa8ffd0));
  scene.add(makeWindowGlow(roomW - 6, platformH + 40, roomD * 0.75, -Math.PI / 2, 0xa8ffd0));
  const lookoutSign = makeSignSprite("🌙 Widow's Watch");
  lookoutSign.position.set((stairEnd + roomW) / 2, platformH + 60, roomD * 0.5);
  scene.add(lookoutSign);
}

// A dining set = one table + two benches + four registered seats (render-
// space coords), used for the sit-down interaction.
function addDiningSet(scene, seatsOut, tx, tz) {
  scene.add(makeTable(tx, tz));
  scene.add(makeBench(tx, tz - 18, 0));
  scene.add(makeBench(tx, tz + 18, 0));
  const seatOffsets = [
    { dx: -14, dz: -18, facing: Math.PI },
    { dx: 14,  dz: -18, facing: Math.PI },
    { dx: -14, dz: 18,  facing: 0 },
    { dx: 14,  dz: 18,  facing: 0 }
  ];
  for (const s of seatOffsets) {
    seatsOut.push({ x: tx + s.dx, z: tz + s.dz, facing: s.facing });
  }
}

// A free-floating glowing glyph — always-bright (Basic material), soft halo
// painted right into the canvas. Halo/ink tint per room: the Starlight
// Arcade hangs blue ones, the Phantom Parlor ghost-green.
function makeGlowGlyphMesh(glyph, size, halo, ink) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = halo || '#66baff'; ctx.shadowBlur = 14;
  ctx.fillStyle = ink || '#cfe8ff'; ctx.font = '38px serif';
  ctx.fillText(glyph, 32, 34);
  ctx.fillText(glyph, 32, 34); // twice = brighter core inside the halo
  const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(size || 26, size || 26), mat);
}

// A relic on display: stone pedestal, glass dome, its own cold light.
// Items get added into the returned group at y≈34..46. opts tints the
// stone/dome/light per room; opts.baseY lifts the whole pedestal (the
// Parlor's terrace pedestal sits on the raised platform).
function makeDisplayPedestal(scene, x, z, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(12, 14, 26, 10), new THREE.MeshLambertMaterial({ color: o.stone != null ? o.stone : 0x243761 }));
  base.position.y = 13; g.add(base);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 13.5, 2.5, 10), new THREE.MeshLambertMaterial({ color: o.cap != null ? o.cap : 0x2f4a7f }));
  cap.position.y = 27; g.add(cap);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(13, 12, 10), new THREE.MeshLambertMaterial({ color: o.dome != null ? o.dome : 0xbfe2ff, transparent: true, opacity: 0.22 }));
  dome.position.y = 40; g.add(dome);
  const light = new THREE.PointLight(o.light != null ? o.light : 0x66aaff, 0.5, 90);
  light.position.set(0, 46, 0); g.add(light);
  g.position.set(x, o.baseY || 0, z);
  scene.add(g);
  return g;
}

function buildFurniture(scene, type, roomW, roomD, seatsOut, kiosksOut) {
  const cx = roomW / 2, cz = roomD / 2;
  if (type === 'tavern') {
    scene.add(makeRug(cx, cz, roomW * 0.6, roomD * 0.55, 0x4a2440));
    scene.add(makeFireplace(cx, 14, Math.PI));
    // bar runs along the west wall, clear of the (east-facing) doorway
    scene.add(makeBarCounter(50, 50, 210));
    // 3 columns x 2 rows of dining sets, in neat aligned rows, with a
    // chandelier hung centered above each row
    const colX = [roomW * 0.26, roomW * 0.5, roomW * 0.74];
    const rowZ = [roomD * 0.35, roomD * 0.68];
    for (const z of rowZ) {
      scene.add(makeChandelier(roomW * 0.5, z));
      for (const x of colX) {
        addDiningSet(scene, seatsOut, x, z);
      }
    }
    scene.add(makeBarrel(24, roomD - 28));
    scene.add(makeBarrel(24, roomD - 64));
    scene.add(makeBanner(28, 100, 8, 0, 0xff9a3c));
    scene.add(makeBanner(roomW - 28, 100, 8, 0, 0xff9a3c));

    // ── Witchy dressing: the Cauldron Café earns its name ──
    // A bubbling cauldron beside the bar (decor only — Joss still runs the shop)
    const cauldron = new THREE.Group();
    const potMat = new THREE.MeshLambertMaterial({ color: 0x14100e });
    const pot = new THREE.Mesh(new THREE.SphereGeometry(16, 12, 10), potMat);
    pot.scale.y = 0.78; pot.position.y = 15;
    cauldron.add(pot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(13.5, 2.2, 8, 16), potMat);
    rim.rotation.x = Math.PI / 2; rim.position.y = 26;
    cauldron.add(rim);
    const brew = new THREE.Mesh(new THREE.CircleGeometry(12.5, 16),
      new THREE.MeshBasicMaterial({ color: 0x6fe86a }));
    brew.rotation.x = -Math.PI / 2; brew.position.y = 25;
    cauldron.add(brew);
    for (const [bx, bz, br] of [[-4, 3, 2.2], [5, -2, 1.6], [1, 6, 1.3]]) {
      const bub = new THREE.Mesh(new THREE.SphereGeometry(br, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xa8ff9a, transparent: true, opacity: 0.85 }));
      bub.position.set(bx, 27 + br, bz);
      cauldron.add(bub);
    }
    const ladle = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 34, 5),
      new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
    ladle.position.set(8, 34, 0); ladle.rotation.z = -0.5;
    cauldron.add(ladle);
    const brewGlow = new THREE.PointLight(0x6fe86a, 0.9, 160);
    brewGlow.position.y = 34;
    cauldron.add(brewGlow);
    cauldron.position.set(150, 0, 42);
    scene.add(cauldron);
    // Herb bundles drying from the beams
    const herbMat = new THREE.MeshLambertMaterial({ color: 0x4a6a2a });
    const twineMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
    for (const [hx, hz] of [[roomW * 0.35, roomD / 4], [roomW * 0.62, roomD / 4], [roomW * 0.45, roomD / 2], [roomW * 0.7, (roomD / 4) * 3]]) {
      const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 8, 4), twineMat);
      tie.position.set(hx, INDOOR_WALL_HEIGHT - 20, hz);
      scene.add(tie);
      const bundle = new THREE.Mesh(new THREE.ConeGeometry(5, 14, 6), herbMat);
      bundle.rotation.x = Math.PI; // hung tip-down
      bundle.position.set(hx, INDOOR_WALL_HEIGHT - 32, hz);
      scene.add(bundle);
    }
    // Pumpkins stacked in the far corner
    const pumpMat = new THREE.MeshLambertMaterial({ color: 0xd87a2a });
    for (const [px, pz, pr] of [[roomW - 30, roomD - 40, 9], [roomW - 46, roomD - 30, 6.5], [roomW - 30, roomD - 58, 5]]) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(pr, 10, 8), pumpMat);
      p.scale.y = 0.8; p.position.set(px, pr * 0.8, pz);
      scene.add(p);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 4, 5),
        new THREE.MeshLambertMaterial({ color: 0x4a6a2a }));
      stem.position.set(px, pr * 1.6 + 2, pz);
      scene.add(stem);
    }
    scene.add(makeShield(60, 82, 6, 0, 0xb0392b));
    scene.add(makeShield(roomW - 90, 82, 6, 0, 0x3b5fb0));
    scene.add(makeWindowGlow(6, 80, roomD * 0.18, Math.PI / 2));
    scene.add(makeWindowGlow(roomW - 6, 80, roomD * 0.85, -Math.PI / 2));

    // Framed paintings on the (otherwise bare) south wall, facing north
    // into the room.
    const tavernPaintings = [
      { symbol: '🫖', title: 'THE EVENING BREW', subtitle: 'don\'t ask what\'s in it' },
      { symbol: '🐈‍⬛', title: 'THE HOUSE CAT', subtitle: 'pays her tab in mice' },
      { symbol: '🍄', title: 'KNOW YOUR CAPS', subtitle: 'the safe ones (mostly)' }
    ];
    [roomW * 0.28, roomW * 0.5, roomW * 0.72].forEach((x, i) => {
      const p = makeWallPainting({
        ...tavernPaintings[i],
        bg1: '#2a140c', bg2: '#3c1e10', border: '#c87a3a', accent: '#ffb060'
      });
      p.position.set(x, 90, roomD - 4);
      p.rotation.y = Math.PI;
      scene.add(p);
    });

    // The Town Pass statue — a free-standing corner near the entrance,
    // clear of the dining grid, the bar, and the doorway swing.
    if (kiosksOut) {
      const statueX = roomW * 0.9, statueZ = roomD * 0.12;
      scene.add(makeStatue(statueX, statueZ));
      const statueSign = makeSignSprite('🗿 Town Pass');
      statueSign.position.set(statueX, 108, statueZ);
      scene.add(statueSign);
      kiosksOut.push({ id: 'town_pass', x: statueX, z: statueZ });

      // Two NPCs — same interact pattern as every other NPC in the game
      // (proximity + F, see tryInteract/updateInteractHint). Barkeep Joss
      // sells consumables (reuses the existing NPC_SHOPS/openNpcShopModal
      // flow, same as the outdoor town NPCs); Old Mabel doesn't sell
      // anything — she just gives a hint about whatever quest you're
      // currently on (npc_hint_talk), or tells you to come back once you
      // are on one.
      const bartender = createHumanoid(3).group;
      bartender.position.set(78, 0, 130);
      bartender.rotation.y = Math.atan2(cx - 78, cz - 130);
      scene.add(bartender);
      const bartenderLabel = makeNpcNameSprite('Barkeep Joss', 'Tavern Keeper');
      bartenderLabel.position.set(78, 90, 130);
      scene.add(bartenderLabel);
      kiosksOut.push({ x: 78, z: 130, npc: 'npc', npcId: 'npc_bartender', npcName: 'Barkeep Joss' });

      const patron = createHumanoid(0).group;
      patron.position.set(460, 0, 90);
      patron.rotation.y = Math.atan2(cx - 460, cz - 90);
      scene.add(patron);
      const patronLabel = makeNpcNameSprite('Old Mabel', 'Fireside Regular');
      patronLabel.position.set(460, 90, 90);
      scene.add(patronLabel);
      kiosksOut.push({ x: 460, z: 90, npc: 'hint', npcId: 'npc_patron', npcName: 'Old Mabel' });
    }
  } else if (type === 'library') {
    scene.add(makeRug(cx, cz, roomW * 0.5, roomD * 0.35, 0x3a2a5c));
    // The library's door is on the west wall (x=0 side), and its gap spans
    // roughly z=144..324 (centered on the room) — the two bookshelves that
    // used to sit at x=20 (right against that same wall) had z positions of
    // 194 and 244, both inside that range, so they sat almost exactly in
    // the entrance path. Removed rather than just moved; the two on the
    // east wall (away from the door) are enough for the room.
    scene.add(makeBookshelf(roomW - 20, cz - 40, -Math.PI / 2));
    scene.add(makeBookshelf(roomW - 20, cz + 10, -Math.PI / 2));
    scene.add(makeTable(cx, cz - 10));
    scene.add(makeBanner(cx, 90, 8, 0, 0x9a7ad9));

    // ── Witchy dressing: the Midnight Archive ──
    // Rune ring painted on the floor around the reading table
    (function () {
      const rc = document.createElement('canvas'); rc.width = 256; rc.height = 256;
      const rx = rc.getContext('2d');
      rx.strokeStyle = 'rgba(190,150,255,0.7)'; rx.lineWidth = 3;
      rx.beginPath(); rx.arc(128, 128, 108, 0, Math.PI * 2); rx.stroke();
      rx.beginPath(); rx.arc(128, 128, 86, 0, Math.PI * 2); rx.stroke();
      rx.fillStyle = 'rgba(210,180,255,0.85)';
      rx.font = '16px serif'; rx.textAlign = 'center'; rx.textBaseline = 'middle';
      const runes = ['ᚠ', 'ᛒ', 'ᚱ', 'ᛗ', 'ᚹ', 'ᛉ', 'ᚦ', 'ᛟ', 'ᚨ', 'ᛚ', 'ᛞ', 'ᛝ'];
      runes.forEach((rn, i) => {
        const a = i * Math.PI * 2 / runes.length;
        rx.fillText(rn, 128 + Math.cos(a) * 97, 128 + Math.sin(a) * 97);
      });
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(190, 190),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(rc), transparent: true, opacity: 0.9 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cx, 1.2, cz - 10);
      scene.add(ring);
    })();
    // Books that never learned to sit still
    [0x6a3a8a, 0x2a5a7a, 0x8a2a3a, 0x3a6a4a].forEach((col, i) => {
      const book = new THREE.Group();
      const cover = new THREE.Mesh(new THREE.BoxGeometry(13, 2.6, 9),
        new THREE.MeshLambertMaterial({ color: col }));
      book.add(cover);
      const pages = new THREE.Mesh(new THREE.BoxGeometry(11.4, 1.6, 7.6),
        new THREE.MeshLambertMaterial({ color: 0xe8e0c8 }));
      pages.position.y = 0.4;
      book.add(pages);
      book.position.set([cx - 60, cx + 55, cx - 20, cx + 90][i],
        62 + (i % 3) * 16, [cz - 55, cz - 70, cz + 60, cz + 40][i]);
      book.rotation.set(0.15 * (i - 1.5), i * 1.3, 0.1 * (i % 2 ? 1 : -1));
      scene.add(book);
    });
    // A crystal ball on the reading table
    const orbGlass = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 12),
      new THREE.MeshLambertMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.55, emissive: 0x4a3a8a, emissiveIntensity: 0.5 }));
    orbGlass.position.set(cx, 40, cz - 10);
    scene.add(orbGlass);
    const orbBase = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x3a2a1a }));
    orbBase.position.set(cx, 31, cz - 10);
    scene.add(orbBase);
    const orbLight = new THREE.PointLight(0xb98aff, 0.8, 140);
    orbLight.position.set(cx, 46, cz - 10);
    scene.add(orbLight);

    // Framed paintings on the south wall (bare — the door's on the west
    // wall, the bookshelves are on the east), facing north into the room.
    [
      { symbol: '👁️', title: 'THE UNBLINKING', subtitle: 'shelf 13 — do not read aloud', x: roomW * 0.3 },
      { symbol: '🌙', title: 'PHASES OF HER', subtitle: 'as above, so below', x: roomW * 0.7 }
    ].forEach(({ symbol, title, subtitle, x }) => {
      const p = makeWallPainting({ symbol, title, subtitle, bg1: '#160f2e', bg2: '#241a42', border: '#8a6ad0', accent: '#d0baff' });
      p.position.set(x, 90, roomD - 4);
      p.rotation.y = Math.PI;
      scene.add(p);
    });

    if (kiosksOut) {
      const scholar = createHumanoid(2).group;
      scholar.position.set(150, 0, 60);
      scholar.rotation.y = Math.atan2(cx - 150, cz - 60);
      scene.add(scholar);
      const scholarLabel = makeNpcNameSprite('Scholar Elior', 'Keeper of Robes');
      scholarLabel.position.set(150, 90, 60);
      scene.add(scholarLabel);
      kiosksOut.push({ x: 150, z: 60, npc: 'npc', npcId: 'npc_scholar', npcName: 'Scholar Elior' });

      const apprentice = createHumanoid(4).group;
      apprentice.position.set(320, 0, 60);
      apprentice.rotation.y = Math.atan2(cx - 320, cz - 60);
      scene.add(apprentice);
      const apprenticeLabel = makeNpcNameSprite('Apprentice Wren', 'Buried in Books');
      apprenticeLabel.position.set(320, 90, 60);
      scene.add(apprenticeLabel);
      kiosksOut.push({ x: 320, z: 60, npc: 'hint', npcId: 'npc_apprentice', npcName: 'Apprentice Wren' });
    }
  } else if (type === 'alchemist') {
    // ── The Starlit Arcade ──────────────────────────────────────────────
    // Witch Hazel's lair's decorating playbook (painted canvas cards on
    // every wall, a glyph ring on the floor, glowing crystals, occult
    // clutter) shifted to cold blue and a celestial symbol set:
    // constellation charts, moon phases, zodiac glyphs, and enchanted
    // relics under glass. The playable cabinets and both NPCs keep their
    // exact positions and kiosk ids — only the dressing changed.

    // A star chart in a silver frame — same canvas technique as the cave's
    // tarot cards: painted background, double border, then a scattering of
    // stars with a constellation line traced through them. Deterministic
    // per-name so charts differ from each other but never between visits.
    const makeStarChart = (glyph, name, seed) => {
      const cw = 96, ch = 128;
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      const ctx = c.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, ch);
      grad.addColorStop(0, '#050b1e'); grad.addColorStop(1, '#0b1836');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = '#8fb0d8'; ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, cw - 8, ch - 8);
      ctx.strokeStyle = '#3a5a8a'; ctx.lineWidth = 1;
      ctx.strokeRect(10, 10, cw - 20, ch - 20);
      for (const [ox, oy] of [[14, 14], [cw - 14, 14], [14, ch - 14], [cw - 14, ch - 14]]) {
        ctx.fillStyle = '#8fb0d8'; ctx.beginPath();
        ctx.arc(ox, oy, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      // Scattered stars + constellation line through the first few
      const pts = [];
      for (let i = 0; i < 14; i++) {
        const px = 20 + (Math.sin(seed * 13.7 + i * 7.3) * 0.5 + 0.5) * (cw - 40);
        const py = 30 + (Math.sin(seed * 5.1 + i * 11.9) * 0.5 + 0.5) * (ch - 70);
        pts.push([px, py]);
        const r = 0.8 + (Math.sin(seed + i * 3.3) * 0.5 + 0.5) * 1.6;
        ctx.fillStyle = `rgba(205,230,255,${0.55 + (i % 3) * 0.15})`;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(140,200,255,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath();
      pts.slice(0, 6).forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
      ctx.stroke();
      // Brighten the constellation's own stars
      for (const [px, py] of pts.slice(0, 6)) {
        ctx.fillStyle = '#e8f4ff';
        ctx.beginPath(); ctx.arc(px, py, 2.1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.textAlign = 'center';
      ctx.font = '20px serif'; ctx.fillStyle = '#bfe0ff';
      ctx.fillText(glyph, cw / 2, 28);
      ctx.font = 'bold 8px sans-serif'; ctx.fillStyle = '#8fb0d8';
      ctx.fillText(name, cw / 2, ch - 16);
      const mat = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c), emissive: 0x0d1f4a, emissiveIntensity: 0.55 });
      return new THREE.Mesh(new THREE.PlaneGeometry(62, 84), mat);
    };

    // A moon-phase plaque — silver disc, phase-shadowed, thin ring frame.
    const makeMoonPhase = (phase) => {
      const c = document.createElement('canvas'); c.width = 48; c.height = 48;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0b1836'; ctx.fillRect(0, 0, 48, 48);
      ctx.strokeStyle = '#6f92c8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(24, 24, 21, 0, Math.PI * 2); ctx.stroke();
      if (phase > 0) {
        ctx.fillStyle = '#d8e8ff';
        ctx.beginPath(); ctx.arc(24, 24, 17, 0, Math.PI * 2); ctx.fill();
        if (phase < 4) {
          // Shadow disc slides off to the left as the moon waxes
          ctx.fillStyle = '#0b1836';
          const dx = [-8, -14, -22, -30][phase - 1];
          ctx.beginPath(); ctx.arc(24 + dx, 24, 18, 0, Math.PI * 2); ctx.fill();
        }
      }
      const mat = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c), emissive: 0x0a1a33, emissiveIntensity: 0.6 });
      return new THREE.Mesh(new THREE.PlaneGeometry(26, 26), mat);
    };

    const shardMat = new THREE.MeshLambertMaterial({ color: 0x9fd4ff, emissive: 0x1d5ecc, emissiveIntensity: 0.9 });
    const makeShardCluster = (x, z) => {
      const g = new THREE.Group();
      for (const [ox, oz, r, h] of [[0, 0, 8, 18], [10, 5, 5, 10], [-8, 7, 4, 8], [4, -8, 3, 6]]) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), shardMat);
        shard.scale.y = h / (r * 2);
        shard.position.set(ox, h, oz);
        g.add(shard);
      }
      g.position.set(x, 0, z);
      scene.add(g);
    };

    scene.add(makeRug(cx, cz, roomW * 0.5, roomD * 0.35, 0x16244a));

    // Zodiac ring painted on the floor around the cauldron — the cave's
    // rune circle, celestial edition.
    (function() {
      const rc = document.createElement('canvas'); rc.width = 256; rc.height = 256;
      const rx = rc.getContext('2d');
      rx.strokeStyle = 'rgba(110,180,255,0.65)'; rx.lineWidth = 3;
      rx.beginPath(); rx.arc(128, 128, 110, 0, Math.PI * 2); rx.stroke();
      rx.lineWidth = 2;
      rx.beginPath(); rx.arc(128, 128, 86, 0, Math.PI * 2); rx.stroke();
      // Eight-pointed star inside the inner ring
      rx.strokeStyle = 'rgba(140,200,255,0.5)'; rx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const a2 = ((i + 3) / 8) * Math.PI * 2 - Math.PI / 2;
        rx.beginPath();
        rx.moveTo(128 + Math.cos(a) * 86, 128 + Math.sin(a) * 86);
        rx.lineTo(128 + Math.cos(a2) * 86, 128 + Math.sin(a2) * 86);
        rx.stroke();
      }
      // Zodiac glyphs around the ring
      rx.fillStyle = 'rgba(190,225,255,0.85)'; rx.font = '17px serif'; rx.textAlign = 'center';
      const zodiac = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
      zodiac.forEach((zg, i) => {
        const a = (i / zodiac.length) * Math.PI * 2 - Math.PI / 2;
        rx.fillText(zg, 128 + Math.cos(a) * 98, 128 + Math.sin(a) * 98 + 6);
      });
      // Dusting of tiny stars inside the circle
      for (let i = 0; i < 40; i++) {
        const a = Math.sin(i * 12.9) * Math.PI * 2, rr = (Math.sin(i * 7.7) * 0.5 + 0.5) * 78;
        rx.fillStyle = `rgba(190,225,255,${0.25 + (i % 4) * 0.12})`;
        rx.beginPath();
        rx.arc(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr, 0.8 + (i % 3) * 0.5, 0, Math.PI * 2);
        rx.fill();
      }
      const ringTex = new THREE.CanvasTexture(rc);
      const ring = new THREE.Mesh(
        new THREE.PlaneGeometry(250, 250),
        new THREE.MeshLambertMaterial({ map: ringTex, transparent: true, opacity: 0.9 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cx, 1, cz + 30);
      scene.add(ring);
    })();

    // The alchemist's old cauldron, now brewing liquid night — cyan glow,
    // cold light, a few sparks hanging over the brew.
    (function() {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(13, 9, 16, 10), new THREE.MeshLambertMaterial({ color: 0x1c1c28 }));
      pot.position.y = 10; g.add(pot);
      const brew = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 2, 10), new THREE.MeshBasicMaterial({ color: 0x4fd8ff }));
      brew.position.y = 18; g.add(brew);
      const sparkMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff });
      for (const [sx, sy, sz] of [[-6, 30, 4], [7, 38, -3], [-2, 46, -6]]) {
        const spark = new THREE.Mesh(new THREE.OctahedronGeometry(1.7, 0), sparkMat);
        spark.position.set(sx, sy, sz); g.add(spark);
      }
      const light = new THREE.PointLight(0x3fbfff, 1.3, 170);
      light.position.set(0, 30, 0); g.add(light);
      g.position.set(cx, 0, cz + 30);
      scene.add(g);
    })();

    scene.add(makeBanner(cx, 90, 8, 0, 0x4fa8ff));
    scene.add(makeBanner(roomW - 8, 95, 120, Math.PI / 2, 0x4fa8ff));
    scene.add(makeBanner(roomW - 8, 95, 366, Math.PI / 2, 0x4fa8ff));
    makeShardCluster(26, cz);
    makeShardCluster(roomW - 26, 420);

    // Two playable arcade cabinets where the old table used to be — F to
    // play, opening the matching mini-game (see openArcadeGame()).
    if (kiosksOut) {
      const cabZ = cz - 15;
      const cab1X = cx - roomW * 0.2, cab2X = cx + roomW * 0.2;

      scene.add(makeArcadeCabinet(cab1X, cabZ, 0, 0x35ffd0));
      const sign1 = makeSignSprite('🐍 Snake');
      sign1.position.set(cab1X, 92, cabZ);
      scene.add(sign1);
      kiosksOut.push({ id: 'arcade_game_snake', x: cab1X, z: cabZ, game: 'snake' });

      scene.add(makeArcadeCabinet(cab2X, cabZ, 0, 0x4f9dff));
      const sign2 = makeSignSprite('🧱 Breakout');
      sign2.position.set(cab2X, 92, cabZ);
      scene.add(sign2);
      kiosksOut.push({ id: 'arcade_game_breakout', x: cab2X, z: cabZ, game: 'breakout' });

      // ── Symbols and decorations all over the walls ────────────────────
      // North wall: four constellation charts flanking the banner
      [
        { glyph: '♈', name: 'THE RAM',      x: 90 },
        { glyph: '♏', name: 'THE SCORPION', x: 250 },
        { glyph: '♐', name: 'THE ARCHER',   x: 470 },
        { glyph: '♓', name: 'THE FISHES',   x: 630 }
      ].forEach(({ glyph, name, x }, i) => {
        const chart = makeStarChart(glyph, name, i + 1);
        chart.position.set(x, 92, 4);
        scene.add(chart);
      });
      // South wall: three more, facing back into the room
      [
        { glyph: '♌', name: 'THE LION',         x: 140 },
        { glyph: '♒', name: 'THE WATER-BEARER', x: 360 },
        { glyph: '♊', name: 'THE TWINS',        x: 580 }
      ].forEach(({ glyph, name, x }, i) => {
        const chart = makeStarChart(glyph, name, i + 5);
        chart.position.set(x, 92, roomD - 4);
        chart.rotation.y = Math.PI;
        scene.add(chart);
      });
      // East wall: one each side of the door
      [{ glyph: '♑', name: 'THE SEA-GOAT', z: 110 }, { glyph: '♋', name: 'THE CRAB', z: 376 }].forEach(({ glyph, name, z }, i) => {
        const chart = makeStarChart(glyph, name, i + 8);
        chart.position.set(roomW - 4, 92, z);
        chart.rotation.y = -Math.PI / 2;
        scene.add(chart);
      });
      // West wall: the moon's whole cycle, new to full
      [0, 1, 2, 3, 4].forEach((phase, i) => {
        const moon = makeMoonPhase(phase);
        moon.position.set(4, 100, 100 + i * 72);
        moon.rotation.y = Math.PI / 2;
        scene.add(moon);
      });
      // Free-floating glyphs scattered between everything
      [
        ['✶', 170, 122, 6, 0], ['☾', 410, 60, 6, 0], ['☄', 550, 122, 6, 0],
        ['⚝', 250, 125, roomD - 6, Math.PI], ['✷', 470, 125, roomD - 6, Math.PI],
        ['☿', 6, 60, 150, Math.PI / 2], ['✦', 6, 130, 243, Math.PI / 2], ['♄', 6, 60, 340, Math.PI / 2],
        ['☽', roomW - 6, 125, 90, -Math.PI / 2], ['✶', roomW - 6, 125, 400, -Math.PI / 2]
      ].forEach(([glyph, x, y, z, rotY]) => {
        const gl = makeGlowGlyphMesh(glyph, 24);
        gl.position.set(x, y, z);
        gl.rotation.y = rotY;
        scene.add(gl);
      });

      // ── Magical items on display, under glass ─────────────────────────
      // Scrying orb
      (function() {
        const p = makeDisplayPedestal(scene, 90, 120);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 12), new THREE.MeshLambertMaterial({ color: 0x66ccff, emissive: 0x2f7fff, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }));
        orb.position.y = 38; p.add(orb);
        const core = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 8), new THREE.MeshBasicMaterial({ color: 0xd8f2ff }));
        core.position.y = 38; p.add(core);
        const sign = makeSignSprite('🔮 Scrying Orb');
        sign.position.set(90, 74, 120); scene.add(sign);
      })();
      // Star grimoire — open book hovering above the pedestal
      (function() {
        const p = makeDisplayPedestal(scene, roomW - 90, 120);
        const coverMat = new THREE.MeshLambertMaterial({ color: 0x1a2f5e, emissive: 0x0a1830, emissiveIntensity: 0.5 });
        const pageMat = new THREE.MeshLambertMaterial({ color: 0xe8f0ff, emissive: 0x3355aa, emissiveIntensity: 0.25 });
        for (const s of [-1, 1]) {
          const cover = new THREE.Mesh(new THREE.BoxGeometry(9, 1.4, 12), coverMat);
          cover.position.set(s * 4.4, 37, 0);
          cover.rotation.z = -s * 0.28;
          p.add(cover);
          const page = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 10.5), pageMat);
          page.position.set(s * 4.1, 37.9, 0);
          page.rotation.z = -s * 0.28;
          p.add(page);
        }
        const sign = makeSignSprite('📖 Star Grimoire');
        sign.position.set(roomW - 90, 74, 120); scene.add(sign);
      })();
      // Starforged blade — upright, point down
      (function() {
        const p = makeDisplayPedestal(scene, 90, 356);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(2.2, 24, 5), new THREE.MeshLambertMaterial({ color: 0xdfeaff, emissive: 0x6f9fe8, emissiveIntensity: 0.5 }));
        blade.position.y = 44; blade.rotation.z = 0.12; p.add(blade);
        const guard = new THREE.Mesh(new THREE.BoxGeometry(9, 2, 3), new THREE.MeshLambertMaterial({ color: 0x2f4a7f }));
        guard.position.set(-0.7, 53.5, 0); guard.rotation.z = 0.12; p.add(guard);
        const pommel = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), new THREE.MeshLambertMaterial({ color: 0x9fd4ff, emissive: 0x1d5ecc, emissiveIntensity: 0.9 }));
        pommel.position.set(-1.4, 58.5, 0); p.add(pommel);
        const sign = makeSignSprite('🗡️ Starforged Blade');
        sign.position.set(90, 78, 356); scene.add(sign);
      })();
      // Moon relic — a silver crescent with two trailing motes
      (function() {
        const p = makeDisplayPedestal(scene, roomW - 90, 356);
        const moonMat = new THREE.MeshLambertMaterial({ color: 0xe4e9ff, emissive: 0x6a74c8, emissiveIntensity: 0.55 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(5.5, 10, 10), moonMat);
        body.position.y = 40; p.add(body);
        const bite = new THREE.Mesh(new THREE.SphereGeometry(4.6, 10, 10), new THREE.MeshLambertMaterial({ color: 0x070f22 }));
        bite.position.set(2.8, 41.5, 2.2); p.add(bite);
        const m1 = new THREE.Mesh(new THREE.SphereGeometry(1.4, 6, 6), moonMat);
        m1.position.set(-7, 46, 0); p.add(m1);
        const m2 = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 6), moonMat);
        m2.position.set(-4, 50, 2); p.add(m2);
        const sign = makeSignSprite('🌙 Moon Relic');
        sign.position.set(roomW - 90, 78, 356); scene.add(sign);
      })();

      const alchemist = createHumanoid(0).group;
      alchemist.position.set(150, 0, roomD - 90);
      alchemist.rotation.y = Math.atan2(cx - 150, cz - (roomD - 90));
      scene.add(alchemist);
      const alchemistLabel = makeNpcNameSprite('Apothecary Vex', 'Brews & Tonics');
      alchemistLabel.position.set(150, 90, roomD - 90);
      scene.add(alchemistLabel);
      kiosksOut.push({ x: 150, z: roomD - 90, npc: 'npc', npcId: 'npc_apothecary', npcName: 'Apothecary Vex' });

      const tinkerer = createHumanoid(4).group;
      tinkerer.position.set(roomW - 150, 0, roomD - 90);
      tinkerer.rotation.y = Math.atan2(cx - (roomW - 150), cz - (roomD - 90));
      scene.add(tinkerer);
      const tinkererLabel = makeNpcNameSprite('Tinkerer Oswin', 'Fiddles With Everything');
      tinkererLabel.position.set(roomW - 150, 90, roomD - 90);
      scene.add(tinkererLabel);
      kiosksOut.push({ x: roomW - 150, z: roomD - 90, npc: 'hint', npcId: 'npc_tinkerer', npcName: 'Tinkerer Oswin' });
    }
  } else if (type === 'parlor') {
    // ── The Phantom Parlor (ex-Rooftop Lounge) ──────────────────────────
    // Third room of the witchy trilogy — the cave is purple, the Starlight
    // Arcade blue, and this séance parlor ghost-green. Same decorating
    // playbook (painted canvas cards, a glyph ring on the floor, glowing
    // occult clutter, relics under glass), haunted-house symbol set: a
    // portrait gallery of the departed, drifting spirit wisps (see the
    // 'wisp' lightsStyle in getInteriorScene), witchfire in the hearth.
    // The two-story STRUCTURE is untouched: ground floor west, staircase,
    // terrace east — every dining seat and both NPCs keep their exact
    // positions and kiosk ids.
    const stairStart = roomW * LOUNGE_STAIR_START_FRAC;
    const groundCx = stairStart / 2;

    // A haunted portrait — the tarot-card technique grown up: ornate
    // silver-green frame, a pale hooded spirit painted inside, a memorial
    // plaque line. Each sitter gets their own hunch via the seed.
    const makeHauntedPortrait = (name, epitaph, seed) => {
      const cw = 96, ch = 128;
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      const ctx = c.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, ch);
      grad.addColorStop(0, '#04120c'); grad.addColorStop(1, '#0a241a');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = '#7fc9a0'; ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, cw - 8, ch - 8);
      ctx.strokeStyle = '#2e5a44'; ctx.lineWidth = 1;
      ctx.strokeRect(10, 10, cw - 20, ch - 20);
      for (const [ox, oy] of [[14, 14], [cw - 14, 14], [14, ch - 14], [cw - 14, ch - 14]]) {
        ctx.fillStyle = '#7fc9a0'; ctx.beginPath();
        ctx.arc(ox, oy, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      // The sitter: a translucent hooded figure, softly glowing, slightly
      // off-center and tilted per portrait so the gallery feels peopled.
      const px = cw / 2 + Math.sin(seed * 7.3) * 6;
      const tilt = Math.sin(seed * 3.1) * 0.18;
      ctx.save();
      ctx.translate(px, 62); ctx.rotate(tilt);
      ctx.shadowColor = '#8fffbe'; ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(190,255,220,0.5)';
      ctx.beginPath(); // hood + shoulders
      ctx.arc(0, -14, 13, Math.PI, 0);
      ctx.quadraticCurveTo(17, 8, 13, 26);
      // trailing wisp hem
      ctx.quadraticCurveTo(8, 20, 4, 28);
      ctx.quadraticCurveTo(0, 20, -4, 28);
      ctx.quadraticCurveTo(-8, 20, -13, 26);
      ctx.quadraticCurveTo(-17, 8, -13, -14);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(6,20,14,0.9)'; // the dark under the hood
      ctx.beginPath(); ctx.arc(0, -12, 8.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b8ffd8'; // two faint eyes
      ctx.beginPath(); ctx.arc(-3, -13, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3, -13, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.font = 'bold 8px sans-serif'; ctx.fillStyle = '#7fc9a0';
      ctx.fillText(name, cw / 2, ch - 24);
      ctx.font = 'italic 6.5px serif'; ctx.fillStyle = '#5a9a78';
      ctx.fillText(epitaph, cw / 2, ch - 14);
      const mat = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c), emissive: 0x0c2418, emissiveIntensity: 0.55 });
      return new THREE.Mesh(new THREE.PlaneGeometry(62, 84), mat);
    };

    // Ghost-green display pedestal shorthand
    const PARLOR_PED = { stone: 0x24463a, cap: 0x2e5a48, dome: 0xbfffe0, light: 0x5fe8a0 };

    // Séance rug + circle where the old parlor rug lay
    scene.add(makeRug(groundCx, roomD * 0.42, stairStart * 0.5, roomD * 0.4, 0x14332a));
    (function() {
      const rc = document.createElement('canvas'); rc.width = 256; rc.height = 256;
      const rx = rc.getContext('2d');
      rx.strokeStyle = 'rgba(120,255,180,0.6)'; rx.lineWidth = 3;
      rx.beginPath(); rx.arc(128, 128, 110, 0, Math.PI * 2); rx.stroke();
      rx.lineWidth = 2;
      rx.beginPath(); rx.arc(128, 128, 84, 0, Math.PI * 2); rx.stroke();
      // Candle marks around the outer ring — every other one "lit"
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        rx.fillStyle = i % 2 ? 'rgba(150,255,200,0.85)' : 'rgba(90,160,125,0.5)';
        rx.beginPath();
        rx.arc(128 + Math.cos(a) * 97, 128 + Math.sin(a) * 97, i % 2 ? 3.4 : 2.2, 0, Math.PI * 2);
        rx.fill();
      }
      // Spirit-board furniture: YES / NO across the middle ring, a moon and
      // sun mark, and a planchette outline resting dead center.
      rx.fillStyle = 'rgba(190,255,220,0.8)'; rx.textAlign = 'center';
      rx.font = 'bold 15px serif';
      rx.fillText('YES', 66, 134);
      rx.fillText('NO', 190, 134);
      rx.font = '16px serif';
      rx.fillText('☾', 128, 70);
      rx.fillText('✶', 128, 200);
      rx.strokeStyle = 'rgba(170,255,210,0.75)'; rx.lineWidth = 2;
      rx.beginPath(); // teardrop planchette
      rx.moveTo(128, 104);
      rx.quadraticCurveTo(152, 122, 128, 152);
      rx.quadraticCurveTo(104, 122, 128, 104);
      rx.closePath(); rx.stroke();
      rx.beginPath(); rx.arc(128, 126, 7, 0, Math.PI * 2); rx.stroke();
      const tex = new THREE.CanvasTexture(rc);
      const ring = new THREE.Mesh(
        new THREE.PlaneGeometry(230, 230),
        new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: 0.9 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(groundCx, 1.2, roomD * 0.42);
      scene.add(ring);
    })();

    // The hearth, now burning witchfire — same footprint as the old
    // fireplace, green flame, cold green light, embers drifting up.
    (function() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(50, 60, 18), new THREE.MeshLambertMaterial({ color: 0x2e4438 }));
      body.position.y = 30; g.add(body);
      const hole = new THREE.Mesh(new THREE.BoxGeometry(30, 34, 10), new THREE.MeshBasicMaterial({ color: 0x49ff9e }));
      hole.position.set(0, 20, 2); g.add(hole);
      const emberMat = new THREE.MeshBasicMaterial({ color: 0xb8ffd8 });
      for (const [ex, ey, ez, er] of [[-8, 66, 6, 1.8], [5, 74, 4, 1.3], [0, 82, 6, 0.9]]) {
        const ember = new THREE.Mesh(new THREE.SphereGeometry(er, 6, 6), emberMat);
        ember.position.set(ex, ey, ez); g.add(ember);
      }
      const glow = new THREE.PointLight(0x3fe88a, 1.2, 260);
      glow.position.set(0, 24, 12); g.add(glow);
      g.position.set(groundCx, 0, 14); g.rotation.y = Math.PI;
      scene.add(g);
    })();

    scene.add(makeBench(groundCx - 40, roomD * 0.7, Math.PI / 2));
    scene.add(makeBench(groundCx + 40, roomD * 0.7, -Math.PI / 2));
    scene.add(makeTable(groundCx, roomD * 0.7));
    scene.add(makeBanner(30, 90, 8, 0, 0x54e8a8));
    scene.add(makeBanner(stairStart - 30, 90, 8, 0, 0x54e8a8));

    // 4 more dining tables downstairs, arranged in a neat 2x2 grid in the
    // rest of the ground floor.
    const groundColX = [stairStart * 0.28, stairStart * 0.78];
    const groundRowZ = [roomD * 0.22, roomD * 0.82];
    for (const z of groundRowZ) {
      for (const x of groundColX) {
        addDiningSet(scene, seatsOut, x, z);
      }
    }

    buildLoungeStructure(scene, roomW, roomD);

    // 3 tables up on the terrace, evenly spaced, overlooking the railing
    const stairEnd = roomW * LOUNGE_STAIR_END_FRAC;
    const platformWidth = roomW - stairEnd;
    const terraceXs = [stairEnd + platformWidth * 0.22, stairEnd + platformWidth * 0.52, stairEnd + platformWidth * 0.82];
    for (const x of terraceXs) {
      addElevatedTable(scene, x, roomD * 0.5, LOUNGE_PLATFORM_HEIGHT);
    }

    // ── The portrait gallery of the departed, all over the walls ────────
    const PORTRAITS = [
      { name: 'LADY MIRTHWOOD', epitaph: 'departed 1802', x: 120, z: 4, rotY: 0 },
      { name: 'THE GREY EARL', epitaph: 'never left', x: 300, z: 4, rotY: 0 },
      { name: 'SISTER OPALINE', epitaph: 'still humming', x: 480, z: 4, rotY: 0 },
      { name: 'MASTER HOLLOWAY', epitaph: 'plays at midnight', x: 120, z: roomD - 4, rotY: Math.PI },
      { name: 'THE TWINS', epitaph: 'they watch the stairs', x: 300, z: roomD - 4, rotY: Math.PI },
      { name: 'UNKNOWN GUEST', epitaph: 'checked in forever', x: 480, z: roomD - 4, rotY: Math.PI }
    ];
    PORTRAITS.forEach(({ name, epitaph, x, z, rotY }, i) => {
      const p = makeHauntedPortrait(name, epitaph, i + 1);
      p.position.set(x, 92, z);
      p.rotation.y = rotY;
      scene.add(p);
    });
    // Two more watch over the terrace from the east wall
    [
      { name: 'THE WIDOW', epitaph: 'she keeps the watch', z: 200 },
      { name: 'CAPTAIN VANE', epitaph: 'lost at moonrise', z: 300 }
    ].forEach(({ name, epitaph, z }, i) => {
      const p = makeHauntedPortrait(name, epitaph, i + 7);
      p.position.set(roomW - 4, LOUNGE_PLATFORM_HEIGHT + 70, z);
      p.rotation.y = -Math.PI / 2;
      scene.add(p);
    });

    // Free-floating glyphs between the portraits, ghost-green
    [
      ['☾', 210, 125, 6, 0], ['🕯️', 390, 60, 6, 0],
      ['✧', 210, 128, roomD - 6, Math.PI], ['👻', 390, 128, roomD - 6, Math.PI],
      ['✦', 6, 120, 120, Math.PI / 2], ['☽', 6, 120, 366, Math.PI / 2],
      ['✶', 730, 125, roomD - 6, Math.PI], ['🕯️', roomW - 6, LOUNGE_PLATFORM_HEIGHT + 74, 245, -Math.PI / 2]
    ].forEach(([glyph, x, y, z, rotY]) => {
      const gl = makeGlowGlyphMesh(glyph, 24, '#5fffae', '#d8ffe8');
      gl.position.set(x, y, z);
      gl.rotation.y = rotY;
      scene.add(gl);
    });

    // ── Haunted relics on display, under glass ──────────────────────────
    // Phantom lantern — an iron cage holding a flame that never was
    (function() {
      const p = makeDisplayPedestal(scene, 150, 250, PARLOR_PED);
      const iron = new THREE.MeshLambertMaterial({ color: 0x1a2420 });
      const bot = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 1.6, 8), iron);
      bot.position.y = 33; p.add(bot);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6, 1.6, 8), iron);
      top.position.y = 48; p.add(top);
      for (let i = 0; i < 4; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 5), iron);
        post.position.set(Math.cos(i * Math.PI / 2) * 5.2, 40.5, Math.sin(i * Math.PI / 2) * 5.2);
        p.add(post);
      }
      const flame = new THREE.Mesh(new THREE.SphereGeometry(3.4, 8, 8), new THREE.MeshBasicMaterial({ color: 0x6fffb0 }));
      flame.scale.y = 1.5; flame.position.y = 40.5; p.add(flame);
      const sign = makeSignSprite('🕯️ Phantom Lantern');
      sign.position.set(150, 74, 250); scene.add(sign);
    })();
    // Spirit bell — rings by itself, allegedly
    (function() {
      const p = makeDisplayPedestal(scene, groundCx, 95, PARLOR_PED);
      const bellMat = new THREE.MeshLambertMaterial({ color: 0xcfe8dc, emissive: 0x2e5a48, emissiveIntensity: 0.35 });
      const bell = new THREE.Mesh(new THREE.ConeGeometry(6.5, 11, 10), bellMat);
      bell.position.y = 41; p.add(bell);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 6), bellMat);
      knob.position.y = 47.5; p.add(knob);
      const clapper = new THREE.Mesh(new THREE.SphereGeometry(1.4, 6, 6), new THREE.MeshLambertMaterial({ color: 0x1a2420 }));
      clapper.position.set(1.2, 35, 0); p.add(clapper);
      const sign = makeSignSprite('🔔 Spirit Bell');
      sign.position.set(groundCx, 74, 95); scene.add(sign);
    })();
    // Bound spirit — a jar nobody should open
    (function() {
      const p = makeDisplayPedestal(scene, 520, 250, PARLOR_PED);
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, 13, 9), new THREE.MeshLambertMaterial({ color: 0x9fd8c0, transparent: true, opacity: 0.35 }));
      jar.position.y = 40; p.add(jar);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 2, 9), new THREE.MeshLambertMaterial({ color: 0x1a2420 }));
      lid.position.y = 47.5; p.add(lid);
      const wisp = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 8), new THREE.MeshBasicMaterial({ color: 0x8fffbe }));
      wisp.position.set(-1, 39, 0.5); p.add(wisp);
      const mote = new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xd8ffe8 }));
      mote.position.set(2, 43, -1); p.add(mote);
      const sign = makeSignSprite('🫙 Bound Spirit');
      sign.position.set(520, 74, 250); scene.add(sign);
    })();
    // Séance planchette — up on the Widow's Watch
    (function() {
      const px = stairEnd + platformWidth * 0.5, pz = roomD * 0.22;
      const p = makeDisplayPedestal(scene, px, pz, { ...PARLOR_PED, baseY: LOUNGE_PLATFORM_HEIGHT });
      const board = new THREE.Mesh(new THREE.BoxGeometry(13, 1.8, 17), new THREE.MeshLambertMaterial({ color: 0x2e4a3e }));
      board.position.y = 36; board.rotation.y = 0.5; p.add(board);
      const window_ = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 2.2, 10), new THREE.MeshLambertMaterial({ color: 0xbfffe0, transparent: true, opacity: 0.6 }));
      window_.position.set(0, 36.6, 2); window_.rotation.y = 0.5; p.add(window_);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.5, 6), new THREE.MeshLambertMaterial({ color: 0x2e4a3e }));
      tip.position.set(-2.6, 36.6, -7.2); tip.rotation.z = Math.PI / 2; tip.rotation.y = 0.5; p.add(tip);
      const sign = makeSignSprite('🔮 Séance Planchette');
      sign.position.set(px, LOUNGE_PLATFORM_HEIGHT + 74, pz); scene.add(sign);
    })();

    if (kiosksOut) {
      const tailor = createHumanoid(2).group;
      tailor.position.set(80, 0, roomD * 0.25);
      tailor.rotation.y = Math.atan2(groundCx - 80, roomD * 0.42 - roomD * 0.25);
      scene.add(tailor);
      const tailorLabel = makeNpcNameSprite('Tailor Ines', 'Fine Wearables');
      tailorLabel.position.set(80, 90, roomD * 0.25);
      scene.add(tailorLabel);
      kiosksOut.push({ x: 80, z: roomD * 0.25, npc: 'npc', npcId: 'npc_tailor', npcName: 'Tailor Ines' });

      const noble = createHumanoid(3).group;
      noble.position.set(stairStart - 60, 0, roomD * 0.25);
      noble.rotation.y = Math.atan2(groundCx - (stairStart - 60), roomD * 0.42 - roomD * 0.25);
      scene.add(noble);
      const nobleLabel = makeNpcNameSprite('Lady Corwin', 'Loves to Gossip');
      nobleLabel.position.set(stairStart - 60, 90, roomD * 0.25);
      scene.add(nobleLabel);
      kiosksOut.push({ x: stairStart - 60, z: roomD * 0.25, npc: 'hint', npcId: 'npc_noble', npcName: 'Lady Corwin' });
    }
  } else if (type === 'greathall') {
    scene.add(makeRug(cx, cz, roomW * 0.6, roomD * 0.6, 0x5c1f2a));
    scene.add(makeThrone(cx, 30, 0));
    scene.add(makeTable(cx, cz + 15));
    scene.add(makeBench(cx - 26, cz + 30, 0));
    scene.add(makeBench(cx + 26, cz + 30, 0));
    scene.add(makeBanner(20, 95, 6, 0, 0xd84a5a));
    scene.add(makeBanner(roomW - 20, 95, 6, 0, 0xd84a5a));

    // ── Witchy dressing: the Coven Court ──
    // A great pentacle inlaid in the floor, the council table set upon it
    (function () {
      const pc = document.createElement('canvas'); pc.width = 256; pc.height = 256;
      const px = pc.getContext('2d');
      px.strokeStyle = 'rgba(255,140,120,0.8)'; px.lineWidth = 4;
      px.beginPath(); px.arc(128, 128, 112, 0, Math.PI * 2); px.stroke();
      px.lineWidth = 3;
      px.beginPath();
      [0, 2, 4, 1, 3].forEach((k, i) => {
        const a = -Math.PI / 2 + k * Math.PI * 2 / 5;
        const sx2 = 128 + Math.cos(a) * 112, sy2 = 128 + Math.sin(a) * 112;
        i === 0 ? px.moveTo(sx2, sy2) : px.lineTo(sx2, sy2);
      });
      px.closePath(); px.stroke();
      const inlay = new THREE.Mesh(new THREE.PlaneGeometry(230, 230),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pc), transparent: true, opacity: 0.85 }));
      inlay.rotation.x = -Math.PI / 2;
      inlay.position.set(cx, 1.2, cz + 40);
      scene.add(inlay);
    })();
    // Thirteen candles ring the pentacle — three burn, as tradition demands
    for (let i = 0; i < 13; i++) {
      const a = i * Math.PI * 2 / 13;
      const cxp = cx + Math.cos(a) * 128, czp = cz + 40 + Math.sin(a) * 128;
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 10 + (i % 3) * 3, 6),
        new THREE.MeshLambertMaterial({ color: 0xe8dcc8 }));
      candle.position.set(cxp, 5 + (i % 3) * 1.5, czp);
      scene.add(candle);
      if (i % 4 === 0) {
        const fl = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
        fl.scale.y = 1.8;
        fl.position.set(cxp, 12 + (i % 3) * 3, czp);
        scene.add(fl);
      }
    }

    // Framed paintings on the west/east walls, clear of the throne/table.
    [
      { symbol: '🌙', title: 'THE FIRST COVEN', subtitle: 'thirteen chairs, one empty', x: 4, rotY: Math.PI / 2 },
      { symbol: '🕯️', title: 'THE ACCORD', subtitle: 'signed thrice, in wax', x: roomW - 4, rotY: -Math.PI / 2 }
    ].forEach(({ symbol, title, subtitle, x, rotY }) => {
      const p = makeWallPainting({ symbol, title, subtitle, bg1: '#2a1218', bg2: '#3c1a22', border: '#c8506a', accent: '#ffb9c8' });
      p.position.set(x, 90, cz);
      p.rotation.y = rotY;
      scene.add(p);
    });

    if (kiosksOut) {
      const armorer = createHumanoid(1).group;
      armorer.position.set(150, 0, roomD * 0.4);
      armorer.rotation.y = Math.atan2(cx - 150, cz - roomD * 0.4);
      scene.add(armorer);
      const armorerLabel = makeNpcNameSprite('Armorer Beck', 'Steel & Shields');
      armorerLabel.position.set(150, 90, roomD * 0.4);
      scene.add(armorerLabel);
      kiosksOut.push({ x: 150, z: roomD * 0.4, npc: 'npc', npcId: 'npc_armorer', npcName: 'Armorer Beck' });

      const knight = createHumanoid(3).group;
      knight.position.set(roomW - 150, 0, roomD * 0.4);
      knight.rotation.y = Math.atan2(cx - (roomW - 150), cz - roomD * 0.4);
      scene.add(knight);
      const knightLabel = makeNpcNameSprite('Sir Dorran', 'Hall Guard');
      knightLabel.position.set(roomW - 150, 90, roomD * 0.4);
      scene.add(knightLabel);
      kiosksOut.push({ x: roomW - 150, z: roomD * 0.4, npc: 'hint', npcId: 'npc_knight', npcName: 'Sir Dorran' });
    }
  } else { // bank — door is north, so "deeper into the room" means higher z
    scene.add(makeRug(cx, roomD * 0.38, roomW * 0.32, roomD * 0.5, 0x7a1f1f));
    scene.add(makeBanner(30, 100, 6, 0, 0xd4af37));
    scene.add(makeBanner(roomW - 30, 100, 6, 0, 0xd4af37));

    // The vault door used to just sit flush and closed on the back wall —
    // now it's swung open on a hinge at its left edge, revealing a
    // recessed treasure chamber behind it. The chamber itself sits just in
    // front of the room's actual back wall (not cut through it — this
    // interior is a flat solid slab like every other room's walls), so the
    // "depth" is an illusion of darker recessed panels rather than a real
    // hole, same trick as everything else stylized in this scene.
    const vaultHingeX = cx - 70;
    const vaultHinge = new THREE.Group();
    vaultHinge.position.set(vaultHingeX, 0, roomD - 10);
    // Positive, not negative: this swings the door out toward -Z (into the
    // room, where the player actually is) instead of +Z, which sends it
    // behind the room's own solid back wall — completely hidden from
    // inside, which is exactly why it looked like nothing happened.
    //
    // Angle: 1.1 rad swung a 70-unit-radius disc so far that its center
    // landed at z=1007.6 in this room — *behind* the treasure chamber's
    // own back panel (z~1021), meaning the door flew straight past its
    // own alcove and out into the open room, fully detached from its
    // frame. That's what read as "backwards"/wrong. 0.45 rad keeps it
    // near its frame (lands around z=1039.6, well inside the chamber's
    // depth) while still clearly standing ajar.
    vaultHinge.rotation.y = 0.45;
    const vault = new THREE.Mesh(
      new THREE.CylinderGeometry(70, 70, 8, 24),
      new THREE.MeshLambertMaterial({ color: 0x6b6b6b })
    );
    vault.rotation.x = Math.PI / 2;
    vault.position.set(70, 95, 0);
    vaultHinge.add(vault);
    const vaultHub = new THREE.Mesh(
      new THREE.CylinderGeometry(16, 16, 12, 12),
      new THREE.MeshLambertMaterial({ color: 0xd4af37 })
    );
    vaultHub.rotation.x = Math.PI / 2;
    vaultHub.position.set(70, 95, 4);
    vaultHinge.add(vaultHub);
    scene.add(vaultHinge);

    // Recessed treasure chamber — dark panels framing the opening, filled
    // with coin piles, gold bars, gems, and a couple of chests, lit by a
    // warm glow so it actually reads as "full of treasure" rather than
    // just a dark box.
    const chamberMat = new THREE.MeshLambertMaterial({ color: 0x241f16 });
    const chamberW = 150, chamberH = 130, chamberD = 55;
    const chamberBack = new THREE.Mesh(new THREE.BoxGeometry(chamberW, chamberH, 8), chamberMat);
    chamberBack.position.set(cx, chamberH / 2 + 10, roomD - chamberD - 4);
    scene.add(chamberBack);
    const chamberSideL = new THREE.Mesh(new THREE.BoxGeometry(8, chamberH, chamberD), chamberMat);
    chamberSideL.position.set(cx - chamberW / 2, chamberH / 2 + 10, roomD - chamberD / 2 - 8);
    scene.add(chamberSideL);
    const chamberSideR = new THREE.Mesh(new THREE.BoxGeometry(8, chamberH, chamberD), chamberMat);
    chamberSideR.position.set(cx + chamberW / 2, chamberH / 2 + 10, roomD - chamberD / 2 - 8);
    scene.add(chamberSideR);
    const chamberTop = new THREE.Mesh(new THREE.BoxGeometry(chamberW, 8, chamberD), chamberMat);
    chamberTop.position.set(cx, chamberH + 10, roomD - chamberD / 2 - 8);
    scene.add(chamberTop);

    const goldMat = new THREE.MeshLambertMaterial({ color: 0xd4af37, emissive: 0x4a3a10, emissiveIntensity: 0.4 });
    // Coin piles: a few short wide cylinders stacked slightly askew
    for (const [px, pz] of [[cx - 45, roomD - 20], [cx - 10, roomD - 15], [cx + 35, roomD - 22]]) {
      for (let i = 0; i < 3; i++) {
        const r = 20 - i * 3;
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 4, 14), goldMat);
        coin.position.set(px + (Math.random() - 0.5) * 4, 10 + i * 5, pz + (Math.random() - 0.5) * 4);
        coin.rotation.z = (Math.random() - 0.5) * 0.12;
        scene.add(coin);
      }
    }
    // Gold bars
    for (const [px, pz, rotY] of [[cx + 15, roomD - 35, 0.3], [cx - 25, roomD - 40, -0.4]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 11), goldMat);
      bar.position.set(px, 15, pz);
      bar.rotation.y = rotY;
      scene.add(bar);
    }
    // Loose gems — small colored octahedrons scattered among the coins
    const gemColors = [0xff3355, 0x33ccff, 0x66ff66, 0xcc66ff];
    for (let i = 0; i < 8; i++) {
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(4 + Math.random() * 2),
        new THREE.MeshLambertMaterial({ color: gemColors[i % gemColors.length], emissive: gemColors[i % gemColors.length], emissiveIntensity: 0.35 })
      );
      gem.position.set(cx + (Math.random() - 0.5) * 110, 8 + Math.random() * 20, roomD - 15 - Math.random() * 30);
      scene.add(gem);
    }
    // Two open treasure chests flanking the coin piles
    for (const [px, rotY] of [[cx - 60, 0.3], [cx + 60, -0.3]]) {
      const chest = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(28, 16, 20), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
      body.position.y = 8;
      chest.add(body);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(28, 10, 20), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
      lid.position.set(0, 18, -8);
      lid.rotation.x = -1.1; // propped open
      chest.add(lid);
      const spill = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 3, 12), goldMat);
      spill.position.y = 17;
      chest.add(spill);
      chest.position.set(px, 0, roomD - 30);
      chest.rotation.y = rotY;
      scene.add(chest);
    }
    // Warm glow from within the vault
    const vaultGlow = new THREE.PointLight(0xffcc66, 1.3, 220);
    vaultGlow.position.set(cx, 60, roomD - 30);
    scene.add(vaultGlow);

    // ── Witchy dressing: the Gilded Vault ──
    // The Auditor — a raven on a marble perch, watching every transaction
    const perch = new THREE.Mesh(new THREE.CylinderGeometry(7, 9, 42, 8),
      new THREE.MeshLambertMaterial({ color: 0x8a8a92 }));
    perch.position.set(roomW - 60, 21, roomD * 0.2);
    scene.add(perch);
    const raven = new THREE.Group();
    const ravenMat = new THREE.MeshLambertMaterial({ color: 0x0c0c12 });
    const rBody = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 8), ravenMat);
    rBody.scale.set(1, 0.9, 1.4);
    raven.add(rBody);
    const rHead = new THREE.Mesh(new THREE.SphereGeometry(4.2, 8, 8), ravenMat);
    rHead.position.set(0, 6.5, 6);
    raven.add(rHead);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 5),
      new THREE.MeshLambertMaterial({ color: 0x3a3a42 }));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 6, 11);
    raven.add(beak);
    const rTail = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 10), ravenMat);
    rTail.position.set(0, 1, -10);
    rTail.rotation.x = -0.25;
    raven.add(rTail);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd43b }));
      eye.position.set(2.2 * s, 7.5, 8.5);
      raven.add(eye);
    }
    raven.position.set(roomW - 60, 46, roomD * 0.2);
    raven.rotation.y = -Math.PI / 4;
    scene.add(raven);

    // The treasure chamber above is just a recessed alcove (a peek from
    // outside) — this kiosk is what actually lets the player walk into a
    // full separate vault room (see enterVault()/buildVaultScene()). Sits
    // well clear of the back wall's collision (which the player can't get
    // right up against anyway) rather than right at the door itself, and
    // uses a generous radius, so reachability doesn't depend on getting
    // the exact wall-collision math pixel-perfect.
    if (kiosksOut) {
      // roomD - 60 (used previously) sat at almost the exact same depth as
      // the chamber's own back panel (z~1021 vs the panel's z~1021) —
      // right at the recessed alcove, not clearly in the open room, and
      // close enough to the back wall's own collision that reachability
      // wasn't obvious. roomD*0.75 sits well clear of both the wall/
      // chamber and the service counters (stationZ = roomD*0.58) —
      // unambiguously open floor, no wall-collision math to get right.
      kiosksOut.push({ x: cx, z: roomD * 0.75, portal: 'vault_enter', radius: 140 });
    }

    // Three service stations side by side, set well back from the door so
    // there's open floor to walk in on: a teller counter, an auctioneer's
    // podium, and a wire clerk's desk for sending gold to other players.
    // Each NPC stands just behind its counter/podium/desk; the kiosk
    // interact point sits just in front, where a player naturally ends up
    // walking up to it.
    const stationZ = roomD * 0.58;
    const tellerX = cx - roomW * 0.28;
    const courierX = cx;
    const auctioneerX = cx + roomW * 0.28;

    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(roomW * 0.22, 34, 22),
      new THREE.MeshLambertMaterial({ color: 0x3c3528 })
    );
    counter.position.set(tellerX, 17, stationZ);
    scene.add(counter);
    const counterTop = new THREE.Mesh(
      new THREE.BoxGeometry(roomW * 0.24, 3, 25),
      new THREE.MeshLambertMaterial({ color: 0xd4af37 })
    );
    counterTop.position.set(tellerX, 35, stationZ);
    scene.add(counterTop);

    const wireDesk = new THREE.Mesh(
      new THREE.BoxGeometry(roomW * 0.2, 30, 20),
      new THREE.MeshLambertMaterial({ color: 0x33424a })
    );
    wireDesk.position.set(courierX, 15, stationZ);
    scene.add(wireDesk);
    const wireDeskTop = new THREE.Mesh(
      new THREE.BoxGeometry(roomW * 0.22, 3, 23),
      new THREE.MeshLambertMaterial({ color: 0x8fb8c9 })
    );
    wireDeskTop.position.set(courierX, 31, stationZ);
    scene.add(wireDeskTop);

    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(20, 24, 38, 8),
      new THREE.MeshLambertMaterial({ color: 0x4a3320 })
    );
    podium.position.set(auctioneerX, 19, stationZ);
    scene.add(podium);

    if (kiosksOut) {
      const npcZ = stationZ + 28, kioskZ = stationZ - 26;

      const teller = createHumanoid(3).group; // "Knight" preset — reads well as a uniform
      teller.position.set(tellerX, 0, npcZ);
      teller.rotation.y = Math.PI;
      scene.add(teller);
      const tellerSign = makeSignSprite('🏦 Bank Teller');
      tellerSign.position.set(tellerX, 92, npcZ);
      scene.add(tellerSign);
      kiosksOut.push({ id: 'bank_teller', x: tellerX, z: kioskZ, npc: 'teller' });

      const courier = createHumanoid(4).group; // "Wanderer" preset — distinct from teller/auctioneer
      courier.position.set(courierX, 0, npcZ);
      courier.rotation.y = Math.PI;
      scene.add(courier);
      const courierSign = makeSignSprite('💸 Wire Clerk');
      courierSign.position.set(courierX, 92, npcZ);
      scene.add(courierSign);
      kiosksOut.push({ id: 'bank_courier', x: courierX, z: kioskZ, npc: 'courier' });

      const auctioneer = createHumanoid(2).group; // "Mystic" — visually distinct from the teller
      auctioneer.position.set(auctioneerX, 0, npcZ);
      auctioneer.rotation.y = Math.PI;
      scene.add(auctioneer);
      const auctioneerSign = makeSignSprite('🔨 Auctioneer');
      auctioneerSign.position.set(auctioneerX, 92, npcZ);
      scene.add(auctioneerSign);
      kiosksOut.push({ id: 'bank_auctioneer', x: auctioneerX, z: kioskZ, npc: 'auctioneer' });

      // Framed paintings on the east wall, between the entrance and the
      // service counters.
      [
        { symbol: '💰', title: 'THE FIRST DEPOSIT', subtitle: 'do not ask whose' },
        { symbol: '🐦‍⬛', title: 'THE AUDITOR', subtitle: 'sees every ledger' }
      ].forEach(({ symbol, title, subtitle }, i) => {
        const p = makeWallPainting({ symbol, title, subtitle, bg1: '#2a2418', bg2: '#3a3220', border: '#d4af37', accent: '#e8d9a0' });
        p.position.set(roomW - 4, 90, roomD * (i === 0 ? 0.32 : 0.46));
        p.rotation.y = -Math.PI / 2;
        scene.add(p);
      });

      // The bank's "shop" is already the teller/auctioneer above — this one
      // just gives quest hints, same as every other building's hint-NPC.
      const guard = createHumanoid(1).group;
      guard.position.set(150, 0, 150);
      guard.rotation.y = Math.atan2(cx - 150, roomD * 0.38 - 150);
      scene.add(guard);
      const guardLabel = makeNpcNameSprite('Guard Petra', 'Keeps Watch');
      guardLabel.position.set(150, 90, 150);
      scene.add(guardLabel);
      kiosksOut.push({ x: 150, z: 150, npc: 'hint', npcId: 'npc_guard', npcName: 'Guard Petra' });
    }
  }
}

  return { buildFurniture, makeBarrel, buildTorch };
}
