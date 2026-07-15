// ---------------------------------------------------------------------------
// Ember Wastes scene (Tier 3.4 Phase C, 3D slice) — the Wilds-styled hostile
// outdoor map behind the temple portal. THREE global; prop-helpers + EMBER_WORLD
// injected; scene/camera/kiosk-lists/mob-visuals written back via get/set.
// ---------------------------------------------------------------------------
export default function createEmberScene({ makeGrassTexture, makeRock, makeTree, buildPortalMesh, EMBER_WORLD, setEmberScene, setEmberCamera, getEmberStaticKiosks, setEmberStaticKiosks, setEmberKiosks, getEmberMobVisuals, setEmberMobVisuals }) {
function buildEmberScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a0f0a);
  scene.fog = new THREE.Fog(0x2a0f0a, 500, 2200);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 4000);
  // Assign early so swapToEmberMap works even if geometry building throws below.
  setEmberScene(scene);
  setEmberCamera(camera);

  scene.add(new THREE.AmbientLight(0xff7755, 0.6));
  const emberSun = new THREE.DirectionalLight(0xff9966, 0.65);
  emberSun.position.set(300, 600, 200);
  scene.add(emberSun);

  const groundTex = makeGrassTexture();
  const groundSpan = Math.max(EMBER_WORLD.width, EMBER_WORLD.height) + 200;
  groundTex.repeat.set(groundSpan / 140, groundSpan / 140);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(EMBER_WORLD.width + 200, EMBER_WORLD.height + 200),
    new THREE.MeshLambertMaterial({ map: groundTex, color: 0xb87860 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(EMBER_WORLD.width / 2, 0, EMBER_WORLD.height / 2);
  scene.add(ground);

  // Scattered scorched-looking rocks/trees for atmosphere — purely cosmetic
  // (no harvesting, no collision), just breaking up the open field so it
  // reads as a wilder, wilds-like place rather than an empty box.
  const decorSpots = [
    [400, 400], [3600, 400], [400, 3600], [3600, 3600],
    [2000, 250], [2000, 3200], [250, 2000], [3750, 2000],
    [1200, 1000], [2800, 1000], [1200, 2800], [2800, 2800],
    [1500, 1900], [2500, 1900]
  ];
  decorSpots.forEach(([x, y], i) => {
    const group = (i % 2 === 0) ? makeRock(x, y, 1.1 + Math.random() * 0.5) : makeTree(x, y, 2.2 + Math.random() * 0.8);
    group.traverse(c => {
      if (c.isMesh && c.material && c.material.color) {
        c.material = c.material.clone();
        c.material.color.offsetHSL(0, 0, -0.08);
      }
    });
    scene.add(group);
  });

  // Return portal near spawn
  const exitX = EMBER_WORLD.spawn.x, exitY = EMBER_WORLD.spawn.y - 120;
  scene.add(buildPortalMesh(exitX, exitY));
  setEmberStaticKiosks([{ x: exitX, z: exitY, portal: 'ember_exit' }]);
  setEmberKiosks(getEmberStaticKiosks().slice());

  const _mv = getEmberMobVisuals(); for (const id in _mv) scene.remove(_mv[id].group);
  setEmberMobVisuals({});
}

  return { buildEmberScene };
}
