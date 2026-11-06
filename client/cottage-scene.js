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
let builtScene = null;
let wardGroup = null;
let pendingWards = null;
function buildCottageScene() {
  const scene = new THREE.Scene();
  builtScene = scene;
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

  if (pendingWards) setWards(pendingWards);
  return scene;
}

// ── Threshold & Hearth (blueprint B) — the house's wards, made visible ───────
// The daisy wheel is cut into the inner face of the door lintel; a buried witch
// bottle shows as a sealed hearthstone at the north wall (cracked once spent).
// The concealed shoe is, as it should be, not shown at all. A witch's ladder
// hangs from the rafters in the north-east corner.
function setWards(w) {
  pendingWards = w || null;
  if (!builtScene) return;
  if (wardGroup) { builtScene.remove(wardGroup); wardGroup.traverse((o) => { if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } if (o.geometry) o.geometry.dispose(); }); wardGroup = null; }
  if (!w) return;
  const W = COTTAGE_WORLD.width, D = COTTAGE_WORLD.height, WALL_H = 150;
  wardGroup = new THREE.Group();
  wardGroup.name = 'cottageWards';
  if (w.hexafoil) {
    const mat = new THREE.MeshBasicMaterial({ map: makeHexafoilTexture(), transparent: true, depthWrite: false });
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), mat);
    mark.name = 'hexafoil';
    mark.rotation.y = Math.PI;                            // faces into the room (−z)
    mark.position.set(W / 2, WALL_H - WALL_H * 0.13, D - 7.4); // the lintel's inner face
    wardGroup.add(mark);
  }
  if (w.bottle && w.bottle !== 'none') {
    const mat = new THREE.MeshLambertMaterial({ map: makeHearthstoneTexture(w.bottle === 'spent'), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const stone = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), mat);
    stone.name = 'hearthstone';
    stone.rotation.x = -Math.PI / 2;
    stone.position.set(W / 2, 0.6, 46);                   // before the north wall, where the hearth sits
    wardGroup.add(stone);
  }
  if (w.ladder) {
    // The witch's ladder: a cord hung from the rafters in the north-east corner,
    // a cock's feather worked in at every knot (after the Wellington ladder).
    const ladder = new THREE.Group();
    ladder.name = 'witchLadder';
    const top = WALL_H - 6, len = 92;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, len, 5), new THREE.MeshLambertMaterial({ color: 0x8a7350 }));
    cord.position.y = top - len / 2; ladder.add(cord);
    const featherCols = [0x2b2622, 0x8a4a22, 0xd8d0c0, 0x3a3a3a, 0xb06a2a];
    for (let i = 0; i < 9; i++) {
      const y = top - 8 - i * 9.5, side = i % 2 ? 1 : -1;
      const knot = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 5), new THREE.MeshLambertMaterial({ color: 0x6e5a3e }));
      knot.position.y = y; ladder.add(knot);
      const f = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), new THREE.MeshLambertMaterial({ color: featherCols[i % featherCols.length] }));
      f.scale.set(2.2, 6.5, 0.5); f.position.set(side * 5.5, y - 3, 0); f.rotation.z = side * 0.7; ladder.add(f);
    }
    ladder.position.set(W - 46, 0, 46);
    wardGroup.add(ladder);
  }
  builtScene.add(wardGroup);
}
function makeHexafoilTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const cx = S / 2, cy = S / 2, r = S * 0.4;
  g.strokeStyle = 'rgba(240,222,190,0.9)'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  // Six arcs of the same radius, each centred on the circle — the real construction.
  for (let k = 0; k < 6; k++) {
    const t = k * Math.PI / 3, px = cx + r * Math.cos(t), py = cy + r * Math.sin(t);
    g.beginPath(); g.arc(px, py, r, t + Math.PI * 2 / 3, t + Math.PI * 4 / 3); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}
function makeHearthstoneTexture(cracked) {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4038'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#2a221c'; g.lineWidth = 6; g.strokeRect(3, 3, S - 6, S - 6);
  g.strokeStyle = 'rgba(255,190,110,0.55)'; g.lineWidth = 3;
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.22, 0, Math.PI * 2); g.stroke();   // the bottle's mark
  if (cracked) {
    g.strokeStyle = '#140e0a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(S * 0.2, S * 0.15); g.lineTo(S * 0.48, S * 0.5); g.lineTo(S * 0.42, S * 0.7); g.lineTo(S * 0.8, S * 0.9); g.stroke();
  }
  return new THREE.CanvasTexture(c);
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

  return { buildCottageScene, setWards };
}
