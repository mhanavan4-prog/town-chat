// ---------------------------------------------------------------------------
// Witch Cave scene (Tier 3.4 Phase C, 3D slice). A self-contained interior:
// buildCaveScene + addCaveWallShelves and its 13 nested decoration makers
// (makePotion/makeSkull/makeCandle/…, all cave-only). THREE is a global; the
// few external helpers (makeSignSprite/makeNpcNameSprite/createHumanoid) and
// CAVE_WORLD are injected; scene/camera are handed back via setters.
// ---------------------------------------------------------------------------
export default function createCaveScene({ makeSignSprite, makeNpcNameSprite, createHumanoid, CAVE_WORLD, setCaveScene, setCaveCamera }) {
function buildCaveScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0520);
  scene.fog = new THREE.Fog(0x0d0520, 350, 900);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 1400);
  // Assign early so swapToCaveMap works even if geometry building throws below
  setCaveScene(scene);
  setCaveCamera(camera);

  // Bright purple ambient so stone surfaces are actually visible
  scene.add(new THREE.AmbientLight(0xaa55dd, 2.5));
  // Soft fill from above so the witch/player aren't silhouettes
  const fillLight = new THREE.DirectionalLight(0xcc88ff, 0.9);
  fillLight.position.set(400, 300, 300);
  scene.add(fillLight);

  // Stone floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800),
    new THREE.MeshLambertMaterial({ color: 0x2a1840 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(400, 0, 350);
  scene.add(floor);

  // Cave walls — pushed further out so the indoor camera (back=92) never clips them
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x3a1a55 });
  for (const [wx, wy, wz, ww, wh, wd] of [
    [400, 60, -20,  900, 240, 40],   // back wall (north)
    [400, 60, 730,  900, 240, 40],   // front wall (south) — pushed to 730 so camera at z≈540 can't reach it
    [-20, 60, 355,  40, 240, 800],   // left wall
    [820, 60, 355,  40, 240, 800],   // right wall
    [400, 240, 355, 1000, 40, 900],  // ceiling
  ]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, wd), wallMat);
    w.position.set(wx, wy, wz);
    scene.add(w);
  }

  // Purple crystal torch lights — brighter so the stone reads
  const crystalMat = new THREE.MeshLambertMaterial({ color: 0xdd66ff, emissive: 0x8800cc });
  for (const [tx, tz] of [[120, 100], [680, 100], [120, 490], [680, 490], [400, 280], [200, 300], [600, 300]]) {
    const light = new THREE.PointLight(0xaa33ff, 2.2, 420);
    light.position.set(tx, 90, tz);
    scene.add(light);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(10, 0), crystalMat);
    crystal.position.set(tx, 14, tz);
    scene.add(crystal);
  }

  // Witch NPC (charId 0) sitting at the back
  const witchMesh = createHumanoid(0).group;
  witchMesh.position.set(400, 0, 160);
  witchMesh.rotation.y = Math.PI;
  scene.add(witchMesh);

  // Cauldron
  const cauldron = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(18, 14, 22, 10), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  pot.position.y = 11;
  cauldron.add(pot);
  const brew = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 4, 10), new THREE.MeshLambertMaterial({ color: 0x228822, emissive: 0x115511 }));
  brew.position.y = 21;
  cauldron.add(brew);
  cauldron.position.set(400, 0, 200);
  scene.add(cauldron);

  // -------------------------------------------------------------------------
  // Tarot cards — painted canvas textures hung on cave walls
  // -------------------------------------------------------------------------
  const TAROT_CARDS = [
    { sym: '🌙', name: 'THE MOON',        num: 'XVIII' },
    { sym: '☀️', name: 'THE SUN',         num: 'XIX'  },
    { sym: '⭐', name: 'THE STAR',        num: 'XVII' },
    { sym: '💀', name: 'DEATH',           num: 'XIII' },
    { sym: '⚡', name: 'THE TOWER',       num: 'XVI'  },
    { sym: '🔮', name: 'HIGH PRIESTESS',  num: 'II'   },
    { sym: '💫', name: 'THE WORLD',       num: 'XXI'  },
    { sym: '🌑', name: 'THE DEVIL',       num: 'XV'   },
    { sym: '♾️', name: 'WHEEL OF FATE',   num: 'X'    },
    { sym: '🌿', name: 'THE HERMIT',      num: 'IX'   },
    { sym: '🔥', name: 'THE CHARIOT',     num: 'VII'  },
    { sym: '🌊', name: 'HANGED MAN',      num: 'XII'  },
  ];

  function makeTarotTexture(card) {
    const cw = 64, ch = 104;
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const ctx = c.getContext('2d');
    // Card background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#120826'); grad.addColorStop(1, '#1e0a3c');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
    // Outer gold border
    ctx.strokeStyle = '#c8a000'; ctx.lineWidth = 2.5;
    ctx.strokeRect(3, 3, cw - 6, ch - 6);
    // Inner border
    ctx.strokeStyle = '#7a5500'; ctx.lineWidth = 1;
    ctx.strokeRect(7, 7, cw - 14, ch - 14);
    // Corner ornaments
    for (const [ox, oy] of [[10, 10], [cw-10, 10], [10, ch-10], [cw-10, ch-10]]) {
      ctx.fillStyle = '#c8a000'; ctx.beginPath();
      ctx.arc(ox, oy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Roman numeral
    ctx.fillStyle = '#aa8800'; ctx.font = '7px serif'; ctx.textAlign = 'center';
    ctx.fillText(card.num, cw / 2, 20);
    // Main symbol
    ctx.font = '30px serif'; ctx.textAlign = 'center';
    ctx.fillText(card.sym, cw / 2, 58);
    // Card name
    ctx.fillStyle = '#e0c060'; ctx.font = 'bold 6px sans-serif';
    ctx.fillText(card.name, cw / 2, 82);
    // Decorative dots
    ctx.fillStyle = '#7a5500';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(12 + i * 10, 90, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    return new THREE.CanvasTexture(c);
  }

  const cardW = 60, cardH = 96;

  // Back wall (north, z≈0) — 6 cards spread across x=100..700
  const backCardXs = [110, 230, 350, 470, 590, 710];
  backCardXs.forEach((cx, i) => {
    const card = TAROT_CARDS[i];
    const mat = new THREE.MeshLambertMaterial({ map: makeTarotTexture(card), emissive: 0x110022, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cardW, cardH), mat);
    mesh.position.set(cx, 90, 2);   // just in front of back wall
    scene.add(mesh);
  });

  // Left wall (x≈0) — 3 cards facing right (+x)
  [{ z: 220, idx: 6 }, { z: 380, idx: 7 }, { z: 520, idx: 8 }].forEach(({ z, idx }) => {
    const mat = new THREE.MeshLambertMaterial({ map: makeTarotTexture(TAROT_CARDS[idx]), emissive: 0x110022, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cardW, cardH), mat);
    mesh.position.set(2, 90, z);
    mesh.rotation.y = Math.PI / 2;
    scene.add(mesh);
  });

  // Right wall (x≈800) — 3 cards facing left (-x)
  [{ z: 220, idx: 9 }, { z: 380, idx: 10 }, { z: 520, idx: 11 }].forEach(({ z, idx }) => {
    const mat = new THREE.MeshLambertMaterial({ map: makeTarotTexture(TAROT_CARDS[idx]), emissive: 0x110022, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cardW, cardH), mat);
    mesh.position.set(798, 90, z);
    mesh.rotation.y = -Math.PI / 2;
    scene.add(mesh);
  });

  // -------------------------------------------------------------------------
  // Rune circle painted on the floor under the cauldron
  // -------------------------------------------------------------------------
  (function() {
    const rc = document.createElement('canvas'); rc.width = 256; rc.height = 256;
    const rx = rc.getContext('2d');
    // Faint circle
    rx.strokeStyle = 'rgba(180,80,255,0.6)'; rx.lineWidth = 3;
    rx.beginPath(); rx.arc(128, 128, 110, 0, Math.PI * 2); rx.stroke();
    rx.beginPath(); rx.arc(128, 128, 88, 0, Math.PI * 2); rx.stroke();
    // Inner star
    rx.strokeStyle = 'rgba(200,120,255,0.5)'; rx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const a2 = ((i + 3) / 6) * Math.PI * 2 - Math.PI / 2;
      rx.beginPath();
      rx.moveTo(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88);
      rx.lineTo(128 + Math.cos(a2) * 88, 128 + Math.sin(a2) * 88);
      rx.stroke();
    }
    // Rune glyphs around the ring
    rx.fillStyle = 'rgba(220,160,255,0.7)'; rx.font = '18px serif'; rx.textAlign = 'center';
    const runes = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ','ᚺ','ᚾ','ᛁ','ᛃ'];
    runes.forEach((r, i) => {
      const a = (i / runes.length) * Math.PI * 2 - Math.PI / 2;
      rx.fillText(r, 128 + Math.cos(a) * 102, 128 + Math.sin(a) * 102 + 6);
    });
    const runeTex = new THREE.CanvasTexture(rc);
    const runeCircle = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshLambertMaterial({ map: runeTex, transparent: true, opacity: 0.85 })
    );
    runeCircle.rotation.x = -Math.PI / 2;
    runeCircle.position.set(400, 1, 200);
    scene.add(runeCircle);
  })();

  // -------------------------------------------------------------------------
  // Alchemy table (northwest corner) with potion supplies
  // -------------------------------------------------------------------------
  (function() {
    const woodMat  = new THREE.MeshLambertMaterial({ color: 0x3a1800 });
    const darkWood = new THREE.MeshLambertMaterial({ color: 0x250e00 });
    const tableG = new THREE.Group();
    // Tabletop
    const top = new THREE.Mesh(new THREE.BoxGeometry(130, 8, 75), woodMat);
    top.position.y = 40; tableG.add(top);
    // Legs
    for (const [lx, lz] of [[-58, 32], [58, 32], [-58, -32], [58, -32]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(7, 40, 7), darkWood);
      leg.position.set(lx, 20, lz); tableG.add(leg);
    }
    tableG.position.set(180, 0, 260);
    scene.add(tableG);

    // Potion bottles on the table
    const bottleColors = [0xee2222, 0x2266ee, 0x22bb44, 0xddaa00, 0xaa22dd, 0x22cccc];
    bottleColors.forEach((col, i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(4.5, 5.5, 16, 8),
        new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.25 })
      );
      body.position.y = 8; g.add(body);
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 3.5, 7, 8),
        new THREE.MeshLambertMaterial({ color: 0x334455 })
      );
      neck.position.y = 19.5; g.add(neck);
      const stopper = new THREE.Mesh(
        new THREE.SphereGeometry(2.5, 6, 6),
        new THREE.MeshLambertMaterial({ color: 0x222200 })
      );
      stopper.position.y = 23.5; g.add(stopper);
      g.position.set(120 + i * 18, 44, 244 + (i % 2 === 0 ? -8 : 8));
      scene.add(g);
    });

    // Mortar & pestle
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x556677 });
    const mortar = new THREE.Mesh(new THREE.CylinderGeometry(9, 8, 10, 10), stoneMat);
    mortar.position.set(228, 45, 280); scene.add(mortar);
    const pestle = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2, 18, 8), stoneMat);
    pestle.position.set(228, 55, 275); pestle.rotation.z = 0.4; scene.add(pestle);

    // Scattered herbs on the table
    const herbMat = new THREE.MeshLambertMaterial({ color: 0x226622 });
    for (let i = 0; i < 4; i++) {
      const herb = new THREE.Mesh(new THREE.SphereGeometry(3 + i * 0.5, 5, 4), herbMat);
      herb.scale.y = 0.4;
      herb.position.set(140 + i * 22, 45, 268);
      scene.add(herb);
    }

    // Glowing candle on table corner
    const candleMat = new THREE.MeshLambertMaterial({ color: 0xeecc88 });
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 20, 8), candleMat);
    candle.position.set(236, 50, 252); scene.add(candle);
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(3, 5, 5),
      new THREE.MeshLambertMaterial({ color: 0xff8800, emissive: 0xff5500, emissiveIntensity: 1 })
    );
    flame.position.set(236, 62, 252); scene.add(flame);
    const candleLight = new THREE.PointLight(0xff8822, 1.2, 160);
    candleLight.position.set(236, 65, 252); scene.add(candleLight);

    // A bookshelf on the left wall
    const shelfMat = new THREE.MeshLambertMaterial({ color: 0x2a1000 });
    for (let shelf = 0; shelf < 3; shelf++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(100, 6, 22), shelfMat);
      plank.position.set(55, 60 + shelf * 40, 350);
      scene.add(plank);
      // Books on shelf
      const bookCols = [0x883333, 0x334488, 0x338833, 0x884488, 0x888833];
      for (let b = 0; b < 5; b++) {
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(10 + b * 2, 28 + b, 16),
          new THREE.MeshLambertMaterial({ color: bookCols[b] })
        );
        book.position.set(14 + b * 18, 78 + shelf * 40, 350);
        scene.add(book);
      }
    }
    // Shelf backing board
    const backBoard = new THREE.Mesh(new THREE.BoxGeometry(110, 135, 5), shelfMat);
    backBoard.position.set(55, 88, 363); scene.add(backBoard);
  })();

  addCaveWallShelves(scene);

  // Sign above witch
  const witchSign = makeNpcNameSprite('Witch Hazel', 'Queen of the Fifth Hand');
  witchSign.position.set(400, 118, 140);
  scene.add(witchSign);

  // Exit arch near south end of cave
  const exitMat = new THREE.MeshLambertMaterial({ color: 0x2a104a });
  const exitArch = new THREE.Mesh(new THREE.BoxGeometry(80, 80, 30), exitMat);
  exitArch.position.set(400, 40, 650);
  scene.add(exitArch);
  const exitGlow = new THREE.PointLight(0x4488ff, 1.4, 180);
  exitGlow.position.set(400, 40, 630);
  scene.add(exitGlow);
  const exitSign = makeSignSprite('🌫️ Exit Cave — Press F to leave');
  exitSign.position.set(400, 110, 650);
  scene.add(exitSign);

}

