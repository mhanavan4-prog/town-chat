// ---------------------------------------------------------------------------
// Personal Dungeon scene (Tier 3.4 Phase C, 3D slice) — the procedural tiered
// dungeon + delve cave builder and its sigil texture. THREE is a global;
// buildPortalMesh and the DUNGEON_LAYOUTS/DUNGEON_CAVE_THEMES tables are
// injected; scene/camera/mob-visuals are written back via setters, and the
// per-entry kiosk list via get/set (it's rebuilt then pushed to).
// ---------------------------------------------------------------------------
export default function createDungeonScene({ buildPortalMesh, DUNGEON_LAYOUTS, DUNGEON_CAVE_THEMES, kkStatic, hasKK, getDungeonScene, setDungeonScene, setDungeonCamera, getDungeonKiosks, setDungeonKiosks, setDungeonMobVisuals, getBuiltDungeonTier, setBuiltDungeonTier }) {
// Drop a KayKit dungeon-pack prop (static, shared-material) into the scene at a
// floor position. Returns the group (or null if the model hasn't streamed in),
// so callers can tweak rotation. `mode` is 'fit' (largest footprint = size) or
// 'height'. Props sit with their base at y=0.
function kkProp(scene, key, x, z, size, mode, roty, tilt) {
  if (!kkStatic || !hasKK || !hasKK(key)) return null;
  const g = kkStatic(key, size, mode || 'fit');
  if (!g) return null;
  g.position.set(x, 0, z);
  if (roty) g.rotation.y = roty;
  if (tilt) g.rotation.x = tilt;
  scene.add(g);
  return g;
}
// A glowing red arcane sigil drawn to a canvas — used as an EMISSIVE MAP on
// the rock so the mark reads as the stone itself glowing, not a decal.
function makeCaveSigilTexture(variant) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#000000'; g.fillRect(0, 0, 128, 128);
  g.translate(64, 64);
  g.strokeStyle = '#ffffff'; g.lineWidth = 4;
  g.shadowColor = '#ffffff'; g.shadowBlur = 10;
  g.beginPath(); g.arc(0, 0, 46, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, 37, 0, Math.PI * 2); g.stroke();
  const points = 5 + (variant % 3) * 2;
  const skip = Math.floor(points / 2);
  g.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = -Math.PI / 2 + (i * skip) * (Math.PI * 2) / points;
    const x = Math.cos(a) * 33, y = Math.sin(a) * 33;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * 48, Math.sin(a) * 48);
    g.lineTo(Math.cos(a) * 56, Math.sin(a) * 56);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}
