// ---------------------------------------------------------------------------
// Nature & plant props (Tier 3.4 Phase C, shared prop library). Pure THREE-
// group builders — trees, shrubs, rocks, flower patches, and the three plant
// bloom/mushroom/sprout shapes — plus the PLANT_VISUALS catalog and the
// deterministic plantSeed hash (internal). No deps; the scene-coupled decor
// placement (makePlant/applyDecorState/addNatureDecor) stays in main.
// ---------------------------------------------------------------------------
export function makeTree(x, z, scale) {
  const g = new THREE.Group();
  const s = scale || 1;
  const trunkH = 42 * s;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(4 * s, 5.5 * s, trunkH, 6),
    new THREE.MeshLambertMaterial({ color: 0x5a3d24 })
  );
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  // Every fifth-ish tree is a thornwood — plum-dark foliage, the trees the
  // town is named for. Deterministic from position so every client (and
  // every visit) grows the same forest.
  const thornwood = ((Math.abs(Math.round(x * 7)) + Math.abs(Math.round(z * 13))) % 5) === 0;
  const foliageColors = thornwood
    ? [0x4a2a5f, 0x543063, 0x3e2452]
    : [0x27543a, 0x2d5c40, 0x244d35];
  for (let i = 0; i < 3; i++) {
    const r = (24 - i * 5) * s;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, 28 * s, 8),
      new THREE.MeshLambertMaterial({ color: foliageColors[i] })
    );
    cone.position.y = trunkH + i * 15 * s + 8 * s;
    g.add(cone);
  }
  g.position.set(x, 0, z);
  g.userData.camFade = true; // tall enough to swallow the chase camera — see updateCamObstructions
  return g;
}

export function makeShrub(x, z, scale) {
  const g = new THREE.Group();
  const s = scale || 1;
  const colors = [0x2c5a3a, 0x27543a, 0x386947];
  for (let i = 0; i < 3; i++) {
    const r = (9 + Math.random() * 4) * s;
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(r, 8, 8),
      new THREE.MeshLambertMaterial({ color: colors[i] })
    );
    bush.position.set((Math.random() - 0.5) * 9 * s, r * 0.7, (Math.random() - 0.5) * 9 * s);
    g.add(bush);
  }
  g.position.set(x, 0, z);
  return g;
}

export function makeRock(x, z, scale) {
  const g = new THREE.Group();
  const s = scale || 1;
  const colors = [0x7a7a72, 0x6b6b63, 0x8a8a80];
  const n = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const r = (7 + Math.random() * 5) * s;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(r, 0),
      new THREE.MeshLambertMaterial({ color: colors[i % colors.length] })
    );
    rock.position.set((Math.random() - 0.5) * 10 * s, r * 0.55, (Math.random() - 0.5) * 10 * s);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    g.add(rock);
  }
  g.position.set(x, 0, z);
  return g;
}

export function makeFlowerPatch(x, z, scale) {
  const g = new THREE.Group();
  const s = scale || 1;
  const colors = [0xff6b9b, 0xffd43b, 0xf783ac, 0xffa94d, 0xeebbff];
  for (let i = 0; i < 7; i++) {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6 * s, 0.6 * s, 6 * s, 4),
      new THREE.MeshLambertMaterial({ color: 0x3a7a3f })
    );
    const px = (Math.random() - 0.5) * 16 * s, pz = (Math.random() - 0.5) * 16 * s;
    stem.position.set(px, 3 * s, pz);
    g.add(stem);
    const bloom = new THREE.Mesh(
      new THREE.SphereGeometry(2 * s, 6, 6),
      new THREE.MeshLambertMaterial({ color: colors[i % colors.length] })
    );
    bloom.position.set(px, 6.5 * s, pz);
    g.add(bloom);
  }
  g.position.set(x, 0, z);
  return g;
}

// ---------------------------------------------------------------------------
// Wilds flora — chunky low-poly trees & bushes to thicken the wilderness, all
// sized well above the player. The 6 trees flag userData.camFade so the chase
// camera ghosts them (like makeTree). Registered in PROP_BUILDERS (main.js)
// with per-type colliders — trees block movement, bushes are walk-through.
// Matches the THORNREACH-WILDS-FLORA.html design gallery.
// ---------------------------------------------------------------------------
function _lam(c, opts) { return new THREE.MeshLambertMaterial(Object.assign({ color: c }, opts || {})); }

