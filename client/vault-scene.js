// ---------------------------------------------------------------------------
// Bank Vault scene (Tier 3.4 Phase C — first 3D-bulk slice). A small self-
// contained interior builder. THREE is a global (loaded from the CDN before
// the bundle); prop-helpers and VAULT_WORLD are injected; the built scene and
// camera are handed back to main via setters (main keeps vaultScene/
// vaultCamera because the active-scene checks read them).
// ---------------------------------------------------------------------------
export default function createVaultScene({ makeStoneTexture, makeSignSprite, buildInteriorDoorway, VAULT_WORLD, setVaultScene, setVaultCamera }) {
function buildVaultScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1408);
  scene.fog = new THREE.Fog(0x1a1408, 250, 700);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 1400);
  setVaultScene(scene);
  setVaultCamera(camera);

  const roomW = VAULT_WORLD.width, roomD = VAULT_WORLD.height, wallH = 150;
  scene.add(new THREE.AmbientLight(0xffd9a0, 0.55));

  const stoneTex = makeStoneTexture();
  stoneTex.repeat.set(roomW / 60, roomD / 60);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW, roomD),
    new THREE.MeshLambertMaterial({ map: stoneTex, color: 0xc9a86a })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, roomD / 2);
  scene.add(floor);

  const wallMat = new THREE.MeshLambertMaterial({ color: 0x3a3226 });
  const wallDefs = [
    [roomW, wallH, 8, roomW / 2, wallH / 2, 0],           // back (far from entrance)
    [8, wallH, roomD, 0, wallH / 2, roomD / 2],            // left
    [8, wallH, roomD, roomW, wallH / 2, roomD / 2],        // right
    [roomW, wallH, 8, roomW / 2, wallH / 2, roomD]         // near (entrance side)
  ];
  for (const [w, h, d, x, y, z] of wallDefs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wall.position.set(x, y, z);
    scene.add(wall);
  }

  // EXIT sign and a faint glow near the entrance, matching the interior
  // door pattern used elsewhere (see buildInteriorDoorway).
  const exitSign = makeSignSprite('EXIT');
  exitSign.position.set(roomW / 2, wallH * 0.6, roomD - 6);
  scene.add(exitSign);

  const goldMat = new THREE.MeshLambertMaterial({ color: 0xd4af37, emissive: 0x4a3a10, emissiveIntensity: 0.45 });
  // Several coin piles scattered across the room
  const pileSpots = [
    [roomW * 0.3, roomD * 0.35], [roomW * 0.7, roomD * 0.3], [roomW * 0.5, roomD * 0.55],
    [roomW * 0.22, roomD * 0.65], [roomW * 0.78, roomD * 0.6]
  ];
  for (const [px, pz] of pileSpots) {
    for (let i = 0; i < 4; i++) {
      const r = 24 - i * 4;
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 5, 16), goldMat);
      coin.position.set(px + (Math.random() - 0.5) * 6, 12 + i * 6, pz + (Math.random() - 0.5) * 6);
      coin.rotation.z = (Math.random() - 0.5) * 0.15;
      scene.add(coin);
    }
  }
  // Gold bars stacked near the back wall
  for (let i = 0; i < 6; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 12), goldMat);
    bar.position.set(roomW * 0.5 + (i % 3 - 1) * 26, 10 + Math.floor(i / 3) * 11, roomD * 0.15);
    scene.add(bar);
  }
  // Loose gems scattered among the piles
  const gemColors = [0xff3355, 0x33ccff, 0x66ff66, 0xcc66ff, 0xffaa33];
  for (let i = 0; i < 14; i++) {
    const color = gemColors[i % gemColors.length];
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(5 + Math.random() * 3),
      new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 })
    );
    gem.position.set(roomW * 0.1 + Math.random() * roomW * 0.8, 6 + Math.random() * 25, roomD * 0.15 + Math.random() * roomD * 0.6);
    scene.add(gem);
  }
  // A few open treasure chests along the side walls
  for (const [px, pz, rotY] of [[24, roomD * 0.3, Math.PI / 2], [roomW - 24, roomD * 0.3, -Math.PI / 2], [24, roomD * 0.7, Math.PI / 2]]) {
    const chest = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(28, 16, 20), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
    body.position.y = 8;
    chest.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(28, 10, 20), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
    lid.position.set(0, 18, -8);
    lid.rotation.x = -1.1;
    chest.add(lid);
    const spill = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 3, 12), goldMat);
    spill.position.y = 17;
    chest.add(spill);
    chest.position.set(px, 0, pz);
    chest.rotation.y = rotY;
    scene.add(chest);
  }

  // Warm glowing lights spread through the room so the treasure actually
  // shimmers instead of sitting in flat shadow.
  for (const [lx, lz] of [[roomW * 0.3, roomD * 0.35], [roomW * 0.7, roomD * 0.35], [roomW * 0.5, roomD * 0.6]]) {
    const glow = new THREE.PointLight(0xffcc66, 1.1, 180);
    glow.position.set(lx, 60, lz);
    scene.add(glow);
  }
}

  return { buildVaultScene };
}