let rootcellarSigilTextures = null;
function buildDungeonCaveScene(theme, layout) {
  const scene = new THREE.Scene();
  const BG = theme.bg;
  scene.background = new THREE.Color(BG);
  // Fog pulled well back (was 950/2200): the arena is 1200 across, so at the
  // old near-plane mobs a lane or two away were already hazing out. Now the
  // whole fighting floor reads clearly and the murk only closes in past the
  // far walls — moody, but nothing hides in it.
  scene.fog = new THREE.Fog(BG, 1250, 2800);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 2800);

  // A touch brighter than before (amb 1.0→1.3, hemi 0.7→0.95) so creatures
  // read against the dark stone without washing out the cave mood.
  scene.add(new THREE.AmbientLight(theme.amb, 1.3));
  scene.add(new THREE.HemisphereLight(theme.hemiTop, theme.hemiBot, 0.95));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshLambertMaterial({ color: theme.floor }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(600, 0, 600);
  scene.add(floor);

  if (!rootcellarSigilTextures) rootcellarSigilTextures = [0, 1, 2, 3].map(v => makeCaveSigilTexture(v));
  const plainRock = new THREE.MeshLambertMaterial({ color: theme.rock });
  let sigilTexN = 0;
  const WALL_H = 150;
  const rockFloorPieces = ['ruin_rubble', 'ruin_rocks2', 'ruin_rubble2', 'ruin_rocks'];
  // Walls follow each wall rect along its LONG axis. The maze barriers are now
  // real KayKit dungeon-pack walls (ruin_wall), with the original glowing
  // boulder ridge kept as a fallback for any piece whose model hasn't streamed
  // in yet, so the layout is never missing its lanes.
  for (const w of layout.walls) {
    const horiz = w.w >= w.h;
    const longLen = horiz ? w.w : w.h;
    const nChunks = Math.max(3, Math.round(longLen / 104));
    const seg = longLen / nChunks;
    const cxShort = w.x + w.w / 2, czShort = w.y + w.h / 2;
    for (let i = 0; i < nChunks; i++) {
      const t = (i + 0.5) / nChunks;
      const rx = horiz ? (w.x + t * w.w) : cxShort;
      const rz = horiz ? czShort : (w.y + t * w.h);
      const wall = kkProp(scene, 'ruin_wall', rx, rz, seg * 1.12, 'fit', horiz ? 0 : Math.PI / 2);
      if (!wall) {
        // Fallback: the original glowing boulder chunk.
        const r = 42 + (i % 3) * 4;
        let mat;
        if (i % 2 === 0) {
          const tex = rootcellarSigilTextures[sigilTexN++ % rootcellarSigilTextures.length];
          mat = new THREE.MeshLambertMaterial({ color: theme.rock, emissive: theme.glow, emissiveMap: tex, emissiveIntensity: 1.25 });
        } else { mat = plainRock; }
        const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat);
        chunk.position.set(rx, WALL_H * 0.42, rz);
        chunk.rotation.set(i * 0.6, i * 1.1, i * 0.4);
        chunk.scale.set(horiz ? 1.05 : 0.62, WALL_H / (r * 1.6), horiz ? 0.62 : 1.05);
        scene.add(chunk);
      } else if (i % 2 === 1) {
        // Low rubble tucked against the wall base (offset to its SHORT side so
        // it never spills into a combat lane) — the "different rocks" that stay
        // out of the sightline instead of the old floor-wide spikes.
        const off = 26, pick = rockFloorPieces[(sigilTexN++) % rockFloorPieces.length];
        kkProp(scene, pick, rx + (horiz ? 0 : off), rz + (horiz ? off : 0), 24, 'fit', i * 1.3);
      }
    }
  }

  // Glowing lanterns strung along this layout's lanes + entry + boss chamber.
  for (const [lx, lz] of layout.lanterns) {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(8, 10, 10),
      new THREE.MeshBasicMaterial({ color: theme.lantern }));
    orb.position.set(lx, 175, lz);
    scene.add(orb);
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 40, 4),
      new THREE.MeshLambertMaterial({ color: theme.hook }));
    hook.position.set(lx, 198, lz);
    scene.add(hook);
    const light = new THREE.PointLight(theme.lanternLight, 1.5, 640);
    light.position.set(lx, 175, lz);
    scene.add(light);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: LEGEND_FX.glowTexture(), color: theme.lantern, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(64, 64, 1); glow.position.set(lx, 175, lz);
    scene.add(glow);
  }

  const bx = layout.boss.x, bz = layout.boss.y;
  // Floor dressing (replaces the 30 tall stalagmite spikes that used to be
  // scattered — and hang from the ceiling — right across the fighting floor,
  // hiding mobs). Low KayKit rubble & rocks hug the four corners and the arena
  // rim only; nothing stands over ankle height in the open, so a creature is
  // never lost behind the scenery. Each is kept well clear of the boss circle.
  const cornerClusters = [[150, 150], [1050, 150], [150, 1050], [1050, 1050], [600, 90], [90, 600], [1110, 600], [600, 1110]];
  let dN = 0;
  for (const [cxp, czp] of cornerClusters) {
    const nRock = 2 + (dN % 2);
    for (let k = 0; k < nRock; k++) {
      const jx = cxp + (((dN * 53) % 70) - 35), jz = czp + (((dN * 89) % 70) - 35);
      if (Math.hypot(jx - bx, jz - bz) < 240) { dN++; continue; }
      const pick = rockFloorPieces[dN % rockFloorPieces.length];
      const sz = 20 + (dN % 3) * 8;
      if (!kkProp(scene, pick, jx, jz, sz, 'fit', dN * 1.7)) {
        // Fallback: a squat boulder (low, never a spike) if KK hasn't streamed.
        const b = new THREE.Mesh(new THREE.DodecahedronGeometry(sz * 0.6, 0), plainRock);
        b.position.set(jx, sz * 0.3, jz); b.scale.y = 0.5; scene.add(b);
      }
      dN++;
    }
  }

  // Boss chamber: glowing summoning circle, coloured light, crown of crystals.
  const circle = new THREE.Mesh(new THREE.RingGeometry(100, 230, 48),
    new THREE.MeshBasicMaterial({ map: makeCaveSigilTexture(1), color: theme.accent, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(bx, 2, bz);
  scene.add(circle);
  const innerCircle = new THREE.Mesh(new THREE.CircleGeometry(96, 48),
    new THREE.MeshBasicMaterial({ map: makeCaveSigilTexture(2), color: theme.accent, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
  innerCircle.rotation.x = -Math.PI / 2;
  innerCircle.position.set(bx, 2, bz);
  scene.add(innerCircle);
  const bossLight = new THREE.PointLight(theme.glow, 2.2, 1000);
  bossLight.position.set(bx, 190, bz);
  scene.add(bossLight);
  const bossGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: LEGEND_FX.glowTexture(), color: theme.accent, transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  bossGlow.scale.set(480, 480, 1);
  bossGlow.position.set(bx, 150, bz);
  scene.add(bossGlow);
  // Boss-chamber colonnade: a ring of KayKit decorated pillars around the
  // summoning circle (replacing the old crown of 14 bare crystal cones), each
  // capped with a glowing accent crystal so the ring still reads as arcane. A
  // bare crystal is the per-pillar fallback until the model streams in.
  const nPillar = 8;
  for (let i = 0; i < nPillar; i++) {
    const a = (i / nPillar) * Math.PI * 2;
    const ox = bx + Math.cos(a) * 250, oz = bz + Math.sin(a) * 250;
    const pil = kkProp(scene, 'ruin_pillar2', ox, oz, 150, 'height', -a);
    const capY = pil ? (pil.userData.kkHeight || 150) : 0;
    const cry = new THREE.Mesh(new THREE.ConeGeometry(pil ? 7 : 8, pil ? 22 : 40, 5),
      new THREE.MeshBasicMaterial({ color: theme.accent }));
    cry.position.set(ox, pil ? capY + 11 : 25, oz);
    scene.add(cry);
    const cg = new THREE.Sprite(new THREE.SpriteMaterial({ map: LEGEND_FX.glowTexture(), color: theme.accent, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    cg.scale.set(48, 48, 1); cg.position.set(ox, pil ? capY + 11 : 25, oz); scene.add(cg);
  }

  // Exit portal in the entry chamber (by spawn).
  const px = layout.portal.x, pz = layout.portal.y;
  setDungeonKiosks([{ x: px, z: pz, portal: 'dungeon_exit' }]);
  const _dngPortal = buildPortalMesh(px, pz); _dngPortal.rotation.y = Math.PI / 2; scene.add(_dngPortal);

  const plaque = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(34, 44, 6), new THREE.MeshLambertMaterial({ color: theme.rock }));
  slab.position.y = 30; plaque.add(slab);
  const pbase = new THREE.Mesh(new THREE.BoxGeometry(42, 10, 12), new THREE.MeshLambertMaterial({ color: theme.bg }));
  pbase.position.y = 5; plaque.add(pbase);
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(24, 30), new THREE.MeshBasicMaterial({ map: makeCaveSigilTexture(0), color: theme.accent, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  rune.position.set(0, 30, 3.4); plaque.add(rune);
  plaque.position.set(layout.plaque.x, 0, layout.plaque.y); plaque.rotation.y = 0.4;
  scene.add(plaque);
  getDungeonKiosks().push({ x: layout.plaque.x, z: layout.plaque.y, npc: 'plaque' });

  setDungeonScene(scene);
  setDungeonCamera(camera);
}
// Rebuild the single dungeonScene for the tier being entered, so all the
// existing `activeScene === dungeonScene` checks keep working (one current
// dungeon scene at a time). Clearing the mob-visual cache lets those meshes
// re-add themselves to the fresh scene on the next state broadcast.
function rebuildDungeonForTier(tier, isDelve) {
  const want = isDelve ? 5 : ((tier >= 1 && tier <= 4) ? tier : 0);
  if (getBuiltDungeonTier() === want && getDungeonScene()) return;
  setDungeonMobVisuals({});
  if (want === 0) buildDungeonScene(); else buildDungeonCaveScene(DUNGEON_CAVE_THEMES[want], DUNGEON_LAYOUTS[want]);
  setBuiltDungeonTier(want);
}

function buildDungeonScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080410);
  scene.fog = new THREE.Fog(0x080410, 450, 1500);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 2000);

  const floorGeo = new THREE.PlaneGeometry(1200, 1200);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x201828 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(600, 0, 600);
  scene.add(floor);

  scene.add(new THREE.AmbientLight(0x3a1020, 0.5));

  const torchSpots = [[225, 225], [975, 225], [225, 975], [975, 975], [600, 570]];
  for (const [tx, tz] of torchSpots) {
    const tLight = new THREE.PointLight(0xff6600, 1.0, 460);
    tLight.position.set(tx, 80, tz);
    scene.add(tLight);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 40, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b5030 })
    );
    post.position.set(tx, 20, tz);
    scene.add(post);
  }

  const pillarGeo = new THREE.CylinderGeometry(18, 22, 160, 8);
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x2e283a });
  for (const [px, pz] of [[120,120],[1080,120],[120,1080],[1080,1080],[120,600],[1080,600],[600,120],[600,1080]]) {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(px, 80, pz);
    scene.add(pillar);
  }

  scene.add(buildPortalMesh(600, 75));
  setDungeonKiosks([{ x: 600, z: 75, portal: 'dungeon_exit' }]);

  const plaque = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(34, 44, 6), new THREE.MeshLambertMaterial({ color: 0x3a3048 }));
  slab.position.y = 30; plaque.add(slab);
  const base = new THREE.Mesh(new THREE.BoxGeometry(42, 10, 12), new THREE.MeshLambertMaterial({ color: 0x2e283a }));
  base.position.y = 5; plaque.add(base);
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(24, 30), new THREE.MeshBasicMaterial({ color: 0x8a76c9, transparent: true, opacity: 0.35 }));
  rune.position.set(0, 30, 3.2); plaque.add(rune);
  plaque.position.set(700, 0, 1050);
  plaque.rotation.y = -0.5;
  scene.add(plaque);
  getDungeonKiosks().push({ x: 700, z: 1050, npc: 'plaque' });

  setDungeonScene(scene);
  setDungeonCamera(camera);
}

  return { buildDungeonScene, rebuildDungeonForTier };
}