export function makeWatchpine(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  const trunkH = 46 * s;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4.5 * s, 6.5 * s, trunkH, 6), _lam(0x4a3320));
  trunk.position.y = trunkH / 2; g.add(trunk);
  const greens = [0x1f4a30, 0x265a38, 0x2e6642, 0x367049];
  for (let i = 0; i < 4; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry((30 - i * 6) * s, 34 * s, 8), _lam(greens[i]));
    cone.position.y = trunkH + i * 22 * s + 8 * s; g.add(cone);
  }
  g.position.set(x, 0, z); g.userData.camFade = true; return g;
}

export function makeDeadwood(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  const wood = _lam(0x615868);
  const trunkH = 80 * s;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(3.5 * s, 6.5 * s, trunkH, 6), wood);
  trunk.position.y = trunkH / 2; g.add(trunk);
  const branches = [[1, 34, 1.0], [-1, 30, 1.1], [1, 26, 0.7], [-1, 22, 0.8]];
  for (let i = 0; i < branches.length; i++) {
    const [dir, len, tilt] = branches[i];
    const b = new THREE.Mesh(new THREE.CylinderGeometry(1.4 * s, 2.8 * s, len * s, 5), wood);
    b.position.set(0, trunkH * (0.72 + i * 0.05), 0);
    b.rotation.set(0, i * 1.7, tilt * dir);
    b.translateY(len * s * 0.42);
    g.add(b);
  }
  const glint = new THREE.Mesh(new THREE.SphereGeometry(2.2 * s, 6, 6), new THREE.MeshBasicMaterial({ color: 0x9fe0ff }));
  glint.position.set(1.5 * s, trunkH * 0.9, 1.5 * s); g.add(glint);
  g.position.set(x, 0, z); g.userData.camFade = true; return g;
}

export function makeMourningWillow(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  const trunkH = 52 * s;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(6 * s, 8 * s, trunkH, 6), _lam(0x4a3320));
  trunk.position.y = trunkH / 2; g.add(trunk);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(30 * s, 10, 8), _lam(0x3a7a6a));
  canopy.scale.y = 0.72; canopy.position.y = trunkH + 16 * s; g.add(canopy);
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI * 2 / 10;
    const fr = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * s, 1.6 * s, 34 * s, 4), _lam(0x347066));
    fr.position.set(Math.cos(a) * 24 * s, trunkH + 2 * s, Math.sin(a) * 24 * s);
    fr.rotation.z = Math.cos(a) * 0.34; fr.rotation.x = -Math.sin(a) * 0.34;
    g.add(fr);
  }
  g.position.set(x, 0, z); g.userData.camFade = true; return g;
}

export function makeCapwood(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  const stemH = 66 * s;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(9 * s, 12 * s, stemH, 8), _lam(0xefe6d2));
  stem.position.y = stemH / 2; g.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(34 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), _lam(0x8a5cf6));
  cap.position.y = stemH; g.add(cap);
  const gills = new THREE.Mesh(new THREE.CylinderGeometry(30 * s, 30 * s, 4 * s, 14), _lam(0x5a3a86));
  gills.position.y = stemH - 1 * s; g.add(gills);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1, rr = (7 + (i % 3) * 8) * s;
    const spot = new THREE.Mesh(new THREE.SphereGeometry((3 + (i % 2) * 1.5) * s, 6, 6), _lam(0xf4eeff));
    spot.position.set(Math.cos(a) * rr, stemH + (20 - (rr / s) * 0.32) * s, Math.sin(a) * rr); g.add(spot);
  }
  g.position.set(x, 0, z); g.userData.camFade = true; return g;
}

export function makeHexoak(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  const trunkH = 50 * s;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(7 * s, 10 * s, trunkH, 6), _lam(0x4a3320));
  trunk.position.y = trunkH / 2; g.add(trunk);
  const purples = [0x6a3f66, 0x7a4a72, 0x5e3a5c, 0x82527a];
  const blobs = [[0, 22, 30], [-24, 14, 20], [26, 16, 22], [0, 36, 24], [-14, 30, 18], [16, 32, 18]];
  for (let i = 0; i < blobs.length; i++) {
    const [bx, by, r] = blobs[i];
    const blob = new THREE.Mesh(new THREE.SphereGeometry(r * s, 8, 7), _lam(purples[i % purples.length]));
    blob.position.set(bx * s, trunkH + by * s, 0); g.add(blob);
  }
  g.position.set(x, 0, z); g.userData.camFade = true; return g;
}

