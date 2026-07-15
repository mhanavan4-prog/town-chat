// ---------------------------------------------------------------------------
// Town-decor props (Tier 3.4 Phase C — first slice of the shared prop library).
// Pure builders: each takes a decor descriptor `d` and returns a THREE.Group;
// no shared state. THREE is a global; makeGlowTexture/makeBarrel are injected.
// (makeStallCanopyTexture stays internal — only makeMarketStall uses it.)
// ---------------------------------------------------------------------------
export default function createTownProps({ makeGlowTexture, makeBarrel, KK, LAMP_GLOWS }) {
  const PROP_WOOD = 0x6b4a2a, PROP_WOOD_DARK = 0x4a3320, PROP_STONE = 0x8a8a92;
function makeBenchProp(d) {
  const kkG = KK.staticInstance('prop_bench', 44, 'fit');
  if (kkG) { kkG.rotation.y = d.rot || 0; kkG.position.set(d.x, 0, d.y); return kkG; }
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: PROP_WOOD });
  const dark = new THREE.MeshLambertMaterial({ color: PROP_WOOD_DARK });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(44, 4, 16), wood);
  seat.position.y = 14; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(44, 14, 3), wood);
  back.position.set(0, 23, -7.5); g.add(back);
  for (const sx of [-18, 18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(4, 14, 14), dark);
    leg.position.set(sx, 7, 0);
    g.add(leg);
  }
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.rot || 0;
  return g;
}

function makeLamppost(d) {
  const kkG = KK.staticInstance('prop_lamppost', 78, 'height');
  if (kkG) {
    const glassMat = new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffd9a0, transparent: true, opacity: 0.25, depthWrite: false });
    const glass = new THREE.Sprite(glassMat);
    glass.scale.set(16, 16, 1);
    glass.position.set(0, 58, 6);
    kkG.add(glass);
    const glowMat = new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffc372, transparent: true, opacity: 0, depthWrite: false });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(48, 48, 1);
    glow.position.set(0, 58, 6);
    kkG.add(glow);
    LAMP_GLOWS.push({ glassMat, glowMat });
    kkG.rotation.y = d.rot || 0;
    kkG.position.set(d.x, 0, d.y);
    return kkG;
  }
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.4, 74, 6), new THREE.MeshLambertMaterial({ color: 0x33333b }));
  pole.position.y = 37; g.add(pole);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(7, 8, 6), new THREE.MeshLambertMaterial({ color: 0x22222a }));
  cap.position.y = 83; g.add(cap);
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.25 });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(5.5, 10, 8), glassMat);
  glass.position.y = 75; g.add(glass);
  const glowMat = new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffc372, transparent: true, opacity: 0, depthWrite: false });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(48, 48, 1);
  glow.position.y = 75; g.add(glow);
  LAMP_GLOWS.push({ glassMat, glowMat });
  g.position.set(d.x, 0, d.y);
  return g;
}

function makeWell(d) {
  const kkG = KK.staticInstance('prop_well', 48, 'fit');
  if (kkG) { kkG.rotation.y = d.rot || 0; kkG.position.set(d.x, 0, d.y); return kkG; }
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, 16, 10), new THREE.MeshLambertMaterial({ color: PROP_STONE }));
  ring.position.y = 8; g.add(ring);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 2, 10), new THREE.MeshLambertMaterial({ color: 0x1c3a4a }));
  water.position.y = 15; g.add(water);
  const dark = new THREE.MeshLambertMaterial({ color: PROP_WOOD_DARK });
  for (const sx of [-17, 17]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(3.5, 34, 3.5), dark);
    post.position.set(sx, 30, 0); g.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 32, 6), dark);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 42; g.add(bar);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(4, 3.2, 6, 8), new THREE.MeshLambertMaterial({ color: PROP_WOOD }));
  bucket.position.y = 32; g.add(bucket);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x7a3f2a });
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(46, 2.5, 16), roofMat);
    slab.position.set(0, 50 + 4 * 0, side * 7);
    slab.rotation.x = side * 0.5;
    slab.position.y = 50;
    g.add(slab);
  }
  g.position.set(d.x, 0, d.y);
  return g;
}

let _stallTexCache = {};
function makeStallCanopyTexture(variant) {
  if (_stallTexCache[variant]) return _stallTexCache[variant];
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const [a, b] = variant === 1 ? ['#3f7a4a', '#efe6cf'] : ['#a33b3b', '#efe6cf'];
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    ctx.fillRect(i * 16, 0, 16, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  _stallTexCache[variant] = tex;
  return tex;
}

function makeMarketStall(d) {
  const g = new THREE.Group();
  const counter = new THREE.Mesh(new THREE.BoxGeometry(64, 22, 40), new THREE.MeshLambertMaterial({ color: PROP_WOOD }));
  counter.position.y = 11; g.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(68, 3, 44), new THREE.MeshLambertMaterial({ color: PROP_WOOD_DARK }));
  top.position.y = 23.5; g.add(top);
  const poleMat = new THREE.MeshLambertMaterial({ color: PROP_WOOD_DARK });
  for (const [px, pz] of [[-32, -22], [32, -22], [-32, 22], [32, 22]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 56, 6), poleMat);
    pole.position.set(px, 28, pz); g.add(pole);
  }
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(76, 2.5, 54),
    new THREE.MeshLambertMaterial({ map: makeStallCanopyTexture(d.variant || 0) })
  );
  canopy.position.y = 58;
  canopy.rotation.z = 0.08;
  g.add(canopy);
  // a little merchandise on the counter
  const goodsA = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), new THREE.MeshLambertMaterial({ color: 0xc9a227 }));
  goodsA.position.set(-14, 25 + 1.5, 4); g.add(goodsA);
  const goodsB = new THREE.Mesh(new THREE.SphereGeometry(4.5, 8, 8), new THREE.MeshLambertMaterial({ color: 0xa33b3b }));
  goodsB.position.set(12, 28, -6); g.add(goodsB);
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.rot || 0;
  return g;
}

