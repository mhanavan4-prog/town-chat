// ---------------------------------------------------------------------------
// The Coven Manor interior (Session N). A grand candlelit hall standing in a
// coven's PRIVATE world, reached from the Wilds via the Manor's door once a
// player has stepped through the Moot Stone (server gates enter_manor on being
// inside your own coven instance — see server.js). Eight four-poster bed-
// chambers line the walls; each coven member may claim one (manor_claim_bedroom).
//
// Same module shape as cave/vault scenes: THREE is a global; prop-helpers,
// MANOR_WORLD and the authoritative MANOR_BED_SPOTS layout are injected; the
// built scene/camera are handed back through setters. Bed positions come from
// main (not invented here) so the claim kiosks and the rendered beds can never
// drift apart. Returns buildManorScene.
// ---------------------------------------------------------------------------
export default function createManorScene({ makeStoneTexture, makeSignSprite, makeSigilFloorTexture, MANOR_WORLD, MANOR_BED_SPOTS, setManorScene, setManorCamera, setManorEmbers }) {
function buildManorScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0a1c);
  scene.fog = new THREE.FogExp2(0x0c0a1c, 0.0016);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 2000);
  // Assign early so swapToManorMap works even if geometry building throws below.
  setManorScene(scene);
  setManorCamera(camera);

  // WALL_H is kept near 3× the 68u player height — grand but not cavernous, so
  // nobody feels dwarfed looking up (an earlier 320 made the player tiny).
  const W = MANOR_WORLD.width, D = MANOR_WORLD.height, WALL_H = 200;

  // ── Light: a dim violet wash + warm points so candles read, never flat ──
  scene.add(new THREE.HemisphereLight(0x3a2d66, 0x0a0714, 0.9));
  scene.add(new THREE.AmbientLight(0x4a3b7a, 0.5));
  const chandLight = new THREE.PointLight(0xffcf87, 2.0, 900, 1.6);
  chandLight.position.set(W / 2, WALL_H * 0.78, D / 2);
  scene.add(chandLight);
  for (const [lx, lz, col] of [[W * 0.22, D * 0.5, 0xffb060], [W * 0.78, D * 0.5, 0xffb060]]) {
    const warm = new THREE.PointLight(col, 1.0, 520, 1.8);
    warm.position.set(lx, 150, lz);
    scene.add(warm);
  }

  // ── Floor: dark planks + a round sigil rug at the hall's heart ──
  const plankMat = new THREE.MeshLambertMaterial({ color: 0x241b36 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), plankMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, 0, D / 2);
  scene.add(floor);
  // Plank seams — thin darker strips so the floor doesn't read as one flat sheet.
  const seamMat = new THREE.MeshBasicMaterial({ color: 0x180f28 });
  for (let z = 56; z < D; z += 56) {
    const seam = new THREE.Mesh(new THREE.PlaneGeometry(W, 2), seamMat);
    seam.rotation.x = -Math.PI / 2;
    seam.position.set(W / 2, 0.5, z);
    scene.add(seam);
  }
  try {
    const rugTex = makeSigilFloorTexture();
    const rug = new THREE.Mesh(new THREE.CircleGeometry(300, 48), new THREE.MeshBasicMaterial({ map: rugTex, transparent: true, opacity: 0.92 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(W / 2, 1, D / 2);
    scene.add(rug);
  } catch (e) { /* sigil texture is decorative — fine to skip if it throws */ }

  // ── Stone outer walls: four sides, the south wall split for the door ──
  const stoneTex = makeStoneTexture();
  stoneTex.repeat.set(W / 120, WALL_H / 120);
  const wallMat = new THREE.MeshLambertMaterial({ map: stoneTex, color: 0x2c2448 });
  const DOOR_W = 120;
  const seg = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); m.position.set(x, y, z); scene.add(m); };
  seg(W, WALL_H, 12, W / 2, WALL_H / 2, 0);                                   // north
  seg(12, WALL_H, D, 0, WALL_H / 2, D / 2);                                   // west
  seg(12, WALL_H, D, W, WALL_H / 2, D / 2);                                   // east
  const sideW = (W - DOOR_W) / 2;                                            // south, left + right of the door
  seg(sideW, WALL_H, 12, sideW / 2, WALL_H / 2, D);
  seg(sideW, WALL_H, 12, W - sideW / 2, WALL_H / 2, D);
  seg(DOOR_W, WALL_H * 0.28, 12, W / 2, WALL_H - WALL_H * 0.14, D);           // lintel over the door

  // ── Ceiling + beams ──
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ color: 0x15102a }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(W / 2, WALL_H, D / 2);
  scene.add(ceil);
  const beamMat = new THREE.MeshLambertMaterial({ color: 0x1c1430 });
  for (let x = 90; x < W; x += 110) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(14, 16, D - 20), beamMat);
    beam.position.set(x, WALL_H - 10, D / 2);
    scene.add(beam);
  }

  // ── Coven banner on the north wall ──
  const bannerC = document.createElement('canvas');
  bannerC.width = 256; bannerC.height = 384;
  const bx = bannerC.getContext('2d');
  bx.fillStyle = '#1a1030'; bx.fillRect(0, 0, 256, 384);
  bx.strokeStyle = '#b096fc'; bx.lineWidth = 6; bx.strokeRect(10, 10, 236, 364);
  bx.strokeStyle = '#ffcf87'; bx.lineWidth = 3;
  bx.beginPath(); bx.arc(128, 150, 70, 0, Math.PI * 2); bx.stroke();   // ring
  // inscribed star
  bx.beginPath();
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; const px = 128 + Math.cos(a) * 66, py = 150 + Math.sin(a) * 66; i ? bx.lineTo(px, py) : bx.moveTo(px, py); }
  bx.closePath(); bx.stroke();
  bx.fillStyle = '#ece7f7'; bx.font = 'bold 26px Georgia, serif'; bx.textAlign = 'center';
  bx.fillText('THE COVEN', 128, 300);
  const bannerTex = new THREE.CanvasTexture(bannerC);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(120, 180), new THREE.MeshBasicMaterial({ map: bannerTex, transparent: true }));
  banner.position.set(W / 2, WALL_H * 0.6, 8);
  scene.add(banner);

  // (The central great table + thrones were removed — they ate too much of the
  // floor. The hall's centre is left open; the sigil rug is the centrepiece.)

  // ── Chandelier overhead (purely decorative; the point-light above does the lighting) ──
  const chand = new THREE.Group();
  const hubRing = new THREE.Mesh(new THREE.TorusGeometry(46, 4, 8, 28), new THREE.MeshLambertMaterial({ color: 0x3a2d1a }));
  hubRing.rotation.x = Math.PI / 2; chand.add(hubRing);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; addCandle(chand, Math.cos(a) * 46, 6, Math.sin(a) * 46, 0.8); }
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, WALL_H * 0.2, 6), new THREE.MeshBasicMaterial({ color: 0x2a2018 }));
  chain.position.y = WALL_H * 0.1 + 6; chand.add(chain);
  chand.position.set(W / 2, WALL_H * 0.72, D / 2);
  scene.add(chand);

  // ── Wall sconces (emissive only — the two warm point-lights carry the room) ──
  for (const [sx, sz] of [[W * 0.5, 14], [14, D * 0.32], [14, D * 0.68], [W - 14, D * 0.32], [W - 14, D * 0.68]]) addCandle(scene, sx, 128, sz, 0.9);

  // ── Eight four-poster bed-chambers at the spots main defines ──
  const bedCloths = [0x7a2550, 0x254b7a, 0x2a6e4a, 0x6e4a2a, 0x4a2a6e, 0x6e2a2a, 0x2a5a6e, 0x5a6e2a];
  MANOR_BED_SPOTS.forEach((spot, i) => scene.add(buildBed(spot, bedCloths[i % bedCloths.length])));

  // ── Door marker so the way out is obvious ──
  const sign = makeSignSprite('🚪 Leave the Manor — Press F');
  sign.position.set(W / 2, 150, D - 16);
  scene.add(sign);

  // ── Drifting embers (ticked by the render loop via setManorEmbers) ──
  try {
    const N = 110;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), vel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = Math.random() * W; pos[i * 3 + 1] = Math.random() * WALL_H; pos[i * 3 + 2] = Math.random() * D;
      vel[i] = 8 + Math.random() * 20;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const emberMat = new THREE.PointsMaterial({ color: 0xffb257, size: 3.2, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    const embers = new THREE.Points(geo, emberMat);
    scene.add(embers);
    if (setManorEmbers) setManorEmbers({ points: embers, vel, W, D, WALL_H });
  } catch (e) { /* embers are decorative */ }

  // ── local prop helpers ──────────────────────────────────────────────────
  function addCandle(parent, x, y, z, scale) {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(2.5 * scale, 3.5 * scale, 14 * scale, 8), new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }));
    stick.position.y = 7 * scale; g.add(stick);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(2.4 * scale, 7 * scale, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    flame.position.y = 17 * scale; g.add(flame);
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  function buildBed(spot, cloth) {
    const g = new THREE.Group();
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x1e140c });
    const mattMat = new THREE.MeshLambertMaterial({ color: 0x2a2436 });
    const clothMat2 = new THREE.MeshLambertMaterial({ color: cloth });
    const BW = 74, BL = 108, POST = 92;   // bed is laid out head-to-north (−z) in local space
    // frame + mattress + blanket + pillow
    const frame = new THREE.Mesh(new THREE.BoxGeometry(BW, 16, BL), frameMat); frame.position.y = 16; g.add(frame);
    const matt = new THREE.Mesh(new THREE.BoxGeometry(BW - 10, 12, BL - 10), mattMat); matt.position.y = 28; g.add(matt);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(BW - 8, 8, BL * 0.6), clothMat2); blanket.position.set(0, 33, BL * 0.16); g.add(blanket);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(BW - 22, 10, 22), new THREE.MeshLambertMaterial({ color: 0xd8d0e4 })); pillow.position.set(0, 34, -BL * 0.32); g.add(pillow);
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(BW, 54, 8), frameMat); headboard.position.set(0, 40, -BL / 2); g.add(headboard);
    // four posts + canopy + drapes
    for (const px of [-BW / 2 + 6, BW / 2 - 6]) for (const pz of [-BL / 2 + 6, BL / 2 - 6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, POST, 8), frameMat); post.position.set(px, POST / 2, pz); g.add(post);
    }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(BW + 6, 8, BL + 6), clothMat2); canopy.position.y = POST; g.add(canopy);
    for (const px of [-BW / 2, BW / 2]) {
      const drape = new THREE.Mesh(new THREE.PlaneGeometry(BL, POST * 0.7), new THREE.MeshLambertMaterial({ color: cloth, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      drape.rotation.y = Math.PI / 2; drape.position.set(px, POST * 0.62, 0); g.add(drape);
    }
    // nightstand + candle beside the bed
    const stand = new THREE.Mesh(new THREE.BoxGeometry(22, 26, 22), frameMat); stand.position.set(BW / 2 + 20, 13, -BL / 4); g.add(stand);
    addCandle(g, BW / 2 + 20, 26, -BL / 4, 0.8);

    g.position.set(spot.x, 0, spot.y);
    g.rotation.y = spot.rot || 0;
    return g;
  }
}

  return { buildManorScene };
}
