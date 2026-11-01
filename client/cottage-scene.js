// Player housing (slice 2) — the cottage interior. A warm, cozy, timber-framed
// one-room cottage that every account can step into (instanced per account) and
// furnish with the pieces they place in the Home grid editor (slice 1). This
// module builds only the SHELL — floor, walls, hearth glow, beams, the exit
// door sign; the furniture itself is placed onto the scene by main.js
// (renderCottageFurniture), which owns the KayKit loader + the catalog→prop map.
//
// Mirrors manor-scene.js in shape: COTTAGE_WORLD + spawn are injected, THREE is
// global, and the built scene/camera are handed back via setters so a build
// that throws mid-way still leaves a usable (if bare) room.

export default function createCottageScene({ makeSignSprite, COTTAGE_WORLD, setCottageScene, setCottageCamera }) {
function buildCottageScene() {
  const scene = new THREE.Scene();
  // A warm hearth-lit gloom — deep brown rather than the manor's cold violet.
  scene.background = new THREE.Color(0x1c130b);
  scene.fog = new THREE.FogExp2(0x1c130b, 0.0012);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 2000);
  setCottageScene(scene);
  setCottageCamera(camera);

  const W = COTTAGE_WORLD.width, D = COTTAGE_WORLD.height, WALL_H = 150;

  // ── Light: a warm amber wash. Hemisphere gives a cheap firelit bounce (amber
  // sky, deeper ground), ambient lifts it to readable, and a hearth-side point
  // light throws the cozy glow that makes a cottage feel lived-in. ──
  scene.add(new THREE.HemisphereLight(0x6b4a24, 0x241608, 1.05));
  scene.add(new THREE.AmbientLight(0x6a4e2e, 0.78));
  const hearth = new THREE.PointLight(0xffb060, 2.2, 1100, 1.6);
  hearth.position.set(W / 2, WALL_H * 0.5, 70);   // the north wall, where the hearth usually sits
  scene.add(hearth);
  const warm = new THREE.PointLight(0xffd79a, 1.2, 760, 1.7);
  warm.position.set(W / 2, 130, D / 2);
  scene.add(warm);

  // ── Floor: warm wood planks. The plank seams are BAKED into one texture on a
  // single plane, not separate strips just above the floor — those coplanar
  // strips z-fought the floor at grazing angles and showed as "zebra" banding. ──
  const floorMat = new THREE.MeshLambertMaterial({ map: makeCottageFloorTexture() });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0, D / 2);
  scene.add(floor);

  // ── Plaster + timber walls: four sides, the south wall split for the door ──
  const plasterMat = new THREE.MeshLambertMaterial({ color: 0x6b513a });
  const DOOR_W = 140;
  const seg = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || plasterMat); m.position.set(x, y, z); scene.add(m); };
  seg(W, WALL_H, 14, W / 2, WALL_H / 2, 0);                                   // north
  seg(14, WALL_H, D, 0, WALL_H / 2, D / 2);                                   // west
  seg(14, WALL_H, D, W, WALL_H / 2, D / 2);                                   // east
  const sideW = (W - DOOR_W) / 2;                                            // south, flanking the door
  seg(sideW, WALL_H, 14, sideW / 2, WALL_H / 2, D);
  seg(sideW, WALL_H, 14, W - sideW / 2, WALL_H / 2, D);
  seg(DOOR_W, WALL_H * 0.26, 14, W / 2, WALL_H - WALL_H * 0.13, D);           // lintel over the door

  // Exposed corner timbers — a few dark posts so the walls read as a cottage,
  // not a box. (Decorative; the walls above carry collision via room bounds.)
  const timberMat = new THREE.MeshLambertMaterial({ color: 0x3a2814 });
  for (const [tx, tz] of [[16, 16], [W - 16, 16], [16, D - 16], [W - 16, D - 16]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(18, WALL_H, 18), timberMat);
    post.position.set(tx, WALL_H / 2, tz); scene.add(post);
  }

  // ── Ceiling + a few beams ──
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ color: 0x2a1c10 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(W / 2, WALL_H, D / 2);
  scene.add(ceil);
  for (let x = 120; x < W; x += 150) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(16, 14, D - 28), timberMat);
    beam.position.set(x, WALL_H - 9, D / 2);
    scene.add(beam);
  }

  // (No built-in fireplace — the player places their own Stone Hearth from the
  // Home catalog, so a fixed one here would just double up. The warm north-wall
  // point-light above stays, so an unfurnished cottage still feels lit.)

  // ── Two little windows on the side walls — warm dusk light, for charm ──
  const paneMat = new THREE.MeshBasicMaterial({ color: 0x6a4a9a, transparent: true, opacity: 0.55 });
  for (const [wx, wz] of [[8, D * 0.4], [W - 8, D * 0.4]]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(80, 90), paneMat);
    pane.rotation.y = Math.PI / 2;
    pane.position.set(wx, WALL_H * 0.5, wz);
    scene.add(pane);
  }

  // ── Door marker so the way out is unmistakable ──
  const sign = makeSignSprite('🚪 Leave Your Cottage — Press F');
  sign.position.set(W / 2, 128, D - 18);
  scene.add(sign);

  return scene;
}

// A warm plank-floor texture — base wood with darker seam lines and a touch of
// grain baked in, so the floor reads as boards without any coplanar geometry.
// Tiled across the floor; mipmapped, so the seams never shimmer at distance.
function makeCottageFloorTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#4a3420'; x.fillRect(0, 0, 128, 128);
  // faint grain
  for (let i = 0; i < 48; i++) {
    x.strokeStyle = `rgba(${90 + Math.random() * 30 | 0},${64 + Math.random() * 24 | 0},36,0.14)`;
    x.lineWidth = 1; x.beginPath();
    const yy = Math.random() * 128; x.moveTo(0, yy); x.lineTo(128, yy + (Math.random() * 6 - 3)); x.stroke();
  }
  // plank seams — two darker lines per tile
  x.strokeStyle = '#33230f'; x.lineWidth = 2;
  for (const yy of [0, 64]) { x.beginPath(); x.moveTo(0, yy + 1); x.lineTo(128, yy + 1); x.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5); // ~ a plank every ~114u across the 1140 floor
  return tex;
}

  return { buildCottageScene };
}