function makeCrate(d) {
  const g = new THREE.Group();
  const crate = new THREE.Mesh(new THREE.BoxGeometry(17, 17, 17), new THREE.MeshLambertMaterial({ color: PROP_WOOD }));
  crate.position.y = 8.5;
  g.add(crate);
  const band = new THREE.Mesh(new THREE.BoxGeometry(17.6, 3, 17.6), new THREE.MeshLambertMaterial({ color: PROP_WOOD_DARK }));
  band.position.y = 8.5;
  g.add(band);
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.rot || 0;
  return g;
}

function makeBarrelProp(d) { // see makeBenchProp note — renamed to dodge the interior makeBarrel(x, z)
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 20, 10), new THREE.MeshLambertMaterial({ color: PROP_WOOD }));
  body.position.y = 10;
  // slight barrel belly
  body.scale.set(1.12, 1, 1.12);
  g.add(body);
  const hoopMat = new THREE.MeshLambertMaterial({ color: 0x3a3a42 });
  for (const hy of [4, 16]) {
    const hoop = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.2, 1.4, 10), hoopMat);
    hoop.position.y = hy;
    g.add(hoop);
  }
  g.position.set(d.x, 0, d.y);
  return g;
}

function makeHaybale(d) {
  const g = new THREE.Group();
  const bale = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 26, 10), new THREE.MeshLambertMaterial({ color: 0xd8b64e }));
  bale.rotation.z = Math.PI / 2;
  bale.position.y = 12;
  g.add(bale);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(4, 24.6, 24.6), new THREE.MeshLambertMaterial({ color: 0xb0913a }));
  strap.position.y = 12;
  g.add(strap);
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.rot || 0;
  return g;
}

function makeFenceSeg(d) {
  const kkG = KK.staticInstance('prop_fence', 58, 'fit');
  if (kkG) { kkG.rotation.y = d.rot || 0; kkG.position.set(d.x, 0, d.y); return kkG; }
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
  for (const px of [-26, 26]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(3.5, 18, 3.5), wood);
    post.position.set(px, 9, 0); g.add(post);
  }
  for (const ry of [7, 13]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(56, 2.6, 2), wood);
    rail.position.y = ry; g.add(rail);
  }
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.rot || 0;
  return g;
}

function makeStump(d) {
  const g = new THREE.Group();
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 10, 8), new THREE.MeshLambertMaterial({ color: 0x5a3d24 }));
  stump.position.y = 5; g.add(stump);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.6, 1, 8), new THREE.MeshLambertMaterial({ color: 0xb08a5a }));
  top.position.y = 10.2; g.add(top);
  g.position.set(d.x, 0, d.y);
  return g;
}

function makeFallenLog(d) {
  const g = new THREE.Group();
  const log = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 48, 8), new THREE.MeshLambertMaterial({ color: 0x5a3d24 }));
  log.rotation.z = Math.PI / 2;
  log.position.y = 7.5;
  g.add(log);
  for (const ex of [-24, 24]) {
    const end = new THREE.Mesh(new THREE.CylinderGeometry(ex < 0 ? 7 : 8, ex < 0 ? 7 : 8, 1, 8), new THREE.MeshLambertMaterial({ color: 0xb08a5a }));
    end.rotation.z = Math.PI / 2;
    end.position.set(ex, 7.5, 0);
    g.add(end);
  }
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.rot || 0;
  return g;
}

function makeNoticeboard(d) {
  const g = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: PROP_WOOD_DARK });
  for (const px of [-14, 14]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(3.5, 40, 3.5), dark);
    post.position.set(px, 20, 0); g.add(post);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(36, 24, 3), new THREE.MeshLambertMaterial({ color: PROP_WOOD }));
  board.position.y = 32; g.add(board);
  // parchment notices
  const paper = new THREE.MeshLambertMaterial({ color: 0xefe6cf });
  for (const [nx, ny, w, h] of [[-8, 34, 10, 12], [6, 31, 12, 10]]) {
    const note = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), paper);
    note.position.set(nx, ny, 1.9);
    note.rotation.z = nx < 0 ? 0.06 : -0.05;
    g.add(note);
  }
  const cap = new THREE.Mesh(new THREE.BoxGeometry(42, 3, 6), dark);
  cap.position.y = 46; g.add(cap);
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.rot || 0;
  return g;
}

  return { makeBenchProp, makeLamppost, makeWell, makeMarketStall, makeCrate, makeBarrelProp, makeHaybale, makeFenceSeg, makeStump, makeFallenLog, makeNoticeboard };
}
