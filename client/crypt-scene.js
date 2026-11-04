// ---------------------------------------------------------------------------
// The Crypt interior (shared instanced tomb). Every tomb out in the Wilds opens
// into this one small candlelit stone room: a raised sarcophagus at the centre,
// bone-strewn niches, dripping cobwebs and a lit exit threshold. THREE is a
// global; KayKit placement (kkPlace) and the sign/world helpers are injected;
// the built scene/camera are handed back via setters. Mirrors the cave/vault
// module shape so the swap plumbing in main.js treats it the same way.
// ---------------------------------------------------------------------------
export default function createCryptScene({ kkPlace, makeSignSprite, CRYPT_WORLD, setCryptScene, setCryptCamera }) {
function buildCryptScene() {
  const W = CRYPT_WORLD.width, D = CRYPT_WORLD.height;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0710);
  scene.fog = new THREE.Fog(0x0a0710, 320, 820);
  // Wide FOV (72) so the player's own character stays small in this tight
  // stone room — the walls cap how far the follow-cam can pull back, so the
  // lens does the de-cramping instead of camera distance.
  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 1, 1400);
  // Assign early so swapToCryptMap works even if geometry building throws below.
  setCryptScene(scene);
  setCryptCamera(camera);

  // Low, cold ambient + a dim warm fill — a crypt should read dark, lit mostly
  // by its candles (the point lights below).
  scene.add(new THREE.AmbientLight(0x6a5a7a, 1.15));
  const fill = new THREE.DirectionalLight(0xb0a0c0, 0.5);
  fill.position.set(W / 2, 320, 180);
  scene.add(fill);

  // Flagstone floor.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 80, D + 80),
    new THREE.MeshLambertMaterial({ color: 0x241d2c }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0, D / 2);
  scene.add(floor);

  // Stone shell — four walls + a ceiling, pushed out so the indoor camera never
  // clips them (same trick the cave uses).
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x322838 });
  for (const [wx, wy, wz, ww, wh, wd] of [
    [W / 2, 70, -24,     W + 120, 260, 44],   // north
    [W / 2, 70, D + 60,  W + 120, 260, 44],   // south (pushed back past the exit)
    [-24, 70, D / 2,     44, 260, D + 120],    // west
    [W + 24, 70, D / 2,  44, 260, D + 120],    // east
    [W / 2, 260, D / 2,  W + 160, 44, D + 160],// ceiling
  ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, wd), wallMat);
    m.position.set(wx, wy, wz);
    scene.add(m);
  }

  // Candlelight — warm point lights at the niches + flanking the sarcophagus, so
  // the room is lit by its own candles. The KayKit candle props sit under them.
  const candleSpots = [[90, 110], [W - 90, 110], [90, D - 150], [W - 90, D - 150], [W / 2 - 70, D / 2], [W / 2 + 70, D / 2]];
  for (const [cx, cz] of candleSpots) {
    const light = new THREE.PointLight(0xffb060, 1.5, 340);
    light.position.set(cx, 70, cz);
    scene.add(light);
  }

  // ── KayKit dressing (streams in post-spawn; kkPlace no-ops until it does) ──
  // The sarcophagus: a coffin raised on a low stone plinth at the centre. This is
  // the room's focal point (and where the Phase-2 guardian/reward will live).
  const sarX = W / 2, sarZ = D / 2 - 30;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(150, 26, 90),
    new THREE.MeshLambertMaterial({ color: 0x2a2230 }));
  plinth.position.set(sarX, 13, sarZ);
  scene.add(plinth);
  const coffin = kkPlace(scene, 'prop_coffin', sarX, sarZ, 112, Math.PI / 2);
  if (coffin) coffin.position.y = 26;

  // Candles flanking the sarcophagus + at the four niches.
  kkPlace(scene, 'prop_candle3', sarX - 78, sarZ, 18, 0.2);
  kkPlace(scene, 'prop_candle_skull', sarX + 78, sarZ, 18, -0.3);
  for (const [cx, cz, r] of [[90, 110, 0.3], [W - 90, 110, -0.4], [90, D - 150, 0.6], [W - 90, D - 150, -0.5]]) {
    kkPlace(scene, (cx + cz) % 2 ? 'prop_candle_skull' : 'prop_candle3', cx, cz, 16, r);
  }

  // Bones and skulls strewn in the corners and along the walls.
  kkPlace(scene, 'prop_ribcage', 120, D - 90, 24, 0.5);
  kkPlace(scene, 'prop_bone_c', 70, 220, 18, 1.1);
  kkPlace(scene, 'prop_bone_a', W - 80, 240, 15, -0.6);
  kkPlace(scene, 'prop_skull', W - 120, D - 100, 13, 0.4);
  kkPlace(scene, 'prop_skull', 150, 90, 12, -0.2);
  // A couple of standing gravemarkers against the back wall, like interred names.
  kkPlace(scene, 'prop_gravemark_a', W / 2 - 130, 60, 22, 0);
  kkPlace(scene, 'prop_gravemark_b', W / 2 + 130, 60, 22, 0);

  // Cobwebs dripping from the upper corners.
  const wa = kkPlace(scene, 'prop_web_c', 40, 40, 44, Math.PI * 0.25); if (wa) wa.position.y = 150;
  const wb = kkPlace(scene, 'prop_web_c', W - 40, 40, 44, Math.PI * 0.75); if (wb) wb.position.y = 150;
  kkPlace(scene, 'prop_web_d', 60, D - 120, 28, 0.4);

  // ── Exit threshold — a glowing doorway back out to the Wilds, at the spawn
  // (south) end. The F-kiosk is registered in main.js (CRYPT_KIOSKS).
  const doorZ = D - 40, doorX = W / 2;
  const archMat = new THREE.MeshLambertMaterial({ color: 0x1a1420 });
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(120, 18, 30), archMat);
  lintel.position.set(doorX, 150, doorZ); scene.add(lintel);
  for (const sx of [-54, 54]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(18, 150, 30), archMat);
    post.position.set(doorX + sx, 75, doorZ); scene.add(post);
  }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(96, 140),
    new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  glow.position.set(doorX, 72, doorZ - 2); scene.add(glow);
  glow.onBeforeRender = () => { glow.material.opacity = 0.16 + Math.sin(performance.now() * 0.0022) * 0.08; };
  const sign = makeSignSprite('← Leave the crypt — Press F');
  sign.position.set(doorX, 176, doorZ);
  scene.add(sign);
}
return { buildCryptScene };
}