export function makePalebirch(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  const trunks = [[-10, 58, 2.6], [4, 72, 3.0], [16, 52, 2.2]];
  for (const [tx, th, tr] of trunks) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(tr * s, (tr + 0.8) * s, th * s, 6), _lam(0xdcd6c8));
    trunk.position.set(tx * s, th * s / 2, 0); g.add(trunk);
    for (let m = 0; m < 3; m++) {
      const mk = new THREE.Mesh(new THREE.BoxGeometry(tr * 2.1 * s, 2 * s, 1 * s), _lam(0x2e2a30));
      mk.position.set(tx * s, th * (0.3 + m * 0.22) * s, tr * s); g.add(mk);
    }
  }
  const greens = [0x7a9a4a, 0x8caa54, 0x6f8f44];
  const canopies = [[-10, 60, 16], [4, 76, 22], [16, 54, 14]];
  for (let i = 0; i < canopies.length; i++) {
    const [cx, cy, r] = canopies[i];
    const c = new THREE.Mesh(new THREE.SphereGeometry(r * s, 8, 7), _lam(greens[i]));
    c.position.set(cx * s, cy * s, 0); g.add(c);
  }
  g.position.set(x, 0, z); g.userData.camFade = true; return g;
}

export function makeBramblebush(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  const greens = [0x2c5a3a, 0x27543a, 0x386947, 0x2f5f43];
  const blobs = [[0, 12, 15], [-11, 10, 12], [12, 11, 13], [2, 20, 12]];
  for (let i = 0; i < blobs.length; i++) {
    const [bx, by, r] = blobs[i];
    const b = new THREE.Mesh(new THREE.SphereGeometry(r * s, 8, 7), _lam(greens[i % greens.length]));
    b.position.set(bx * s, by * s, (i % 2 ? 4 : -4) * s); g.add(b);
  }
  g.position.set(x, 0, z); return g;
}

export function makeNightberry(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  const greens = [0x2a5a44, 0x316a4f, 0x367455];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry((11 + (i % 2) * 3) * s, 8, 7), _lam(greens[i % greens.length]));
    b.position.set(Math.cos(i * 1.7) * 9 * s, (10 + (i % 2) * 6) * s, Math.sin(i * 1.7) * 9 * s); g.add(b);
  }
  const berryMat = new THREE.MeshLambertMaterial({ color: 0x8a5cf6, emissive: 0x5a2ad0, emissiveIntensity: 0.5 });
  for (let i = 0; i < 8; i++) {
    const a = i * 0.9;
    const berry = new THREE.Mesh(new THREE.SphereGeometry(2.2 * s, 6, 6), berryMat);
    berry.position.set(Math.cos(a) * 12 * s, (12 + Math.sin(a * 1.3) * 6) * s, Math.sin(a) * 12 * s); g.add(berry);
  }
  g.position.set(x, 0, z); return g;
}

export function makeThornsnarl(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  const base = new THREE.Mesh(new THREE.SphereGeometry(13 * s, 8, 6), _lam(0x264a36));
  base.scale.y = 0.6; base.position.y = 8 * s; g.add(base);
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(2.4 * s, (16 + (i % 3) * 6) * s, 5), _lam(0x2f5a41));
    spike.position.set(Math.cos(a) * 8 * s, (14 + (i % 3) * 4) * s, Math.sin(a) * 8 * s);
    spike.rotation.z = Math.cos(a) * 0.4; spike.rotation.x = -Math.sin(a) * 0.4;
    g.add(spike);
  }
  g.position.set(x, 0, z); return g;
}

export function makeFenfern(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(3 * s, 30 * s, 4), _lam(0x4f9d63));
    frond.position.set(Math.cos(a) * 6 * s, 15 * s, Math.sin(a) * 6 * s);
    frond.rotation.z = Math.cos(a) * 0.7; frond.rotation.x = -Math.sin(a) * 0.7;
    g.add(frond);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(2.5 * s, 6, 6), _lam(0x5cb073));
    tip.position.set(Math.cos(a) * 15 * s, 26 * s, Math.sin(a) * 15 * s); g.add(tip);
  }
  g.position.set(x, 0, z); return g;
}

