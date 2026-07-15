// ---------------------------------------------------------------------------
// Creatures & animals (Tier 3.4 Phase C). Cosmetic, server-authoritative fauna:
// town rabbits (animalVisuals pool) and the Wilds critters — embermoth, thistle-
// hog, duskfawn, mirefowl (animalVisuals2 pool). Each client builds a mesh the
// first time it hears an id, then interpolates toward server broadcasts. The two
// pools live in main (shared with targeting / mob-pools / debug) and are injected
// via get/set; the scenes are reassigned lets, injected as getters.
// ---------------------------------------------------------------------------
export default function createCreatures({ lerpAngle, makeHealthBarSprite, updateHealthBar, getOutdoorScene, getWildsScene, getAnimalVisuals, setAnimalVisuals, getAnimalVisuals2, setAnimalVisuals2 }) {
// ---------------------------------------------------------------------------
// Wildlife — a handful of rabbits wandering the open grass, purely cosmetic
// flavor. Positions/flee state are server-authoritative (see server.js) so
// every connected player sees the same rabbit doing the same thing — this
// client only builds the mesh the first time it hears about a given
// rabbit id and then interpolates toward whatever position the server
// broadcasts in 'wildlife_state' messages, exactly like remote players.
// ---------------------------------------------------------------------------
function makeRabbit() {
  const g = new THREE.Group();
  const furColors = [0xcfc2a8, 0xab8f6b, 0xe8e2d8];
  const fur = furColors[Math.floor(Math.random() * furColors.length)];
  const bodyMat = new THREE.MeshLambertMaterial({ color: fur });
  const body = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 8), bodyMat);
  body.scale.set(1.3, 0.85, 1);
  body.position.y = 6;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(4.2, 8, 8), bodyMat);
  head.position.set(0, 9, 7);
  g.add(head);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(1.2, 7, 6), bodyMat);
    ear.position.set(side * 2, 14, 7);
    ear.rotation.x = -0.3;
    g.add(ear);
  }
  const tail = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 6, 6),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  tail.position.set(0, 7, -7);
  g.add(tail);
  g.add(makeHealthBarSprite(22));
  return g;
}

