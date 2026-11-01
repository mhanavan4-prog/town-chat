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

  // ── Floor: warm wood planks + darker seams so it doesn't read as one sheet ──
  const plankMat = new THREE.MeshLambertMaterial({ color: 0x4a3420 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), plankMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0, D / 2);
  scene.add(floor);
  const seamMat = new THREE.MeshBasicMaterial({ color: 0x33230f });
  for (let z = 60; z < D; z += 60) {
    const seam = new THREE.Mesh(new THREE.PlaneGeometry(W, 2), seamMat);
    seam.rotation.x = -Math.PI / 2;
    seam.position.set(W / 2, 0.5, z);
    scene.add(seam);
  }

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

  // ── The hearth: a stone fireplace on the north wall with a flickering fire.
  // Always present (it's the heart of the cottage) regardless of what furniture
  // the player places. The point-light above sits at its mouth. ──
  try {
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x5a5048 });
    const stoneDark = new THREE.MeshLambertMaterial({ color: 0x3d352d });
    const mantleW = 200, mantleH = 120;
    g.add(mesh(new THREE.BoxGeometry(mantleW, mantleH, 40), stoneMat, 0, mantleH / 2, 0));           // surround
    g.add(mesh(new THREE.BoxGeometry(mantleW - 56, 74, 30), stoneDark, 0, 42, 8));                    // firebox recess
    g.add(mesh(new THREE.BoxGeometry(mantleW + 24, 18, 50), stoneMat, 0, mantleH + 2, 2));            // mantle shelf
    // the fire: stacked emissive cones that breathe
    const fire = new THREE.Group();
    for (const [fx, s, col] of [[-20, 1, 0xff7a24], [16, 0.9, 0xffa23a], [0, 1.3, 0xffd257]]) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(12 * s, 44 * s, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
      fl.position.set(fx, 26 * s, 10); fire.add(fl);
    }
    fire.position.set(0, 6, 0);
    fire.onBeforeRender = () => { const t = performance.now() * 0.006; fire.scale.y = 0.9 + Math.sin(t) * 0.12; fire.children.forEach((c, i) => { c.material.opacity = 0.72 + Math.sin(t + i * 1.7) * 0.22; }); };
    g.add(fire);
    g.position.set(W / 2, 0, 20);
    scene.add(g);
  } catch (e) { /* the hearth is decorative — a bare north wall is fine if it throws */ }

  function mesh(geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }

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

  return { buildCottageScene };
}
