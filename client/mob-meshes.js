// ---------------------------------------------------------------------------
// Mob meshes (Tier 3.4 Phase C — the monster mesh library). makeMob2 dispatches
// to the four Wilds horrors (gloom bat, fen hexer, barrow maw, old marrowe);
// makeMob3 to the mob3 critters (bramble boar, mossback, gravecrow) via the
// MOB3_VISUALS table. Pure THREE/LEGEND_FX geometry — the makeMob base, the
// MOB2_VISUALS recolour table, and the health-bar sprite are injected; the mob
// visual pools that call makeMob2/makeMob3 stay in main.
// ---------------------------------------------------------------------------
export default function createMobMeshes({ makeMob, MOB2_VISUALS, makeHealthBarSprite }) {
function makeMob2(mobType) {
  // The distinctive Session M horrors get purpose-built rigs; everything else
  // (the original four + the Grave-Mite) is a recolored/rescaled base blob.
  if (mobType === 'gloom_bat')   return withHealthBar(makeGloomBat(), 24);
  if (mobType === 'fen_hexer')   return withHealthBar(makeFenHexer(), 28);
  if (mobType === 'barrow_maw')  return withHealthBar(makeBarrowMaw(), 34);
  if (mobType === 'old_marrowe') return withHealthBar(makeOldMarrowe(), 64);
  const visual = MOB2_VISUALS[mobType] || MOB2_VISUALS.night_howler;
  const g = makeMob();
  g.traverse(child => {
    if (!child.isMesh) return;
    const isEye = child.geometry.type === 'SphereGeometry' && child.geometry.parameters.radius < 2;
    child.material = child.material.clone();
    child.material.color.set(isEye ? visual.eyeColor : visual.color);
  });
  g.scale.setScalar(visual.scale);
  return g;
}

// Attaches the standard floating health bar to a hand-built creature group and
// returns it (the base makeMob() adds its own; the custom rigs use this).
function withHealthBar(g, y) { g.add(makeHealthBarSprite(y)); return g; }

function makeGloomBat() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1c1c26 });
  const wingMat = new THREE.MeshLambertMaterial({ color: 0x2c2233 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8), bodyMat);
  body.scale.set(1, 1.2, 1); body.position.y = 14; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(4.4, 8, 8), bodyMat);
  head.position.set(0, 22, 2); g.add(head);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(2, 6, 5), bodyMat);
    ear.position.set(side * 2.6, 27, 1); ear.rotation.z = side * 0.3; g.add(ear);
    // membranous wing — a flattened, swept sphere
    const wing = new THREE.Mesh(new THREE.SphereGeometry(11, 8, 6), wingMat);
    wing.scale.set(1.2, 0.7, 0.12); wing.position.set(side * 12, 15, -1); wing.rotation.z = side * 0.35; g.add(wing);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    eye.position.set(side * 1.8, 23, 5.5); g.add(eye);
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.2, 4), new THREE.MeshLambertMaterial({ color: 0xefe8d2 }));
    fang.position.set(side * 1.2, 19, 5); fang.rotation.x = Math.PI; g.add(fang);
  }
  return g;
}

function makeFenHexer() {
  const g = new THREE.Group();
  const robeMat = new THREE.MeshLambertMaterial({ color: 0x3a1a4a, emissive: 0x1a0a24 });
  // hooded robe: a broad cone tapering to a wisp
  const robe = new THREE.Mesh(new THREE.ConeGeometry(9, 26, 8), robeMat);
  robe.position.y = 16; g.add(robe);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8), robeMat);
  hood.position.set(0, 28, 1.5); g.add(hood);
  // dark hood opening
  const face = new THREE.Mesh(new THREE.SphereGeometry(3.6, 8, 8), new THREE.MeshBasicMaterial({ color: 0x140820 }));
  face.position.set(0, 27, 5); g.add(face);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xd8b0ff }));
    eye.position.set(side * 1.5, 28, 7.5); g.add(eye);
  }
  // a hex-orb it holds ready
  const orb = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xb98aff }));
  orb.position.set(6, 16, 8); g.add(orb);
  g.userData.hexOrb = orb;
  return g;
}

function makeBarrowMaw() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x6a5038 });
  const clawMat = new THREE.MeshLambertMaterial({ color: 0xd8d0b8 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(10, 8, 8), bodyMat);
  body.scale.set(1, 0.9, 1); body.position.y = 11; g.add(body);
  // gaping maw (dark) + teeth ring
  const maw = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8), new THREE.MeshBasicMaterial({ color: 0x160b06 }));
  maw.scale.set(1, 0.7, 0.6); maw.position.set(0, 10, 9); g.add(maw);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3, 4), clawMat);
    tooth.position.set(Math.cos(a) * 4.5, 10 + Math.sin(a) * 3, 11.5);
    tooth.rotation.z = a - Math.PI / 2; g.add(tooth);
  }
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.4, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
    eye.position.set(side * 4, 18, 6); g.add(eye);
    // erupting claws either side
    const claw = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 5), clawMat);
    claw.position.set(side * 11, 12, 2); claw.rotation.z = side * -0.5; g.add(claw);
  }
  return g;
}