// ── Session M peaceful critters (Wilds animals2 pool) ────────────────────
// Same low-poly chibi language as the rabbit — Lambert bodies, a couple of
// distinguishing shapes, and a small unlit "glow" accent — so the four read
// as distinct prey at a glance. A glowing eye/spot uses MeshBasicMaterial
// (unlit) exactly like the mobs' eyes.
function critterGlow(color, r) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 6, 6), new THREE.MeshBasicMaterial({ color }));
}
function makeEmbermoth() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x5a3a24 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 8), bodyMat);
  body.scale.set(1, 1, 2.1); body.position.y = 9; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), bodyMat);
  head.position.set(0, 9, 5.5); g.add(head);
  const wingMat = new THREE.MeshLambertMaterial({ color: 0xd8722a, emissive: 0x5a2a08 });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(6.5, 8, 8), wingMat);
    wing.scale.set(0.15, 1.05, 1.25);
    wing.position.set(side * 6.5, 9, 1); wing.rotation.z = side * 0.25;
    g.add(wing);
    const glow = critterGlow(0xffe0a0, 1.1); glow.position.set(side * 8, 9, -1); g.add(glow);
  }
  for (const side of [-1, 1]) {
    const eye = critterGlow(0xffd27a, 0.7); eye.position.set(side * 0.9, 9.6, 7); g.add(eye);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 4), bodyMat);
    ant.position.set(side * 1.2, 11.4, 6.4); ant.rotation.z = side * 0.5; g.add(ant);
  }
  g.add(makeHealthBarSprite(16));
  return g;
}
function makeThistlehog() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const spineMat = new THREE.MeshLambertMaterial({ color: 0x43301c });
  const body = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8), bodyMat);
  body.scale.set(1.35, 0.9, 1.1); body.position.y = 6; g.add(body);
  // spines fanned across the back
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 5), spineMat);
    const ang = (i / 7 - 0.5);
    s.position.set(ang * 8, 10.5, -1 + Math.cos(ang * 2) * 2);
    s.rotation.z = ang * 0.6; s.rotation.x = -0.2; g.add(s);
  }
  const snout = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), bodyMat);
  snout.scale.set(1, 0.8, 1.1); snout.position.set(0, 5, 7.5); g.add(snout);
  const nose = critterGlow(0x2a1c10, 0.9); nose.position.set(0, 5, 10); g.add(nose);
  for (const side of [-1, 1]) { const e = critterGlow(0xffcaa0, 0.5); e.position.set(side * 1.6, 6.5, 8.5); g.add(e); }
  g.add(makeHealthBarSprite(18));
  return g;
}
function makeDuskfawn() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x9a7346 });
  const paleMat = new THREE.MeshLambertMaterial({ color: 0xcbb089 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8), bodyMat);
  body.scale.set(1, 0.95, 1.5); body.position.y = 12; g.add(body);
  // slender legs
  for (const [sx, sz] of [[-3, 5], [3, 5], [-3, -5], [3, -5]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 12, 5), bodyMat);
    leg.position.set(sx, 6, sz); g.add(leg);
  }
  // neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2, 8, 6), bodyMat);
  neck.position.set(0, 17, 7); neck.rotation.x = 0.7; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), bodyMat);
  head.position.set(0, 21, 10); g.add(head);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(1.7, 6, 6), paleMat);
  muzzle.position.set(0, 20, 12.5); g.add(muzzle);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(1.3, 4, 5), bodyMat);
    ear.position.set(side * 2, 24, 8.5); ear.rotation.z = side * 0.5; g.add(ear);
    const eye = critterGlow(0xffe8c0, 0.7); eye.position.set(side * 1.7, 21.5, 12); g.add(eye);
  }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 6), paleMat);
  tail.position.set(0, 12, -9); g.add(tail);
  g.add(makeHealthBarSprite(28));
  return g;
}
function makeMirefowl() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x64788a });
  const wingMat = new THREE.MeshLambertMaterial({ color: 0x3f4f5e });
  const body = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8), bodyMat);
  body.scale.set(1, 1.1, 1.2); body.position.y = 8; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 8), bodyMat);
  head.position.set(0, 14, 4); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4, 5), new THREE.MeshLambertMaterial({ color: 0xe6b84a }));
  beak.position.set(0, 14, 8); beak.rotation.x = Math.PI / 2; g.add(beak);
  // one raised wing, as if flushing
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 8), wingMat);
    wing.scale.set(0.2, 1, 1.1); wing.position.set(side * 5.5, 10, 0); wing.rotation.z = side * -0.6; g.add(wing);
  }
  for (const [sx, sz] of [[-1.6, 0], [1.6, 0]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 5), new THREE.MeshLambertMaterial({ color: 0xcaa64a }));
    leg.position.set(sx, 2.5, sz); g.add(leg);
  }
  const eye = critterGlow(0xffd166, 0.6); eye.position.set(0.9, 15, 6.5); g.add(eye);
  g.add(makeHealthBarSprite(20));
  return g;
}
function makeCritter2(type) {
  switch (type) {
    case 'embermoth':  return makeEmbermoth();
    case 'thistlehog': return makeThistlehog();
    case 'duskfawn':   return makeDuskfawn();
    case 'mirefowl':   return makeMirefowl();
    default:           return makeRabbit();
  }
}


function addAnimals(scene) {
  for (const id in getAnimalVisuals()) scene.remove(getAnimalVisuals()[id].mesh);
  setAnimalVisuals({});
}

function getOrCreateAnimalVisual(id) {
  let v = getAnimalVisuals()[id];
  if (!v) {
    const mesh = makeRabbit();
    mesh.userData = { kind: 'animal', targetId: id };
    getOutdoorScene().add(mesh);
    v = getAnimalVisuals()[id] = {
      mesh, x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0,
      fleeing: false, hopPhase: Math.random() * Math.PI * 2, initialized: false, dead: false
    };
  }
  return v;
}