function addCaveWallShelves(scene) {
  // Shelves line the SOUTH wall (interior face z=710) on both sides of the exit door.
  // Door is centred at x=400, so left shelves run x≈22–345, right x≈455–778.
  const WALL_Z  = 710;
  const SHELF_Z = WALL_Z - 11;   // shelf centre — protrudes 22 units into room

  const shelfMat  = new THREE.MeshLambertMaterial({ color: 0x2a1408 });
  const brktMat   = new THREE.MeshLambertMaterial({ color: 0x1a0c05 });
  const boneMat   = new THREE.MeshLambertMaterial({ color: 0xc8bba0 });
  const skullMat  = new THREE.MeshLambertMaterial({ color: 0xc4b898 });
  const eyeBlack  = new THREE.MeshLambertMaterial({ color: 0x110011 });
  const pageMat   = new THREE.MeshLambertMaterial({ color: 0xd4c89a });
  const corkMat   = new THREE.MeshLambertMaterial({ color: 0x4a2a10 });
  const baseMat   = new THREE.MeshLambertMaterial({ color: 0x1a0830 });
  const sandMat   = new THREE.MeshLambertMaterial({ color: 0xddaa44 });

  function makePotion(x, y, z, col) {
    const g = new THREE.Group();
    const bH = 10, bR = 3;
    const mat = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.22 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(bR, bR + 0.8, bH, 7), mat);
    body.position.y = bH / 2; g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.2, bR * 0.55, 4, 6), mat);
    neck.position.y = bH + 2; g.add(neck);
    const cork = new THREE.Mesh(new THREE.SphereGeometry(1.7, 6, 5), corkMat);
    cork.position.y = bH + 4.5; g.add(cork);
    g.position.set(x, y, z);
    g.rotation.z = Math.sin(x * 7 + z * 3) * 0.12;
    scene.add(g);
  }

  function makeSkull(x, y, z, sc) {
    sc = sc || 1;
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(5.5 * sc, 8, 8), skullMat);
    head.scale.set(1, 0.88, 1.1); head.position.y = 5.5 * sc; g.add(head);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(7 * sc, 2.5 * sc, 4.5 * sc), skullMat);
    jaw.position.set(0, 0.8 * sc, 2.5 * sc); g.add(jaw);
    for (const ex of [-2 * sc, 2 * sc]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(1.5 * sc, 6, 6), eyeBlack);
      eye.position.set(ex, 6.5 * sc, 4.5 * sc); g.add(eye);
    }
    g.position.set(x, y, z);
    g.rotation.y = Math.sin(x * 5 + z) * Math.PI;
    scene.add(g);
  }

  let candleLights = 0;
  function makeCandle(x, y, z, col) {
    const g = new THREE.Group();
    const cH = 14 + Math.abs(Math.sin(x * 3 + z * 2)) * 10;
    const cMat = new THREE.MeshLambertMaterial({ color: col || 0x1a0a0a });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, cH, 7), cMat);
    body.position.y = cH / 2; g.add(body);
    const drip = new THREE.Mesh(new THREE.CylinderGeometry(3, 2.8, 2, 7), cMat);
    drip.position.y = 1; g.add(drip);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(2, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0xff8800, emissive: 0xff4400, emissiveIntensity: 1 }));
    flame.scale.y = 1.6; flame.position.y = cH + 2.5; g.add(flame);
    g.position.set(x, y, z);
    g.rotation.z = Math.sin(x * 9 + z) * 0.08;
    scene.add(g);
    if (candleLights < 8) {
      const light = new THREE.PointLight(0xff6600, 0.55, 100);
      light.position.set(x, y + cH + 3, z);
      scene.add(light);
      candleLights++;
    }
  }

  function makeCrystal(x, y, z, col) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.38, transparent: true, opacity: 0.72 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(5.5, 10, 10), mat);
    ball.position.y = 7.5; g.add(ball);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.5, 3, 8), baseMat);
    base.position.y = 1.5; g.add(base);
    g.position.set(x, y, z);
    scene.add(g);
  }

  function makeBook(x, y, z, col) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: col });
    const book = new THREE.Mesh(new THREE.BoxGeometry(9, 12, 4.5), mat);
    book.position.y = 6; g.add(book);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(7.5, 10.5, 4), pageMat);
    pages.position.set(1.5, 6, 0); g.add(pages);
    g.position.set(x, y, z);
    g.rotation.z = Math.sin(x * 4 + z * 2.3) * 0.2;
    g.rotation.y = Math.sin(x * 3) * 0.12;
    scene.add(g);
  }

  function makeHourglass(x, y, z) {
    const g = new THREE.Group();
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x334455, transparent: true, opacity: 0.75 });
    const fMat = new THREE.MeshLambertMaterial({ color: 0x2a1a00 });
    const topCone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 8), glassMat);
    topCone.position.y = 13.5; topCone.rotation.z = Math.PI; g.add(topCone);
    const botCone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 8), glassMat);
    botCone.position.y = 4.5; g.add(botCone);
    const sand = new THREE.Mesh(new THREE.ConeGeometry(4, 5, 8), sandMat);
    sand.position.y = 2.5; sand.rotation.z = Math.PI; g.add(sand);
    for (const fz of [-3, 3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 19, 5), fMat);
      post.position.set(fz, 9, 0); g.add(post);
    }
    const disc1 = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1.5, 8), fMat);
    disc1.position.y = 18.5; g.add(disc1);
    const disc2 = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1.5, 8), fMat);
    disc2.position.y = 0.75; g.add(disc2);
    g.position.set(x, y, z);
    scene.add(g);
  }

  function makeEyeJar(x, y, z) {
    const g = new THREE.Group();
    const jMat = new THREE.MeshLambertMaterial({ color: 0x1a3322, transparent: true, opacity: 0.68 });
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 13, 9), jMat);
    jar.position.y = 6.5; g.add(jar);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 2.5, 9), brktMat);
    lid.position.y = 14; g.add(lid);
    const ew = new THREE.Mesh(new THREE.SphereGeometry(3.5, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xeeeedd }));
    ew.position.y = 7; g.add(ew);
    const ep = new THREE.Mesh(new THREE.SphereGeometry(2, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x880000, emissive: 0x440000, emissiveIntensity: 0.4 }));
    ep.position.set(0, 7, 3.2); g.add(ep);
    g.position.set(x, y, z);
    scene.add(g);
  }

  function makeBone(x, y, z) {
    const g = new THREE.Group();
    const ang = Math.abs(Math.sin(x * 6 + z * 2)) * 0.5 + 0.2;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 18, 6), boneMat);
    shaft.position.y = 9; shaft.rotation.z = ang; g.add(shaft);
    const cosA = Math.cos(ang), sinA = Math.sin(ang);
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(2.2, 6, 6), boneMat);
    e1.position.set(-sinA * 9, 9 + cosA * 9, 0); g.add(e1);
    const e2 = new THREE.Mesh(new THREE.SphereGeometry(2.2, 6, 6), boneMat);
    e2.position.set(sinA * 9, 9 - cosA * 9, 0); g.add(e2);
    g.position.set(x, y, z);
    scene.add(g);
  }

  function makeJar(x, y, z, col) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: col || 0x221133 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.5, 11, 9), mat);
    body.position.y = 5.5; g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 3, 9), mat);
    neck.position.y = 12.5; g.add(neck);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 2.5, 9), brktMat);
    lid.position.y = 15.5; g.add(lid);
    const runeMat = new THREE.MeshLambertMaterial({ color: 0x8855aa });
    for (let ri = 0; ri < 3; ri++) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.6), runeMat);
      r.position.set(Math.cos(ri * 2.1) * 5.6, 5.5, Math.sin(ri * 2.1) * 5.6);
      g.add(r);
    }
    g.position.set(x, y, z);
    scene.add(g);
  }

  function makeMoon(x, y, z) {
    const g = new THREE.Group();
    const mMat = new THREE.MeshLambertMaterial({ color: 0xddcc66, emissive: 0x554411, emissiveIntensity: 0.5 });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 10), mMat);
    sphere.position.y = 11; g.add(sphere);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 10, 5), brktMat);
    post.position.y = 5; g.add(post);
    const s1 = new THREE.Mesh(new THREE.SphereGeometry(1.5, 5, 5), mMat);
    s1.position.set(7, 14, 0); g.add(s1);
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(1, 5, 5), mMat);
    s2.position.set(3, 17, 0); g.add(s2);
    g.position.set(x, y, z);
    scene.add(g);
  }

  function makeMushroom(x, y, z, col) {
    const g = new THREE.Group();
    const stemMat = new THREE.MeshLambertMaterial({ color: 0xc8bfa8 });
    const capCol  = col || 0xcc2200;
    const capMat  = new THREE.MeshLambertMaterial({ color: capCol, emissive: capCol, emissiveIntensity: 0.12 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2, 8, 7), stemMat);
    stem.position.y = 4; g.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(6, 9, 7), capMat);
    cap.scale.y = 0.6; cap.position.y = 10; g.add(cap);
    const spot = new THREE.Mesh(new THREE.SphereGeometry(1.2, 5, 5),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    spot.position.set(3, 11, 0); g.add(spot);
    g.position.set(x, y, z);
    scene.add(g);
  }

  function makeFeatherBundle(x, y, z) {
    const g = new THREE.Group();
    const FCOLS = [0x2a2a44, 0x1a3a2a, 0x4a1a2a, 0x332244, 0x1a1a3a];
    const bind = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 4, 8), brktMat);
    bind.position.y = 2; g.add(bind);
    for (let fi = 0; fi < 5; fi++) {
      const angle = (fi / 5) * Math.PI * 2;
      const fMat = new THREE.MeshLambertMaterial({ color: FCOLS[fi] });
      const quill = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.3, 22, 5), fMat);
      quill.position.set(Math.cos(angle) * 2, 14, Math.sin(angle) * 2);
      quill.rotation.z = Math.cos(angle) * 0.28;
      quill.rotation.x = Math.sin(angle) * 0.28;
      g.add(quill);
    }
    g.position.set(x, y, z);
    scene.add(g);
  }

  // ── Shelf plank + wall brackets (south wall, runs along x) ──
  const TILTS_Z = [0.032, -0.041, 0.022, -0.037, 0.048, -0.026, 0.038, -0.052];
  const TILTS_X = [0.009, -0.007, 0.011, -0.008, 0.006, -0.010, 0.013, -0.005];

  function addShelfSegment(x0, x1, y, idx) {
    const len = x1 - x0;
    const cx  = (x0 + x1) / 2;
    const tz  = TILTS_Z[idx % TILTS_Z.length];  // tilts one x-end up/down (crooked)
    const tx  = TILTS_X[idx % TILTS_X.length];  // slight front/back lean
    const plank = new THREE.Mesh(new THREE.BoxGeometry(len, 6, 22), shelfMat);
    plank.position.set(cx, y, SHELF_Z);
    plank.rotation.z = tz;
    plank.rotation.x = tx;
    scene.add(plank);
    // Bracket at each x-end: vertical post + horizontal arm toward room
    for (const bx of [x0 + 4, x1 - 4]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(3.5, y - 3, 3.5), brktMat);
      post.position.set(bx, (y - 3) / 2, WALL_Z - 2);
      scene.add(post);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3, 22), brktMat);
      arm.position.set(bx, y - 4.5, SHELF_Z);
      scene.add(arm);
    }
  }

  // ── Item sequences (left side of door / right side of door) ─
  const LEFT_SEQ = [
    (x,y,z) => makePotion(x,y,z,0x662288),
    (x,y,z) => makeSkull(x,y,z),
    (x,y,z) => makeCandle(x,y,z,0x110011),
    (x,y,z) => makeBone(x,y,z),
    (x,y,z) => makePotion(x,y,z,0x117733),
    (x,y,z) => makeEyeJar(x,y,z),
    (x,y,z) => makeMushroom(x,y,z,0xcc2200),
    (x,y,z) => makeBook(x,y,z,0x440022),
    (x,y,z) => makeHourglass(x,y,z),
    (x,y,z) => makeJar(x,y,z,0x221133),
    (x,y,z) => makeMoon(x,y,z),
    (x,y,z) => makeFeatherBundle(x,y,z),
    (x,y,z) => makePotion(x,y,z,0x884400),
    (x,y,z) => makeSkull(x,y,z,0.7),
    (x,y,z) => makeCandle(x,y,z,0x0a0a1a),
    (x,y,z) => makeBook(x,y,z,0x002244),
    (x,y,z) => makeCrystal(x,y,z,0x00cccc),
    (x,y,z) => makeJar(x,y,z,0x332200),
    (x,y,z) => makeMushroom(x,y,z,0x8800cc),
    (x,y,z) => makePotion(x,y,z,0xcc4488),
  ];
  const RIGHT_SEQ = [
    (x,y,z) => makeCrystal(x,y,z,0x4400cc),
    (x,y,z) => makeBook(x,y,z,0x110011),
    (x,y,z) => makeHourglass(x,y,z),
    (x,y,z) => makeMoon(x,y,z),
    (x,y,z) => makeJar(x,y,z,0x113322),
    (x,y,z) => makeCandle(x,y,z,0x1a001a),
    (x,y,z) => makeSkull(x,y,z),
    (x,y,z) => makeCrystal(x,y,z,0x880099),
    (x,y,z) => makeFeatherBundle(x,y,z),
    (x,y,z) => makePotion(x,y,z,0x991100),
    (x,y,z) => makeEyeJar(x,y,z),
    (x,y,z) => makeBook(x,y,z,0x1a0a2a),
    (x,y,z) => makeMushroom(x,y,z,0x440099),
    (x,y,z) => makeCandle(x,y,z,0x001a0a),
    (x,y,z) => makeBone(x,y,z),
    (x,y,z) => makeJar(x,y,z,0x113300),
    (x,y,z) => makeCrystal(x,y,z,0xddaa00),
    (x,y,z) => makeSkull(x,y,z,0.65),
    (x,y,z) => makePotion(x,y,z,0xcc44aa),
    (x,y,z) => makeMoon(x,y,z),
  ];

  // ── Build shelves + populate items ───────────────────────────
  // Door spans x=360–440 (80 wide, centred at 400). Leave 20-unit gap each side.
  const SHELF_LEVELS  = [38, 77, 116, 155];
  const LEFT_SEGS     = [[22, 130], [135, 245], [250, 340]];   // left of door
  const RIGHT_SEGS    = [[460, 555], [560, 665], [670, 778]];  // right of door
  const ITEM_SPACING  = 22;

  let li = 0, ri = 0;
  for (let lv = 0; lv < SHELF_LEVELS.length; lv++) {
    const shelfY = SHELF_LEVELS[lv];
    const surfY  = shelfY + 3;

    for (let si = 0; si < LEFT_SEGS.length; si++) {
      const [x0, x1] = LEFT_SEGS[si];
      addShelfSegment(x0, x1, shelfY, si * 4 + lv);
      for (let ix = x0 + 12; ix < x1 - 8; ix += ITEM_SPACING) {
        LEFT_SEQ[li % LEFT_SEQ.length](ix, surfY, SHELF_Z);
        li++;
      }
    }
    for (let si = 0; si < RIGHT_SEGS.length; si++) {
      const [x0, x1] = RIGHT_SEGS[si];
      addShelfSegment(x0, x1, shelfY, si * 4 + lv + 2);
      for (let ix = x0 + 12; ix < x1 - 8; ix += ITEM_SPACING) {
        RIGHT_SEQ[ri % RIGHT_SEQ.length](ix, surfY, SHELF_Z);
        ri++;
      }
    }
  }
}

  return { buildCaveScene };
}
