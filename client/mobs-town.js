// ---------------------------------------------------------------------------
// Town mobs (Tier 3.4 Phase C — first mob-variant slice). The town's hostile
// mobs: the makeMob mesh plus spawn/apply/update over the server-driven
// mobVisuals pool. The pool lives in main (targeting, mobRenderPos, and the
// debug snapshot read it) and is injected via get/set; the active scene and the
// day/night flag are reassigned lets, injected as getters.
// ---------------------------------------------------------------------------
export default function createMobsTown({ getMobVisuals, setMobVisuals, getOutdoorScene, getLastWildlifeIsNight, lerpAngle, makeHealthBarSprite, updateHealthBar }) {
function makeMob() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a1a33 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(11, 8, 8), bodyMat);
  body.scale.set(1, 0.8, 1.1);
  body.position.y = 11;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(6.5, 8, 8), bodyMat);
  head.position.set(0, 20, 6);
  g.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.3, 6, 6), eyeMat);
    eye.position.set(side * 2.6, 21, 11.5);
    g.add(eye);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 6), bodyMat);
    horn.position.set(side * 3.2, 26, 4);
    horn.rotation.z = side * 0.3;
    g.add(horn);
  }
  g.add(makeHealthBarSprite(35));
  return g;
}


function addMobs(scene) {
  for (const id in getMobVisuals()) scene.remove(getMobVisuals()[id].mesh);
  setMobVisuals({});
}

function getOrCreateMobVisual(id) {
  let v = getMobVisuals()[id];
  if (!v) {
    const mesh = makeMob();
    mesh.visible = false;
    mesh.userData = { kind: 'mob', targetId: id };
    getOutdoorScene().add(mesh);
    v = getMobVisuals()[id] = { mesh, x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0, initialized: false, dead: false };
  }
  return v;
}

function applyMobState(list) {
  if (!getOutdoorScene()) return;
  for (const m of list) {
    const v = getOrCreateMobVisual(m.id);
    v.targetX = m.x; v.targetY = m.y; v.targetFacing = m.facing; v.dead = !!m.dead;
    v.hasLoot = !!m.hasLoot;
    if (!v.initialized) { v.x = m.x; v.y = m.y; v.facing = m.facing; v.initialized = true; }
    if (m.health !== undefined) {
      const hpBar = v.mesh.getObjectByName('healthBar');
      if (hpBar) updateHealthBar(hpBar, m.health, m.maxHealth);
    }
  }
}

function updateMobVisuals(dt) {
  const f = 1 - Math.exp(-dt * 8);
  for (const id in getMobVisuals()) {
    const v = getMobVisuals()[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);
    v.mesh.position.set(v.x, 0, v.y);
    v.mesh.rotation.y = v.facing;
    v.mesh.visible = getLastWildlifeIsNight() && !v.dead;
  }
}

  return { makeMob, addMobs, applyMobState, updateMobVisuals };
}
