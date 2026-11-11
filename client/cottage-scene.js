// Player housing (slice 2) — the cottage interior. A warm, cozy, timber-framed
// one-room cottage that every account can step into (instanced per account) and
// furnish with the pieces they place in the Home grid editor (slice 1). This
// module builds only the SHELL — floor, walls, hearth glow, the exit
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

  // ── Ceiling ── (no cross-beams: the camera looks down from above the walls,
  // and beams running across the room cut through the view of the player)
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ color: 0x2a1c10 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(W / 2, WALL_H, D / 2);
  scene.add(ceil);

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
  // Hung across the dark door opening, below the lintel (whose underside is at
  // WALL_H * 0.74 = 111), not on it: the lintel's inner face carries the daisy
  // wheel ward (setWards, below), and a sign at lintel height covered it.
  const sign = makeSignSprite('🚪 Leave Your Cottage — Press F');
  sign.position.set(W / 2, 78, D - 18);
  scene.add(sign);

  if (pendingWards) setWards(pendingWards);
  return scene;
}

// ── Threshold & Hearth (blueprint B) — the house's wards, made visible ───────
// The daisy wheel is cut into the inner face of the door lintel; a buried witch
// bottle shows as a sealed hearthstone at the north wall (cracked once spent).
// The concealed shoe is never shown, only the newer plaster it was walled up
// behind; the bottle is marked where it was set (hearth, threshold or floor). A witch's ladder
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
    // Marked where it was set: a sealed hearthstone at the north wall, a long
    // stone slab just inside the door, or a patch of boards lifted and re-laid
    // in the floor. Cracked (or split) once it is spent.
    const spent = w.bottle === 'spent';
    const place = w.bottlePlace || 'hearth';
    const flat = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
    let mark;
    if (place === 'threshold') {
      mark = new THREE.Mesh(new THREE.PlaneGeometry(96, 30), new THREE.MeshLambertMaterial({ map: makeHearthstoneTexture(spent), ...flat }));
      mark.name = 'thresholdStone';
      mark.position.set(W / 2, 0.6, D - 26);              // just inside the door
    } else if (place === 'floor') {
      mark = new THREE.Mesh(new THREE.PlaneGeometry(64, 44), new THREE.MeshLambertMaterial({ map: makeRelaidBoardsTexture(spent), ...flat }));
      mark.name = 'relaidBoards';
      mark.position.set(W * 0.3, 0.6, D * 0.55);          // out in the room, under the boards
    } else {
      mark = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), new THREE.MeshLambertMaterial({ map: makeHearthstoneTexture(spent), ...flat }));
      mark.name = 'hearthstone';
      mark.position.set(W / 2, 0.6, 46);                  // before the north wall, where the hearth sits
    }
    mark.rotation.x = -Math.PI / 2;
    mark.userData.bottlePlace = place;
    wardGroup.add(mark);
  }
  if (w.shoe) {
    // The concealed shoe: walled up by the chimney, the commonest place for
    // one (data/wards.js). What shows is only a square of newer plaster on
    // the chimney breast, never the shoe, so a visitor can't tell what's in it.
    const mat = new THREE.MeshLambertMaterial({ map: makePlasterPatchTexture(), color: 0x7d6e58, transparent: true, depthWrite: false });
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(26, 21), mat);
    patch.name = 'shoePatch';
    patch.position.set(W / 2 - 30, WALL_H * 0.79, 7.4);   // the north wall's inner face, above the hearth
    wardGroup.add(patch);
  }
  if (w.marian) {
    // The Marian mark: two interlocking Vs cut into the north wall's beam,
    // beside where the hearth sits.
    const mat = new THREE.MeshBasicMaterial({ map: makeMarianTexture(), transparent: true, depthWrite: false });
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(44, 32), mat);
    mark.name = 'marianMark';
    mark.position.set(W / 2 - 70, WALL_H * 0.62, 7.4);    // the north wall's inner face, faces into the room (+z)
    wardGroup.add(mark);
  }
  if (w.burn) {
    // The taper burn: a tear of char on the inside of the door frame.
    const mat = new THREE.MeshBasicMaterial({ map: makeBurnTexture(), transparent: true, depthWrite: false });
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(10, 22), mat);
    mark.name = 'burnMark';
    mark.rotation.y = Math.PI;
    // Well clear of the door, so the 'Leave Your Cottage' sign hung across the
    // doorway (about 100 either side of the middle) never covers it.
    mark.position.set(W / 2 + 135, WALL_H * 0.5, D - 7.4);   // the south wall's inner face, beside the door
    wardGroup.add(mark);
  }
  if (w.sator) {
    // The SATOR plate, propped on the wall by the hearth.
    // Unlit, so the hearth light right in front of it doesn't wash the letters out.
    const mat = new THREE.MeshBasicMaterial({ map: makeSatorTexture() });
    const plate = new THREE.Mesh(new THREE.CircleGeometry(18, 28), mat);
    plate.name = 'satorPlate';
    plate.position.set(W / 2 + 70, 58, 7.6);
    wardGroup.add(plate);
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
  if (w.horseshoe) {
    // The found horseshoe: flat on the threshold just inside the door, over
    // the door, or behind it, points up or down as it was nailed.
    const shoe = makeCottageHorseshoe();
    shoe.name = 'horseshoe';
    shoe.userData.place = w.horseshoe; shoe.userData.up = w.horseshoeUp;
    if (w.horseshoeUp === 'points_down') shoe.rotation.z = Math.PI;
    if (w.horseshoe === 'threshold') {
      shoe.rotation.x = -Math.PI / 2; shoe.position.set(W / 2 + 26, 1.2, D - 20);
    } else if (w.horseshoe === 'behind') {
      shoe.rotation.y = Math.PI; shoe.position.set(W / 2 + 82, 64, D - 8.2);
    } else {
      shoe.rotation.y = Math.PI; shoe.position.set(W / 2 + 40, WALL_H * 0.88, D - 8.2);
    }
    wardGroup.add(shoe);
  }
  if (w.hagstone) {
    // The hag stone on a string: at the head of the bed if there is one (or the
    // bed's corner of the room if not), else nailed on the inside of the door.
    const hs = new THREE.Group();
    hs.name = 'hagStone'; hs.userData.place = w.hagstone;
    const stone = new THREE.Mesh(new THREE.TorusGeometry(2.6, 1.9, 8, 14), new THREE.MeshLambertMaterial({ color: 0x8c8a82 }));
    stone.scale.set(1, 1.15, 0.7);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 12, 4), new THREE.MeshLambertMaterial({ color: 0x6e5a3e }));
    string.position.y = 10;
    hs.add(stone, string);
    if (w.hagstone === 'bed') {
      const b = w.bedAt;
      if (b) hs.position.set(b.x, Math.max(48, (b.top || 40) + 14), (b.minZ != null ? b.minZ : b.z) + 4);
      else hs.position.set(40, 60, 40);
    } else {
      hs.rotation.y = Math.PI; hs.position.set(W / 2 - 84, 70, D - 9);
    }
    wardGroup.add(hs);
  }
  if (w.rowan) {
    // The rowan cross over the door, on the inside of the lintel beside the
    // daisy wheel: two peeled twigs, bound with red thread the Scots way, or
    // one put through the other the Manx way.
    const cross = new THREE.Group();
    cross.name = 'rowanCross';
    cross.userData.rowanWay = w.rowan;
    const bark = new THREE.MeshLambertMaterial({ color: 0x7a6656 }); // rowan's grey-brown bark
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 20, 6), bark);
    const across = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 18, 6), bark);
    across.rotation.z = Math.PI / 2;
    cross.add(up, across);
    if (w.rowan !== 'manx') {
      // The red thread wound crosswise over the join, several turns each way.
      const red = new THREE.MeshLambertMaterial({ color: 0xd0202a });
      for (let k = 0; k < 6; k++) {
        const turn = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.42, 5, 12), red);
        turn.rotation.y = Math.PI / 2; turn.rotation.z = (k % 2 ? 1 : -1) * Math.PI / 4;
        turn.position.set(((k >> 1) - 1) * 0.5, 0, 0); turn.name = 'redThread';
        cross.add(turn);
      }
    }
    cross.position.set(W / 2 - 46, WALL_H - WALL_H * 0.13, D - 9);
    wardGroup.add(cross);
  }
  if (w.sheaf) {
    // The last sheaf (data/lastSheaf.js): the neck from a beam, the Maiden hung
    // up, both by the hearth; the kern baby on a shelf on the west wall, "at
    // the top of the bink or dresser".
    const sheaf = makeLastSheaf(w.sheaf);
    if (w.sheaf === 'kern') {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 46), new THREE.MeshLambertMaterial({ color: 0x6e5236 }));
      shelf.position.set(14, 92, D * 0.36); shelf.name = 'sheafShelf';
      wardGroup.add(shelf);
      sheaf.position.set(14, 93.5, D * 0.36);
      sheaf.rotation.y = Math.PI / 2; // facing into the room
    } else {
      sheaf.position.set(W / 2 + 120, WALL_H - 4, 30);
    }
    wardGroup.add(sheaf);
  }
  builtScene.add(wardGroup);
}
// The last sheaf, as each form was kept. A neck or a Maiden is a little
// bundle of straws tied below the ears, hung ears-down from a cord; the Maiden
// is dressed (here, with a red ribbon). The kern baby is a small figure of the sheaf,
// "crowned with wheat-ears and dressed up in gay finery" (Henderson), standing.
// A horseshoe, points up: half a ring of iron with the two heels run down.
function makeCottageHorseshoe() {
  const g = new THREE.Group();
  const iron = new THREE.MeshLambertMaterial({ color: 0x4a4744 });
  const arc = new THREE.Mesh(new THREE.TorusGeometry(5, 1.1, 6, 16, Math.PI), iron);
  arc.rotation.z = Math.PI; // the round toe at the bottom, the heels up
  g.add(arc);
  for (const side of [-1, 1]) {
    const heel = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 4, 6), iron);
    heel.position.set(side * 5, 2, 0); g.add(heel);
  }
  return g;
}