export function makeToadstoolRing(x, z, scale) {
  const g = new THREE.Group(); const s = scale || 1;
  const caps = [[0, 0, 1], [14, 6, 0.8], [-12, 8, 0.7], [6, -12, 0.75]];
  for (const [mx, mz, ms] of caps) {
    const stemH = 12 * s * ms;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(2.4 * s * ms, 3.2 * s * ms, stemH, 6), _lam(0xefe6d2));
    stem.position.set(mx * s, stemH / 2, mz * s); g.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(6 * s * ms, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), _lam(0xcf463a));
    cap.position.set(mx * s, stemH, mz * s); g.add(cap);
    const spot = new THREE.Mesh(new THREE.SphereGeometry(1.2 * s * ms, 5, 5), _lam(0xffffff));
    spot.position.set(mx * s + 2 * ms, stemH + 3 * s * ms, mz * s); g.add(spot);
  }
  g.position.set(x, 0, z); return g;
}

// ---------------------------------------------------------------------------
// The Wilds' 16 harvestable plants — each gets a distinct color and one of
// 3 simple shape families (bloom/mushroom/sprout) so all 16 read as
// different at a glance even without 16 fully bespoke models. Their actual
// gameplay differences (the 16 different effects) live server-side in
// PLANT_CATALOG; this is purely the look.
// ---------------------------------------------------------------------------
export const PLANT_VISUALS = {
  swift_root:           { shape: 'sprout',   color: 0xff9f4d },
  featherleaf:           { shape: 'sprout',   color: 0x9fe3a0 },
  giants_cap:             { shape: 'mushroom', color: 0xc0392b },
  shrinking_violet:       { shape: 'bloom',    color: 0x8a5fc0 },
  pumpkin_blossom:        { shape: 'bloom',    color: 0xff8a1f },
  bats_breath:            { shape: 'bloom',    color: 0x4a2a5a },
  rainbow_petal:          { shape: 'bloom',    color: 0xff6b9b },
  ravens_feather_plant:   { shape: 'sprout',   color: 0x2a1a22 },
  stumbleweed:            { shape: 'sprout',   color: 0xc9a227 },
  gibberish_root:         { shape: 'sprout',   color: 0xe0c08a },
  toadstool:              { shape: 'mushroom', color: 0xd83a3a },
  wolfsbane_bloom:        { shape: 'bloom',    color: 0x9b59b6 },
  meditation_lotus:       { shape: 'bloom',    color: 0xf783ac },
  healing_herb:           { shape: 'sprout',   color: 0x4caf50 },
  regen_root:             { shape: 'sprout',   color: 0xffd43b },
  cleansing_clover:       { shape: 'sprout',   color: 0x6fcf60 }
};

// ── Tier-3 plants: chunky, KayKit-flavored rebuilds of all three shapes.
// Same colors from PLANT_VISUALS, same anchor/scale contract (harvested
// look clones materials, so plain Lambert/emissive materials only), plus a
// faint emissive on the magical species so they breathe at night with the
// bloom pass. Deterministic per-position variation, no Math.random — every
// client grows the same plant.
function plantSeed(x, z) { return Math.abs(Math.sin(x * 12.9898 + z * 78.233)) % 1; }

export function makePlantBloom(x, z, color, glowy) {
  const g = new THREE.Group();
  const r = plantSeed(x, z);
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x2f6b3a });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.5, 10, 6), stemMat);
  stem.position.y = 5;
  stem.rotation.z = (r - 0.5) * 0.16;
  g.add(stem);
  // paired chunky leaves at the base
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3d8a4a });
  for (const sgn of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(2.4, 7, 6), leafMat);
    leaf.scale.set(1.25, 0.35, 0.7);
    leaf.position.set(sgn * 2.6, 1.6, (r - 0.5) * 2);
    leaf.rotation.z = sgn * 0.35;
    g.add(leaf);
  }
  // fat petal crown around a glowing heart
  const bloomMat = new THREE.MeshLambertMaterial({ color });
  const petals = 6;
  for (let i = 0; i < petals; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(2.6, 7, 6), bloomMat);
    const ang = (i / petals) * Math.PI * 2 + r;
    petal.scale.set(1, 0.45, 0.72);
    petal.position.set(Math.cos(ang) * 3.1, 10.6, Math.sin(ang) * 3.1);
    petal.rotation.y = -ang;
    petal.rotation.z = 0.35;
    g.add(petal);
  }
  const heartMat = new THREE.MeshLambertMaterial({ color: glowy ? color : 0xffd43b });
  if (glowy) { heartMat.emissive = new THREE.Color(color); heartMat.emissiveIntensity = 0.75; }
  const center = new THREE.Mesh(new THREE.SphereGeometry(2.0, 8, 7), heartMat);
  center.position.y = 11.2;
  g.add(center);
  g.rotation.y = r * Math.PI * 2;
  g.position.set(x, 0, z);
  return g;
}

