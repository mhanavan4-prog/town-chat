// ---------------------------------------------------------------------------
// Ember Wastes scene (Tier 3.4 Phase C, 3D slice) — the Wilds-styled hostile
// outdoor map behind the temple portal. THREE global; prop-helpers + EMBER_WORLD
// injected; scene/camera/kiosk-lists/mob-visuals written back via get/set.
// ---------------------------------------------------------------------------
export default function createEmberScene({ makeGrassTexture, makeRock, makeTree, buildPortalMesh, EMBER_WORLD, emberHeightAt, setEmberScene, setEmberCamera, getEmberStaticKiosks, setEmberStaticKiosks, setEmberKiosks, getEmberMobVisuals, setEmberMobVisuals }) {
const H = (x, z) => (typeof emberHeightAt === 'function' ? emberHeightAt(x, z) : 0);
function buildEmberScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a0f0a);
  // A vast zone (20000²): push the view distance + fog out so the scorched
  // dunes recede into haze rather than a hard wall a few strides ahead.
  scene.fog = new THREE.Fog(0x2a0f0a, 900, 5200);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 6, 7000);
  // Assign early so swapToEmberMap works even if geometry building throws below.
  setEmberScene(scene);
  setEmberCamera(camera);

  scene.add(new THREE.AmbientLight(0xff7755, 0.6));
  const emberSun = new THREE.DirectionalLight(0xff9966, 0.65);
  emberSun.position.set(300, 600, 200);
  scene.add(emberSun);

  // Rolling, displaced ground — a segmented plane draped over the ember
  // heightfield (same technique as the Wilds' moor) so the zone reads as
  // scorched dunes, not a flat sheet.
  const groundTex = makeGrassTexture();
  const cx0 = EMBER_WORLD.width / 2, cz0 = EMBER_WORLD.height / 2;
  const span = Math.max(EMBER_WORLD.width, EMBER_WORLD.height) + 400;
  groundTex.repeat.set(span / 140, span / 140);
  const groundGeo = new THREE.PlaneGeometry(EMBER_WORLD.width + 400, EMBER_WORLD.height + 400, 200, 200);
  groundGeo.rotateX(-Math.PI / 2);
  { const gp = groundGeo.attributes.position;
    for (let i = 0; i < gp.count; i++) gp.setY(i, H(cx0 + gp.getX(i), cz0 + gp.getZ(i)));
    gp.needsUpdate = true; groundGeo.computeVertexNormals(); }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ map: groundTex, color: 0xb87860 }));
  ground.position.set(cx0, 0, cz0);
  scene.add(ground);

  // Scattered scorched rocks + dead trees for atmosphere — cosmetic (no
  // harvest, no collision), each sitting ON the dunes via the heightfield.
  // Spread across the whole big zone with a seeded scatter so it never reads
  // as an empty box, plus a few clustered "boneyards" as landmarks.
  let seed = 0x1a2b3c4d;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const W = EMBER_WORLD.width, Hh = EMBER_WORLD.height, m = 500;
  const spots = [];
  for (let i = 0; i < 150; i++) spots.push([m + rnd() * (W - m * 2), m + rnd() * (Hh - m * 2)]);
  // Three denser boneyard clusters as visual landmarks.
  for (const [cx, cz] of [[5000, 6000], [15000, 8000], [10000, 3000]]) {
    for (let i = 0; i < 14; i++) spots.push([cx + (rnd() - 0.5) * 2400, cz + (rnd() - 0.5) * 2400]);
  }
  spots.forEach(([x, y], i) => {
    const group = (i % 2 === 0) ? makeRock(x, y, 1.1 + rnd() * 0.9) : makeTree(x, y, 2.2 + rnd() * 1.4);
    group.position.y += H(x, y); // ride the dunes
    group.traverse(c => {
      if (c.isMesh && c.material && c.material.color) {
        c.material = c.material.clone();
        c.material.color.offsetHSL(0, 0, -0.08);
      }
    });
    scene.add(group);
  });

  // Return portal near spawn (in the flattened arrival haven, so y≈0).
  const exitX = EMBER_WORLD.spawn.x, exitY = EMBER_WORLD.spawn.y - 120;
  const portal = buildPortalMesh(exitX, exitY);
  portal.position.y += H(exitX, exitY);
  scene.add(portal);
  setEmberStaticKiosks([{ x: exitX, z: exitY, portal: 'ember_exit' }]);
  setEmberKiosks(getEmberStaticKiosks().slice());

  const _mv = getEmberMobVisuals(); for (const id in _mv) scene.remove(_mv[id].group);
  setEmberMobVisuals({});
}

  return { buildEmberScene };
}
