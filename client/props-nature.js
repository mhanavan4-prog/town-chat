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