function makeLastSheaf(form) {
  const g = new THREE.Group();
  g.name = 'lastSheaf';
  g.userData.sheafForm = form;
  const straw = new THREE.MeshLambertMaterial({ color: 0xd9b45a });
  const ear = new THREE.MeshLambertMaterial({ color: 0xc89a3c });
  if (form === 'kern') {
    const body = new THREE.Mesh(new THREE.ConeGeometry(4.2, 20, 8), straw);
    body.position.y = 10; g.add(body);
    const dress = new THREE.Mesh(new THREE.ConeGeometry(5.6, 12, 10, 1, true), new THREE.MeshLambertMaterial({ color: 0xb33a3a, side: THREE.DoubleSide }));
    dress.position.y = 6; dress.name = 'kernDress'; g.add(dress);
    const head = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 6), straw);
    head.position.y = 22.5; g.add(head);
    for (let i = 0; i < 7; i++) { // the crown of wheat-ears
      const a = (i / 7) * Math.PI * 2;
      const e = new THREE.Mesh(new THREE.ConeGeometry(0.9, 5, 5), ear);
      e.position.set(Math.cos(a) * 2.6, 26.5, Math.sin(a) * 2.6); e.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      e.userData.crownEar = true; g.add(e);
    }
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 9, 5), straw);
      arm.position.set(side * 4.2, 15, 0); arm.rotation.z = side * 0.9; g.add(arm);
    }
    return g;
  }
  // Hung from a cord: the cord, the tie, the straws above and the ears below.
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 14, 4), new THREE.MeshLambertMaterial({ color: 0x8a7350 }));
  cord.position.y = -7; g.add(cord);
  const tieY = -24;
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2, r = 0.9 + (i % 3) * 0.5;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 12, 4), straw);
    st.position.set(Math.cos(a) * r, tieY + 6, Math.sin(a) * r); st.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); g.add(st);
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.85, 6, 5), ear);
    e.rotation.x = Math.PI; // ears hanging down
    e.position.set(Math.cos(a) * r * 2.2, tieY - 8, Math.sin(a) * r * 2.2); g.add(e);
    const st2 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 6, 4), straw);
    st2.position.set(Math.cos(a) * r * 1.6, tieY - 3, Math.sin(a) * r * 1.6); st2.rotation.set(-Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3); g.add(st2);
  }
  const tie = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 2.2, 10), new THREE.MeshLambertMaterial({ color: form === 'maiden' ? 0xb33a3a : 0xc9a24a }));
  tie.position.y = tieY; tie.name = form === 'maiden' ? 'maidenRibbon' : 'neckTie'; g.add(tie);
  if (form === 'maiden') { // the ribbon's two tails
    for (const side of [-1, 1]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 0.3), new THREE.MeshLambertMaterial({ color: 0xb33a3a, side: THREE.DoubleSide }));
      tail.position.set(side * 2, tieY - 5, 2.2); tail.rotation.z = side * 0.25; g.add(tail);
    }
  }
  return g;
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
function makeMarianTexture() {
  const W2 = 256, H2 = 188, c = document.createElement('canvas'); c.width = W2; c.height = H2;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(240,222,190,0.9)'; g.lineWidth = 7; g.lineCap = 'round';
  // Two Vs, the second's first arm crossing the first's second.
  const V = (l, b, r) => { g.beginPath(); g.moveTo(l, 20); g.lineTo(b, H2 - 20); g.lineTo(r, 20); g.stroke(); };
  V(24, 76, 140); V(100, 160, 232);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}
function makeBurnTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 140;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 140, 0, 0);
  grad.addColorStop(0, 'rgba(20,10,4,0.95)'); grad.addColorStop(0.6, 'rgba(45,25,10,0.8)'); grad.addColorStop(1, 'rgba(60,35,15,0.1)');
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(32, 136); g.bezierCurveTo(4, 110, 18, 30, 32, 6); g.bezierCurveTo(46, 30, 60, 110, 32, 136); g.fill();
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
function makeSatorTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  grad.addColorStop(0, '#a89b7c'); grad.addColorStop(0.8, '#8f7c58'); grad.addColorStop(1, '#5a4326');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  g.fillStyle = '#1e1208'; g.font = 'bold 28px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const rows = ['SATOR', 'AREPO', 'TENET', 'OPERA', 'ROTAS'];
  rows.forEach((row, r) => { for (let i = 0; i < 5; i++) g.fillText(row[i], 68 + i * 30, 68 + r * 30); });
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

// Boards lifted and re-laid over a bottle: three short lighter planks with
// bright new nail heads, across the grain of the floor. Split once spent.
function makeRelaidBoardsTexture(split) {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#5c4228'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#2e1f10'; g.lineWidth = 3;
  for (const x of [1, 43, 86, 127]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); }
  g.fillStyle = '#c9b48a';
  for (const x of [12, 31, 55, 74, 98, 117]) for (const y of [10, S - 10]) { g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill(); }
  if (split) {
    g.strokeStyle = '#140e0a'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(60, 6); g.lineTo(66, 50); g.lineTo(58, 82); g.lineTo(64, 122); g.stroke();
  }
  return new THREE.CanvasTexture(c);
}

// A square of newer plaster on the chimney breast, paler than the old wall,
// with its edges feathered out: where the shoe was walled up.
function makePlasterPatchTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.62);
  grd.addColorStop(0, 'rgba(214,200,172,0.95)'); grd.addColorStop(0.75, 'rgba(196,180,150,0.8)'); grd.addColorStop(1, 'rgba(196,180,150,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(120,104,80,0.45)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(22, 30); g.quadraticCurveTo(64, 22, 106, 34); g.moveTo(26, 96); g.quadraticCurveTo(70, 104, 100, 92); g.stroke();
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