function applyAnimalState(list) {
  if (!getOutdoorScene()) return;
  for (const a of list) {
    const v = getOrCreateAnimalVisual(a.id);
    v.targetX = a.x; v.targetY = a.y; v.targetFacing = a.facing; v.fleeing = !!a.fleeing; v.dead = !!a.dead;
    if (!v.initialized) { v.x = a.x; v.y = a.y; v.facing = a.facing; v.initialized = true; }
    if (a.health !== undefined) {
      const hpBar = v.mesh.getObjectByName('healthBar');
      if (hpBar) updateHealthBar(hpBar, a.health, a.maxHealth);
    }
  }
}

function updateAnimalVisuals(dt) {
  const f = 1 - Math.exp(-dt * 8);
  for (const id in getAnimalVisuals()) {
    const v = getAnimalVisuals()[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);

    const moving = Math.hypot(v.targetX - v.x, v.targetY - v.y) > 1;
    v.hopPhase += dt * (v.fleeing ? 14 : 5);
    const hop = moving ? Math.abs(Math.sin(v.hopPhase)) * (v.fleeing ? 6 : 2.5) : 0;

    v.mesh.position.set(v.x, hop, v.y);
    v.mesh.rotation.y = v.facing;
    v.mesh.visible = !v.dead;
  }
}

// The Wilds' friendly animals — same rabbit, separate pool/scene since
// they're a wholly different population from town's (different spawns,
// different ids from the server).

function addAnimals2(scene) {
  for (const id in getAnimalVisuals2()) scene.remove(getAnimalVisuals2()[id].mesh);
  setAnimalVisuals2({});
}

function getOrCreateAnimal2Visual(id, type) {
  let v = getAnimalVisuals2()[id];
  if (!v) {
    const mesh = makeCritter2(type);
    mesh.userData = { kind: 'animal2', targetId: id };
    getWildsScene().add(mesh);
    v = getAnimalVisuals2()[id] = {
      mesh, critterType: type || 'rabbit', fly: type === 'embermoth',
      x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0,
      fleeing: false, hopPhase: Math.random() * Math.PI * 2, initialized: false, dead: false
    };
  } else if (type && v.critterType !== type) {
    // A recycled id changed species (rare — respawn reshuffles) — rebuild it.
    getWildsScene().remove(v.mesh);
    v.mesh = makeCritter2(type); v.mesh.userData = { kind: 'animal2', targetId: id };
    v.critterType = type; v.fly = type === 'embermoth';
    getWildsScene().add(v.mesh);
  }
  return v;
}

function applyAnimal2State(list) {
  if (!getWildsScene()) return;
  for (const a of list) {
    const v = getOrCreateAnimal2Visual(a.id, a.type);
    v.targetX = a.x; v.targetY = a.y; v.targetFacing = a.facing; v.fleeing = !!a.fleeing; v.dead = !!a.dead;
    if (!v.initialized) { v.x = a.x; v.y = a.y; v.facing = a.facing; v.initialized = true; }
    if (a.health !== undefined) {
      const hpBar = v.mesh.getObjectByName('healthBar');
      if (hpBar) updateHealthBar(hpBar, a.health, a.maxHealth);
    }
  }
}

function updateAnimal2Visuals(dt) {
  const f = 1 - Math.exp(-dt * 8);
  for (const id in getAnimalVisuals2()) {
    const v = getAnimalVisuals2()[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);

    const moving = Math.hypot(v.targetX - v.x, v.targetY - v.y) > 1;
    v.hopPhase += dt * (v.fleeing ? 14 : 5);
    // The Embermoth drifts (a low hover bob) instead of hopping.
    const bob = v.fly
      ? 10 + Math.sin(v.hopPhase * 0.6) * 3
      : (moving ? Math.abs(Math.sin(v.hopPhase)) * (v.fleeing ? 6 : 2.5) : 0);

    v.mesh.position.set(v.x, bob, v.y);
    v.mesh.rotation.y = v.facing;
    v.mesh.visible = !v.dead;
  }
}

  return { addAnimals, addAnimals2, applyAnimalState, applyAnimal2State, updateAnimalVisuals, updateAnimal2Visuals };
}
