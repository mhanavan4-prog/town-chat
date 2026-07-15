// ---------------------------------------------------------------------------
// Interior scene builder (Tier 3.4 Phase C). getInteriorScene lazily builds a
// building's interior the first time it's entered — floor/walls/doorway sized
// from INTERIOR_THEMES + per-building overrides, then buildFurniture dresses it —
// and caches the result in the shared interiorScenes map. The furniture builders,
// the doorway/wall/door helpers, the theme + size tables, and the stone texture
// are injected; the current world (for defaults) via getter. The exterior mesh
// and KayKit alignment code stay in main.
// ---------------------------------------------------------------------------
export default function createInteriorScene({ INDOOR_SCALE, INDOOR_WALL_HEIGHT, INTERIOR_SIZE_OVERRIDES, INTERIOR_THEMES, buildFurniture, buildInteriorDoorway, buildTorch, buildWallsForOne, getDoorSide, interiorScenes, makeStoneTexture, getWorld }) {
function getInteriorScene(buildingId) {
  if (interiorScenes[buildingId]) return interiorScenes[buildingId];

  const b = getWorld().buildings.find(bb => bb.id === buildingId);
  const side = getDoorSide(b);
  const override = INTERIOR_SIZE_OVERRIDES[buildingId];
  const localW = override ? override.w : b.w;
  const localH = override ? override.h : b.h;
  const wallsLocal = buildWallsForOne({ x: 0, y: 0, w: localW, h: localH, door: side }, getWorld());
  const roomW = localW * INDOOR_SCALE, roomD = localH * INDOOR_SCALE;
  const dw = getWorld().doorWidth * INDOOR_SCALE;
  // South/north doors run along the room's width; east/west doors run along
  // its depth — match whichever axis that wall actually spans.
  let doorStart, doorEnd;
  if (side === 'east' || side === 'west') {
    doorStart = (roomD - dw) / 2; doorEnd = doorStart + dw;
  } else {
    doorStart = (roomW - dw) / 2; doorEnd = doorStart + dw;
  }
  const theme = INTERIOR_THEMES[buildingId] || INTERIOR_THEMES.cafe;

  // The door is now closed/flush rather than standing ajar (see
  // buildInteriorDoorway), so the gap buildWallsForOne leaves for it needs
  // a real collider too, or players would just walk straight through a
  // door that visually looks shut. isDoorCollider marks it so the wall
  // mesh loop below skips drawing a plain box on top of the nicer door
  // mesh — actually crossing it only happens via the exitDoor kiosk
  // pushed below (F key), same pattern as every other portal/NPC in the
  // game; collidesIndoor() doesn't care that it's tagged, so ordinary
  // movement is blocked here exactly like a real closed door.
  const wt = getWorld().wallThickness;
  const localDoorStart = doorStart / INDOOR_SCALE, localDoorEnd = doorEnd / INDOOR_SCALE;
  let doorCollider;
  if (side === 'east') doorCollider = { x: localW - wt, y: localDoorStart, w: wt, h: localDoorEnd - localDoorStart, isDoorCollider: true };
  else if (side === 'west') doorCollider = { x: 0, y: localDoorStart, w: wt, h: localDoorEnd - localDoorStart, isDoorCollider: true };
  else if (side === 'north') doorCollider = { x: localDoorStart, y: 0, w: localDoorEnd - localDoorStart, h: wt, isDoorCollider: true };
  else doorCollider = { x: localDoorStart, y: localH - wt, w: localDoorEnd - localDoorStart, h: wt, isDoorCollider: true }; // south
  wallsLocal.push(doorCollider);

  const scene = new THREE.Scene();
  // Background/fog and lighting are theme-overridable so one room can go
  // full Witch-Hazel (the Arcade's cold starlight) while every other
  // interior keeps the warm torchlit defaults.
  const bgCol = theme.bg != null ? theme.bg : 0x1c1410;
  scene.background = new THREE.Color(bgCol);
  scene.fog = new THREE.Fog(bgCol, 380, 900);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 3000);

  scene.add(new THREE.AmbientLight(
    theme.ambient != null ? theme.ambient : 0xffd9a0,
    theme.ambientIntensity != null ? theme.ambientIntensity : 0.5
  ));
  if (theme.lightsStyle === 'crystal') {
    // The Witch's Cave trick: cold point lights rising from emissive
    // crystal clusters instead of fire, plus a soft directional fill so
    // players don't read as silhouettes against the dark stone.
    const fill = new THREE.DirectionalLight(theme.fill != null ? theme.fill : 0x8fb8ff, 0.8);
    fill.position.set(roomW * 0.6, 260, roomD * 0.7);
    scene.add(fill);
    const crystalMat = new THREE.MeshLambertMaterial({
      color: theme.crystalColor != null ? theme.crystalColor : 0x9fd4ff,
      emissive: theme.crystalEmissive != null ? theme.crystalEmissive : 0x1d5ecc,
      emissiveIntensity: 0.9
    });
    const spots = [
      [34, 34], [roomW - 34, 34], [34, roomD - 34], [roomW - 34, roomD - 34],
      [roomW / 2, 40]
    ];
    for (const [sx, sz] of spots) {
      const light = new THREE.PointLight(theme.lightColor != null ? theme.lightColor : 0x3d8bff, 1.5, 380);
      light.position.set(sx, 85, sz);
      scene.add(light);
      const cluster = new THREE.Group();
      for (const [ox, oz, r, h] of [[0, 0, 7, 16], [9, 4, 4.5, 9], [-7, 6, 3.5, 7]]) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), crystalMat);
        shard.scale.y = h / (r * 2);
        shard.position.set(ox, h, oz);
        cluster.add(shard);
      }
      cluster.position.set(sx, 0, sz);
      scene.add(cluster);
    }
  } else if (theme.lightsStyle === 'wisp') {
    // Spirit-wisp lighting (the Phantom Parlor): no fixtures at all — just
    // hovering glow-orbs with a soft halo, each carrying its own cold
    // light. Heights vary so they read as drifting, not mounted.
    const fill = new THREE.DirectionalLight(theme.fill != null ? theme.fill : 0x9fffd0, 0.7);
    fill.position.set(roomW * 0.5, 260, roomD * 0.7);
    scene.add(fill);
    const wCol = theme.wispColor != null ? theme.wispColor : 0x8fffbe;
    const lCol = theme.lightColor != null ? theme.lightColor : 0x3fd98a;
    const spots = [
      [roomW * 0.12, roomD * 0.2], [roomW * 0.3, roomD * 0.78], [roomW * 0.52, roomD * 0.25],
      [roomW * 0.7, roomD * 0.7], [roomW * 0.88, roomD * 0.3]
    ];
    spots.forEach(([sx, sz], i) => {
      const light = new THREE.PointLight(lCol, 1.4, 400);
      light.position.set(sx, 96, sz);
      scene.add(light);
      const wispY = 92 + (i % 3) * 9;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(5 + (i % 3), 10, 10), new THREE.MeshBasicMaterial({ color: wCol, transparent: true, opacity: 0.85 }));
      orb.position.set(sx, wispY, sz);
      scene.add(orb);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(9 + (i % 3) * 1.5, 10, 10), new THREE.MeshBasicMaterial({ color: wCol, transparent: true, opacity: 0.16 }));
      halo.position.set(sx, wispY, sz);
      scene.add(halo);
    });
  } else if (theme.lightsStyle === 'lantern') {
    // Hanging witch-lanterns (the Cauldron Café): amber glass orbs in iron
    // fittings, chained down from the beams, each carrying a warm light.
    const fill = new THREE.DirectionalLight(theme.fill != null ? theme.fill : 0xffc890, 0.65);
    fill.position.set(roomW * 0.55, 260, roomD * 0.6);
    scene.add(fill);
    const ironMat = new THREE.MeshLambertMaterial({ color: 0x1a120a });
    const spots = [
      [roomW * 0.2, roomD * 0.28], [roomW * 0.5, roomD * 0.22], [roomW * 0.8, roomD * 0.3],
      [roomW * 0.32, roomD * 0.72], [roomW * 0.68, roomD * 0.7]
    ];
    spots.forEach(([sx, sz], i) => {
      const light = new THREE.PointLight(theme.lightColor != null ? theme.lightColor : 0xff9a3c, 1.25, 380);
      light.position.set(sx, 100, sz);
      scene.add(light);
      const hangY = 104 + (i % 2) * 6;
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, Math.max(6, INDOOR_WALL_HEIGHT - hangY - 6), 4), ironMat);
      chain.position.set(sx, (INDOOR_WALL_HEIGHT + hangY) / 2, sz);
      scene.add(chain);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 3, 6), ironMat);
      cap.position.set(sx, hangY + 9, sz);
      scene.add(cap);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffb96a, transparent: true, opacity: 0.95 }));
      orb.position.set(sx, hangY, sz);
      scene.add(orb);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(9.5, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.18 }));
      halo.position.set(sx, hangY, sz);
      scene.add(halo);
    });
  } else if (theme.lightsStyle === 'candle') {
    // Floating candles (the Midnight Archive): little wax clusters hovering
    // in mid-air, warm flames against the cool violet room.
    const fill = new THREE.DirectionalLight(theme.fill != null ? theme.fill : 0xd0c4ff, 0.75);
    fill.position.set(roomW * 0.5, 260, roomD * 0.65);
    scene.add(fill);
    const waxMat = new THREE.MeshLambertMaterial({ color: 0xf0e8d8 });
    const spots = [
      [roomW * 0.18, roomD * 0.25], [roomW * 0.5, roomD * 0.18], [roomW * 0.82, roomD * 0.3],
      [roomW * 0.3, roomD * 0.75], [roomW * 0.72, roomD * 0.72]
    ];
    spots.forEach(([sx, sz], i) => {
      const light = new THREE.PointLight(theme.lightColor != null ? theme.lightColor : 0xffd9a0, 1.15, 360);
      light.position.set(sx, 108, sz);
      scene.add(light);
      const baseY = 96 + (i % 3) * 8;
      for (const [ox, oz, h] of [[0, 0, 14], [7, 4, 9], [-6, 5, 7]]) {
        const candle = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.3, h, 6), waxMat);
        candle.position.set(sx + ox, baseY + h / 2, sz + oz);
        scene.add(candle);
        const flame = new THREE.Mesh(new THREE.SphereGeometry(1.7, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
        flame.scale.y = 1.7;
        flame.position.set(sx + ox, baseY + h + 2.5, sz + oz);
        scene.add(flame);
      }
    });
  } else if (theme.lightsStyle === 'brazier') {
    // Standing ritual braziers (the Coven Court): iron bowls on tripod
    // legs, burning low and red.
    const fill = new THREE.DirectionalLight(theme.fill != null ? theme.fill : 0xffb9a0, 0.6);
    fill.position.set(roomW * 0.5, 260, roomD * 0.7);
    scene.add(fill);
    const ironMat = new THREE.MeshLambertMaterial({ color: 0x16100c });
    const spots = [
      [40, 44], [roomW - 40, 44], [40, roomD - 60], [roomW - 40, roomD - 60], [roomW / 2, roomD * 0.62]
    ];
    for (const [sx, sz] of spots) {
      const light = new THREE.PointLight(theme.lightColor != null ? theme.lightColor : 0xff6a3c, 1.3, 380);
      light.position.set(sx, 60, sz);
      scene.add(light);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(11, 6, 9, 8), ironMat);
      bowl.position.set(sx, 34, sz);
      scene.add(bowl);
      for (let k = 0; k < 3; k++) {
        const a = k * Math.PI * 2 / 3;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 34, 4), ironMat);
        leg.position.set(sx + Math.cos(a) * 7, 17, sz + Math.sin(a) * 7);
        leg.rotation.z = Math.cos(a) * 0.22;
        leg.rotation.x = -Math.sin(a) * 0.22;
        scene.add(leg);
      }
      const flame = new THREE.Mesh(new THREE.ConeGeometry(7, 16, 6),
        new THREE.MeshBasicMaterial({ color: 0xff8a4a, transparent: true, opacity: 0.9 }));
      flame.position.set(sx, 46, sz);
      scene.add(flame);
      const flameCore = new THREE.Mesh(new THREE.ConeGeometry(3.5, 9, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      flameCore.position.set(sx, 44, sz);
      scene.add(flameCore);
    }
  } else if (theme.lightsStyle === 'vaultlamp') {
    // Gilded candelabra stands (the Gilded Vault): tall golden poles, three
    // pale-green flames apiece — counting-house light for cursed coin.
    const fill = new THREE.DirectionalLight(theme.fill != null ? theme.fill : 0xffe9a0, 0.65);
    fill.position.set(roomW * 0.5, 260, roomD * 0.55);
    scene.add(fill);
    const goldMatL = new THREE.MeshLambertMaterial({ color: 0xb8912a, emissive: 0x3a2c08, emissiveIntensity: 0.35 });
    const spots = [
      [44, roomD * 0.14], [roomW - 44, roomD * 0.14], [44, roomD * 0.5], [roomW - 44, roomD * 0.5], [roomW / 2, roomD * 0.32]
    ];
    for (const [sx, sz] of spots) {
      const light = new THREE.PointLight(theme.lightColor != null ? theme.lightColor : 0xffc84a, 1.25, 380);
      light.position.set(sx, 78, sz);
      scene.add(light);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 64, 6), goldMatL);
      pole.position.set(sx, 32, sz);
      scene.add(pole);
      const arms = new THREE.Mesh(new THREE.BoxGeometry(26, 2.2, 2.2), goldMatL);
      arms.position.set(sx, 62, sz);
      scene.add(arms);
      for (const [ox, oy] of [[-12, 0], [0, 3], [12, 0]]) {
        const candle = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 8, 6),
          new THREE.MeshLambertMaterial({ color: 0xf0e8d8 }));
        candle.position.set(sx + ox, 66 + oy, sz);
        scene.add(candle);
        const flame = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xd8ffa0 }));
        flame.scale.y = 1.8;
        flame.position.set(sx + ox, 72 + oy, sz);
        scene.add(flame);
      }
    }
  } else {
    const torch1 = new THREE.PointLight(0xffa85c, 1.2, 340);
    torch1.position.set(30, 70, 30);
    scene.add(torch1);
    const torch2 = new THREE.PointLight(0xffa85c, 1.2, 340);
    torch2.position.set(roomW - 30, 70, roomD - 30);
    scene.add(torch2);
  }

  // stone floor, tinted per theme so each building's interior reads as its
  // own space rather than the same room repainted
  const floorTex = makeStoneTexture();
  floorTex.repeat.set(roomW / 60, roomD / 60);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW, roomD),
    new THREE.MeshLambertMaterial({ map: floorTex, color: theme.floorTint || 0xffffff })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, roomD / 2);
  scene.add(floor);

  // walls, scaled from the same local wall rects used for collision — skip
  // the door's own collider here, it's rendered as an actual door instead
  // (buildInteriorDoorway below), not a plain box.
  const wallMat = new THREE.MeshLambertMaterial({ color: theme.wall });
  for (const r of wallsLocal) {
    if (r.w <= 0 || r.h <= 0 || r.isDoorCollider) continue;
    const geo = new THREE.BoxGeometry(r.w * INDOOR_SCALE, INDOOR_WALL_HEIGHT, r.h * INDOOR_SCALE);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set((r.x + r.w / 2) * INDOOR_SCALE, INDOOR_WALL_HEIGHT / 2, (r.y + r.h / 2) * INDOOR_SCALE);
    scene.add(mesh);
  }

  // exposed ceiling beams — dark wood by default, cold blue stone when the
  // theme overrides it (the arcade)
  const beamMat = new THREE.MeshLambertMaterial({ color: theme.beamColor != null ? theme.beamColor : 0x3c2a1a });
  for (let i = 1; i <= 3; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(roomW - 10, 8, 10), beamMat);
    beam.position.set(roomW / 2, INDOOR_WALL_HEIGHT - 12, (roomD / 4) * i);
    scene.add(beam);
  }

  // torches near the point lights (crystal- and wisp-lit rooms already got
  // their own glowing fixtures at every light spot — fire would clash)
  if (!theme.lightsStyle) {
    scene.add(buildTorch(30, 30));
    scene.add(buildTorch(roomW - 30, roomD - 30));
  }

  // a real doorway at the gap — wooden frame around the opening, an EXIT
  // sign, and a single closed panel flush with the wall (see
  // buildInteriorDoorway) instead of an empty gap or a swung-open panel.
  scene.add(buildInteriorDoorway(side, doorStart, doorEnd, roomW, roomD, theme));

  const seats = [];
  const kiosks = [];
  buildFurniture(scene, theme.furniture, roomW, roomD, seats, kiosks);
  // The door itself is an interact point too — same proximity+F pattern as
  // every portal/NPC in the game (see findNearestKiosk/tryInteract), rather
  // than the old purely-positional "walk into the gap" exit.
  const doorWallCoord = side === 'north' ? 0 : side === 'south' ? roomD : side === 'west' ? 0 : roomW;
  const doorMidScaled = (doorStart + doorEnd) / 2;
  kiosks.push({
    x: (side === 'north' || side === 'south') ? doorMidScaled : doorWallCoord,
    z: (side === 'north' || side === 'south') ? doorWallCoord : doorMidScaled,
    exitDoor: true,
    radius: 90
  });

  const record = { scene, camera, roomW, roomD, doorStart, doorEnd, wallsLocal, localW, localH, seats, kiosks };
  interiorScenes[buildingId] = record;
  return record;
}

  return { getInteriorScene };
}