export function makePlantMushroom(x, z, capColor, glowy) {
  const g = new THREE.Group();
  const r = plantSeed(x, z);
  const stemMat = new THREE.MeshLambertMaterial({ color: 0xf0e4cd });
  // fat kaykit-ish stem with a skirt ring
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.6, 6.5, 8), stemMat);
  stem.position.y = 3.2;
  g.add(stem);
  const skirt = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.55, 6, 10), stemMat);
  skirt.rotation.x = Math.PI / 2;
  skirt.position.y = 4.6;
  g.add(skirt);
  // big squashed cap with a chunky underside lip
  const capMat = new THREE.MeshLambertMaterial({ color: capColor });
  if (glowy) { capMat.emissive = new THREE.Color(capColor); capMat.emissiveIntensity = 0.4; }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(4.8, 10, 8), capMat);
  cap.scale.set(1, 0.68, 1);
  cap.position.y = 7.4;
  g.add(cap);
  const lipMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc4 });
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.6, 1.1, 10), lipMat);
  lip.position.y = 6.1;
  g.add(lip);
  // dotted spots, deterministic ring
  const spotMat = new THREE.MeshLambertMaterial({ color: 0xfff6e8 });
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + r * 6;
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.62 + (i % 2) * 0.3, 6, 6), spotMat);
    spot.scale.y = 0.5;
    spot.position.set(Math.cos(ang) * 2.7, 8.6 + Math.sin(i * 2.1) * 0.5, Math.sin(ang) * 2.7);
    g.add(spot);
  }
  // a tiny sprout buddy leaning on the stem
  const babyCap = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), capMat);
  babyCap.scale.set(1, 0.7, 1);
  babyCap.position.set(3.4, 1.8, (r - 0.5) * 3);
  g.add(babyCap);
  const babyStem = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.95, 1.8, 6), stemMat);
  babyStem.position.set(3.4, 0.9, (r - 0.5) * 3);
  g.add(babyStem);
  g.rotation.y = r * Math.PI * 2;
  g.position.set(x, 0, z);
  return g;
}

export function makePlantSprout(x, z, color, glowy) {
  const g = new THREE.Group();
  const r = plantSeed(x, z);
  const leafMat = new THREE.MeshLambertMaterial({ color });
  if (glowy) { leafMat.emissive = new THREE.Color(color); leafMat.emissiveIntensity = 0.35; }
  // chunky curled blades — flattened, bent cones ringed around a bud
  const blades = 5;
  for (let i = 0; i < blades; i++) {
    const ang = (i / blades) * Math.PI * 2 + r * 2;
    const h = 6.5 + ((i + 1) % 3) * 1.8;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.7, h, 6), leafMat);
    leaf.scale.z = 0.45;
    leaf.position.set(Math.cos(ang) * 2.1, h / 2 - 0.4, Math.sin(ang) * 2.1);
    leaf.rotation.y = -ang + Math.PI / 2;
    leaf.rotation.x = 0.18;
    leaf.rotation.z = Math.cos(ang) * -0.5;
    leaf.rotation.x += Math.sin(ang) * 0.5;
    g.add(leaf);
  }
  const budMat = new THREE.MeshLambertMaterial({ color: 0x2f6b3a });
  const bud = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), budMat);
  bud.scale.y = 0.8;
  bud.position.y = 1.2;
  g.add(bud);
  // little dirt mound so it sits planted, not floating
  const mound = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 6), new THREE.MeshLambertMaterial({ color: 0x4a3423 }));
  mound.scale.set(1.15, 0.28, 1.15);
  mound.position.y = 0.15;
  g.add(mound);
  g.rotation.y = r * Math.PI * 2;
  g.position.set(x, 0, z);
  return g;
}
