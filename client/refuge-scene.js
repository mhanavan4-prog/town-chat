// ---------------------------------------------------------------------------
// Ember Refuge scene — a small warm shelter out on the ember flat, for a
// player who missed the portal back. Self-contained interior builder in the
// same mould as the Bank Vault (vault-scene.js): THREE is a global; prop
// helpers + REFUGE_WORLD are injected; the built scene/camera are handed back
// to main via setters. Its door is a private, occupants-only chat room
// ('ember_refuge'), so this is where stranded players hole up and talk.
// ---------------------------------------------------------------------------
export default function createRefugeScene({ makeStoneTexture, makeWoodSidingTexture, makeSignSprite, REFUGE_WORLD, setRefugeScene, setRefugeCamera }) {
function buildRefugeScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x160a07);
  scene.fog = new THREE.Fog(0x160a07, 300, 900);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 1600);
  setRefugeScene(scene);
  setRefugeCamera(camera);

  const roomW = REFUGE_WORLD.width, roomD = REFUGE_WORLD.height, wallH = 170;
  // Warm, dim shelter light — a banked-fire glow rather than daylight.
  scene.add(new THREE.AmbientLight(0xffb27a, 0.5));
  scene.add(new THREE.HemisphereLight(0xff8a55, 0x1a0c06, 0.35));

  // Plank floor — warm timber (fallback to a tinted stone if no wood texture).
  const floorTex = (typeof makeWoodSidingTexture === 'function') ? makeWoodSidingTexture() : makeStoneTexture();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(roomW / 120, roomD / 120);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW, roomD),
    new THREE.MeshLambertMaterial({ map: floorTex, color: 0x6b4a30 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, roomD / 2);
  scene.add(floor);

  // Soot-dark stone walls so the hearth glow pools warmly against them.
  const stoneTex = makeStoneTexture();
  stoneTex.repeat.set(roomW / 70, 1);
  const wallMat = new THREE.MeshLambertMaterial({ map: stoneTex, color: 0x3a2a24 });
  const wallDefs = [
    [roomW, wallH, 10, roomW / 2, wallH / 2, 0],      // back
    [10, wallH, roomD, 0, wallH / 2, roomD / 2],       // left
    [10, wallH, roomD, roomW, wallH / 2, roomD / 2],   // right
    [roomW, wallH, 10, roomW / 2, wallH / 2, roomD]    // near (entrance side)
  ];
  for (const [w, h, d, x, y, z] of wallDefs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wall.position.set(x, y, z);
    scene.add(wall);
  }
  // A simple raftered roof cap so it reads as enclosed from the chase cam.
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(roomW + 20, 10, roomD + 20),
    new THREE.MeshLambertMaterial({ color: 0x241712 })
  );
  roof.position.set(roomW / 2, wallH, roomD / 2);
  scene.add(roof);

  // ── Central hearth: a stone ring, a stack of logs, and a live flame glow.
  const hearthX = roomW / 2, hearthZ = roomD * 0.42;
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(58, 64, 20, 18),
    new THREE.MeshLambertMaterial({ color: 0x2c2420 })
  );
  ring.position.set(hearthX, 10, hearthZ);
  scene.add(ring);
  const logMat = new THREE.MeshLambertMaterial({ color: 0x3a2414 });
  for (let i = 0; i < 5; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 70, 7), logMat);
    log.position.set(hearthX + (Math.random() - 0.5) * 24, 20, hearthZ + (Math.random() - 0.5) * 24);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 5) * Math.PI;
    scene.add(log);
  }
  // Flame: a few emissive cones + a warm point light that is the room's heart.
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a1e });
  for (let i = 0; i < 4; i++) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(14 - i * 2, 46 - i * 6, 7), flameMat);
    flame.position.set(hearthX + (Math.random() - 0.5) * 16, 34 + i * 7, hearthZ + (Math.random() - 0.5) * 16);
    scene.add(flame);
  }
  const fire = new THREE.PointLight(0xff8830, 1.6, 620, 1.6);
  fire.position.set(hearthX, 70, hearthZ);
  scene.add(fire);

  // ── Bedrolls + benches: places to actually hole up. Bedrolls along the back
  // wall, benches flanking the fire.
  const bedMat = new THREE.MeshLambertMaterial({ color: 0x5a3a52 });
  const pillowMat = new THREE.MeshLambertMaterial({ color: 0x7a5a44 });
  for (const [bx, bz, rot] of [[roomW * 0.22, roomD * 0.18, 0], [roomW * 0.5, roomD * 0.16, 0], [roomW * 0.78, roomD * 0.18, 0]]) {
    const roll = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.BoxGeometry(70, 10, 150), bedMat);
    pad.position.y = 5;
    roll.add(pad);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(60, 16, 34), pillowMat);
    pillow.position.set(0, 12, -54);
    roll.add(pillow);
    roll.position.set(bx, 0, bz);
    roll.rotation.y = rot;
    scene.add(roll);
  }
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x4a3320 });
  for (const [bx, bz, rot] of [[hearthX - 150, hearthZ, Math.PI / 2], [hearthX + 150, hearthZ, -Math.PI / 2]]) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(120, 12, 34), benchMat);
    seat.position.y = 34;
    bench.add(seat);
    for (const lx of [-50, 50]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(12, 34, 30), benchMat);
      leg.position.set(lx, 17, 0);
      bench.add(leg);
    }
    bench.position.set(bx, 0, bz);
    bench.rotation.y = rot;
    scene.add(bench);
  }

  // ── Wall lanterns: small warm fills so the corners aren't pitch black.
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffb860 });
  for (const [lx, lz] of [[40, roomD * 0.3], [roomW - 40, roomD * 0.3], [40, roomD * 0.75], [roomW - 40, roomD * 0.75]]) {
    const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(12), lanternMat);
    lantern.position.set(lx, wallH * 0.62, lz);
    scene.add(lantern);
    const l = new THREE.PointLight(0xffa64d, 0.5, 300);
    l.position.set(lx, wallH * 0.62, lz);
    scene.add(l);
  }

  // ── EXIT sign over the near-wall door, matching the vault/cave interiors.
  if (typeof makeSignSprite === 'function') {
    const exitSign = makeSignSprite('EXIT');
    exitSign.position.set(roomW / 2, wallH * 0.58, roomD - 8);
    scene.add(exitSign);
  }
}

  return { buildRefugeScene };
}