function makeOldMarrowe() {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const cloakMat = new THREE.MeshLambertMaterial({ color: 0x241826 });
  const headMat = new THREE.MeshLambertMaterial({ color: 0x9a6a34, emissive: 0x3a1a08 });
  // cross-frame
  const post = new THREE.Mesh(new THREE.BoxGeometry(2.6, 44, 2.6), frameMat);
  post.position.y = 22; g.add(post);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(28, 2.6, 2.6), frameMat);
  beam.position.y = 30; g.add(beam);
  // ragged cloak (broad cone)
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(13, 34, 8, 1, true), cloakMat);
  cloak.position.y = 20; g.add(cloak);
  // burlap head
  const head = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 8), headMat);
  head.scale.set(1, 1.15, 1); head.position.y = 42; g.add(head);
  // glowing eyes + stitched grin
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3, 4), new THREE.MeshBasicMaterial({ color: 0xff5a4a }));
    eye.position.set(side * 2.6, 43, 6); eye.rotation.x = Math.PI / 2; g.add(eye);
  }
  const grin = new THREE.Mesh(new THREE.BoxGeometry(7, 0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0x160b06 }));
  grin.position.set(0, 39, 6.5); g.add(grin);
  // straw at the arm ends
  for (const side of [-1, 1]) {
    const straw = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 5), new THREE.MeshLambertMaterial({ color: 0xcaa552 }));
    straw.position.set(side * 13, 30, 0); straw.rotation.z = side * Math.PI / 2; g.add(straw);
  }
  return g;
}

// ── Session M neutral creatures (mobs3 pool) — custom rigs, always rendered
// (they're out day and night). A red glint in the eye when provoked is a nice
// tell, but the base build is calm-coloured. ──
const MOB3_VISUALS = {
  bramble_boar:      { scale: 1.2 },
  mossback_tortoise: { scale: 1.3 },
  gravewing_crow:    { scale: 0.8 },
};
function makeBrambleBoar() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x494a2c });
  const bristleMat = new THREE.MeshLambertMaterial({ color: 0x2f3018 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(9, 8, 8), bodyMat);
  body.scale.set(1.5, 0.95, 1.1); body.position.y = 9; g.add(body);
  for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4, 4), bristleMat); const t = (i / 8 - 0.5); b.position.set(t * 16, 15, -1); b.rotation.z = t * 0.5; g.add(b); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8), bodyMat);
  head.position.set(-13, 8, 0); g.add(head);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(2.6, 6, 6), bristleMat); snout.position.set(-19, 7, 0); g.add(snout);
  for (const side of [-1, 1]) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4.5, 4), new THREE.MeshLambertMaterial({ color: 0xe8e2cf }));
    tusk.position.set(-18, 9, side * 2); tusk.rotation.x = side * 0.4; tusk.rotation.z = 0.6; g.add(tusk);
  }
  for (const [sx, sz] of [[-9, 4], [5, 4], [-9, -4], [5, -4]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.2, 8, 5), bristleMat); leg.position.set(sx, 4, sz); g.add(leg); }
  g.add(makeEyePair(-15, 10, 4, 0xff9a4a, 0.9));
  g.add(makeHealthBarSprite(22));
  return g;
}
function makeMossback() {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshLambertMaterial({ color: 0x46583a });
  const mossMat = new THREE.MeshLambertMaterial({ color: 0x7fae54 });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0x6a604a });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(11, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
  shell.scale.set(1.15, 1, 1.15); shell.position.y = 7; g.add(shell);
  for (const [dx, dz] of [[-5, -3], [4, -5], [0, 4], [6, 2], [-4, 5]]) { const moss = new THREE.Mesh(new THREE.SphereGeometry(2.2, 6, 6), mossMat); moss.position.set(dx, 12, dz); moss.scale.y = 0.5; g.add(moss); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(3.6, 8, 8), skinMat); head.position.set(-11, 6, 0); g.add(head);
  for (const [sx, sz] of [[-9, 7], [7, 7], [-9, -7], [7, -7]]) { const leg = new THREE.Mesh(new THREE.SphereGeometry(2.6, 6, 6), skinMat); leg.position.set(sx, 3, sz); g.add(leg); }
  g.add(makeEyePair(-13, 7, 2.5, 0xc6ec95, 0.7));
  g.add(makeHealthBarSprite(24));
  return g;
}
function makeGravecrow() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a1a24 });
  const sheenMat = new THREE.MeshLambertMaterial({ color: 0x2a1a44, emissive: 0x160a26 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8), bodyMat);
  body.scale.set(0.9, 1.3, 1); body.position.y = 10; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(3.6, 8, 8), bodyMat); head.position.set(0, 18, 3); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 4), new THREE.MeshLambertMaterial({ color: 0x6a6a52 })); beak.position.set(0, 18, 7); beak.rotation.x = Math.PI / 2; g.add(beak);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), sheenMat); wing.scale.set(0.25, 1.2, 0.8); wing.position.set(side * 5, 10, -1); wing.rotation.z = side * 0.3; g.add(wing);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 6), new THREE.MeshBasicMaterial({ color: 0xb98aff })); eye.position.set(side * 1.5, 19, 5.5); g.add(eye);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(2.5, 8, 4), sheenMat); tail.position.set(0, 8, -7); tail.rotation.x = -1.3; g.add(tail);
  g.add(makeHealthBarSprite(22));
  return g;
}
function makeEyePair(x, y, z, color, r) {
  const grp = new THREE.Group();
  for (const side of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 6), new THREE.MeshBasicMaterial({ color })); e.position.set(x, y, z + side * 1.6); grp.add(e); }
  return grp;
}
function makeMob3(mobType) {
  const g = mobType === 'bramble_boar' ? makeBrambleBoar()
    : mobType === 'mossback_tortoise' ? makeMossback()
    : mobType === 'gravewing_crow' ? makeGravecrow()
    : makeBrambleBoar();
  const vis = MOB3_VISUALS[mobType];
  if (vis && vis.scale) g.scale.setScalar(vis.scale);
  return g;
}

  return { makeMob2, makeMob3 };
}
