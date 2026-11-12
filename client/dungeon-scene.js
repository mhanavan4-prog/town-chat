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
// ── Things to find and do (lib/dungeonFinds.js on the server) ──────────────
// Each is drawn where the layout puts it and remembered by id, so the state
// the server sends (what burns, what is broken, what you have already had)
// can be shown on it. A kiosk at each is what F / the action button uses.
const FIND_VERBS = {
  chest: 'open the chest (it wants a bone key)', cache: 'search the cache', ore: 'work the ore seam',
  mushroom: 'pick the cave mushrooms', crystal: 'scrape the crystal', brazier: 'light the brazier', seal: 'strike the seal',
  rare_marked: 'read the marks', rare_hoard: 'strike the old vault', rare_hoard_open: 'reach into the hoard', rare_well: 'drop a bent pin in the well',
};
let lastFinds = null;        // the server's last word, kept to show again on a rebuilt scene
let findsClockSkew = 0;      // server clock minus ours, so vents breathe when the server says they do
function findSprite(color, size, y) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: LEGEND_FX.glowTexture(), color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.scale.set(size, size * 1.25, 1); sp.position.y = y;
  return sp;
}
function buildFinds(scene, layout, theme, rockStain) {
  const finds = {}, kiosks = [];
  const stainRock = (g) => { g.traverse((o) => { if (o.isMesh && o.material && o.material.name === 'Plant') { o.material = o.material.clone(); o.material.color.setHex(rockStain); } }); return g; };
  const model = (key, x, z, size, mode, rot, stainIt) => {
    if (!kkStatic || !hasKK || !hasKK(key)) return null;
    const g = kkStatic(key, size, mode);
    if (!g) return null;
    g.position.set(x, 0, z); g.rotation.y = rot || 0;
    scene.add(stainIt ? stainRock(g) : g);
    return g;
  };
  const chamberOf = (t) => (layout.chambers || []).find((c) => c.id === t.chamber) || { x: t.x, y: t.y + 1 };
  const facing = (t) => { const c = chamberOf(t); return Math.atan2(c.x - t.x, c.y - t.y); };
  const add = (t, kind, entry) => { finds[t.id] = { kind, ...entry }; kiosks.push({ x: t.x, z: t.y, npc: 'dfind', findId: t.id, findKind: kind }); };

  for (const t of (layout.chests || [])) {
    const shut = model('dg_chest', t.x, t.y, 56, 'fit', facing(t)), open = model('dg_chest_open', t.x, t.y, 56, 'fit', facing(t));
    if (open) open.visible = false;
    add(t, 'chest', { shut, open });
  }
  for (const t of (layout.caches || [])) add(t, 'cache', { g: model('dg_cache', t.x, t.y, 58, 'fit', facing(t), true) });
  for (const t of (layout.nodes || [])) {
    let g = null;
    if (t.kind === 'ore') g = model('dg_ore', t.x, t.y, 74, 'fit', facing(t), true);
    else if (t.kind === 'crystal') g = model('alt_crystals', t.x, t.y, 44, 'fit', t.x);
    else {
      g = new THREE.Group(); g.position.set(t.x, 0, t.y); scene.add(g);
      for (const [dx, dz, h] of [[0, 0, 26], [16, 8, 18], [-12, 12, 15], [6, -14, 20]]) { const m = kkStatic && hasKK && hasKK('cave_mushroom') ? kkStatic('cave_mushroom', h, 'height') : null; if (m) { m.position.set(dx, 0, dz); m.rotation.y = dx; g.add(m); } }
    }
    add(t, t.kind, { g });
  }
  for (const t of (layout.braziers || [])) {
    const g = model('dg_brazier', t.x, t.y, 62, 'height', 0);
    const flame = findSprite(0xffa040, 44, 66); flame.visible = false;
    if (g) g.add(flame);
    add(t, 'brazier', { g, flame });
  }
  for (const t of (layout.seals || [])) {
    const g = model('dg_seal', t.x, t.y, 70, 'height', facing(t), true);
    let mark = null;
    if (g) g.traverse((o) => { if (o.isMesh && o.material && o.material.name === 'Glow') { o.material = o.material.clone(); o.material.color.setHex(theme.accent); if (o.material.emissive) o.material.emissive.setHex(theme.glow); mark = o.material; } });
    add(t, 'seal', { g, mark, lit: theme.glow, tint: theme.accent });
  }
  // traps are not used, only stepped round: no kiosk
  for (const t of (layout.traps || [])) {
    if (t.kind === 'spikes') finds[t.id] = { kind: 'spikes', g: model('dg_spikes', t.x, t.y, 92, 'fit', t.x, true) };
    else if (t.kind === 'vent') {
      const g = model('dg_vent', t.x, t.y, 100, 'fit', t.y, true);
      const puff = findSprite(0xb8d848, 90, 40); puff.visible = false;
      if (g) g.add(puff);
      finds[t.id] = { kind: 'vent', g, puff, x: t.x, y: t.y };
    } else {
      const g = model('dg_rockfall', t.x, t.y, 96, 'fit', t.y, true);
      const warn = new THREE.Mesh(new THREE.RingGeometry(t.r * 0.72, t.r, 28), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
      warn.rotation.x = -Math.PI / 2; warn.position.set(t.x, 3, t.y); warn.visible = false; scene.add(warn);
      finds[t.id] = { kind: 'rockfall', g, warn, warnUntil: 0 };
    }
  }
  // The rare room (data/rareRooms.js): one set of pieces, stood in whichever
  // chamber has it for now and put away when none does. Its kiosk is kept far
  // off the floor until then.
  if ((layout.rareSites || []).length) {
    const holder = new THREE.Group(); holder.name = 'rareRoom'; holder.visible = false; scene.add(holder);
    const piece = (key, size, mode, stainIt) => { const g = kkStatic && hasKK && hasKK(key) ? kkStatic(key, size, mode) : null; if (g) { holder.add(stainIt ? stainRock(g) : g); g.visible = false; } return g; };
    const ring = new THREE.Mesh(new THREE.RingGeometry(286, 300, 48), new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 2.5; ring.visible = false; holder.add(ring);
    const kiosk = { x: -99999, z: -99999, npc: 'dfind', findId: 'rare', findKind: 'rare_marked' };
    kiosks.push(kiosk);
    finds.rare = { kind: 'rare', holder, ring, kiosk,
      marked: piece('dg_rare_marks', 150, 'height', true), hoard: piece('dg_rare_vault', 120, 'fit', true),
      hoardOpen: piece('dg_rare_vault_open', 130, 'fit', true), well: piece('dg_rare_well', 120, 'fit', true) };
  }
  scene.userData.finds = finds;
  scene.userData.findKiosks = kiosks;
  if (lastFinds) applyDungeonFinds(lastFinds);
}
// Show the server's state on what is drawn.
function applyDungeonFinds(msg) {
  lastFinds = msg;
  if (msg.now) findsClockSkew = msg.now - Date.now();
  const scene = getDungeonScene(), finds = scene && scene.userData && scene.userData.finds;
  if (!finds) return;
  const used = new Set(msg.used || []), lit = new Set(msg.lit || []), broken = new Set(msg.broken || []);
  if (finds.rare) {
    const f = finds.rare, r = msg.rare;
    f.holder.visible = !!r;
    f.kiosk.x = r ? r.x : -99999; f.kiosk.z = r ? r.y : -99999;
    if (r) {
      f.holder.position.set(r.x, 0, r.y);
      f.kiosk.findKind = r.kind === 'hoard' && r.open ? 'rare_hoard_open' : 'rare_' + r.kind;
      if (f.marked) f.marked.visible = r.kind === 'marked';
      f.ring.visible = r.kind === 'marked';
      if (f.hoard) f.hoard.visible = r.kind === 'hoard' && !r.open;
      if (f.hoardOpen) f.hoardOpen.visible = r.kind === 'hoard' && !!r.open;
      if (f.well) f.well.visible = r.kind === 'well';
    }
  }
  for (const id of Object.keys(finds)) {
    const f = finds[id];
    if (f.kind === 'chest') { if (f.shut) f.shut.visible = !used.has(id); if (f.open) f.open.visible = used.has(id); }
    else if (f.kind === 'cache') { if (f.g) f.g.scale.y = used.has(id) ? 0.55 : 1; }
    else if (f.kind === 'ore') { if (f.g) f.g.scale.y = used.has(id) ? 0.6 : 1; }
    else if (f.kind === 'mushroom' || f.kind === 'crystal') { if (f.g) f.g.visible = !used.has(id); }
    else if (f.kind === 'brazier') { if (f.flame) f.flame.visible = lit.has(id); }
    else if (f.kind === 'seal') {
      const gone = broken.has(id);
      if (f.g) f.g.rotation.z = gone ? 0.5 : 0;
      if (f.mark) { f.mark.color.setHex(gone ? 0x1a1a1a : f.tint); if (f.mark.emissive) f.mark.emissive.setHex(gone ? 0x000000 : f.lit); }
    }
  }
}
// The server says the roof over this trap is about to come down.
function dungeonTrapWarn(id, ms) {
  const scene = getDungeonScene(), f = scene && scene.userData && scene.userData.finds && scene.userData.finds[id];
  if (f && f.warn) f.warnUntil = performance.now() + (ms || 1300) + 500;
}
// Every frame: vents breathe on the server's clock, a rockfall's ring pulses while it warns, braziers flicker.
function animateFinds(scene) {
  const finds = scene.userData.finds;
  if (!finds) return;
  const t = Date.now() + findsClockSkew, p = performance.now();
  for (const id in finds) {
    const f = finds[id];
    if (f.kind === 'vent' && f.puff) { f.puff.visible = ((t + (f.x * 7 + f.y * 13)) % 6000) < 2200; if (f.puff.visible) f.puff.position.y = 34 + Math.sin(p * 0.006) * 8; }
    else if (f.kind === 'rockfall' && f.warn) { f.warn.visible = p < f.warnUntil; if (f.warn.visible) f.warn.material.opacity = 0.45 + 0.4 * Math.abs(Math.sin(p * 0.012)); }
    else if (f.kind === 'brazier' && f.flame && f.flame.visible) f.flame.scale.y = 55 * (0.9 + 0.12 * Math.sin(p * 0.011 + f.flame.id));
  }
}

// Worn cave floor, drawn once: blotches of light and dark rock, hairline
// cracks, a scatter of grit. Tiles without a seam (everything wraps).
let caveFloorTexture = null;
function makeCaveFloorTexture() {
  if (caveFloorTexture) return caveFloorTexture;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.fillStyle = '#8c8c8c'; g.fillRect(0, 0, N, N);
  const wrap = (draw) => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.save(); g.translate(ox, oy); draw(); g.restore(); } };
  for (let i = 0; i < 70; i++) {
    const x = rnd() * N, y = rnd() * N, r = 10 + rnd() * 34, v = 96 + Math.floor(rnd() * 90);
    wrap(() => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${v},${v},${v},0.5)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
  }
  g.strokeStyle = 'rgba(30,30,30,0.55)'; g.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) {
    let x = rnd() * N, y = rnd() * N, a = rnd() * Math.PI * 2;
    const pts = [[x, y]];
    for (let k = 0; k < 9; k++) { a += (rnd() - 0.5) * 1.1; x += Math.cos(a) * (8 + rnd() * 14); y += Math.sin(a) * (8 + rnd() * 14); pts.push([x, y]); }
    wrap(() => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke(); });
  }
  for (let i = 0; i < 500; i++) { const v = rnd() < 0.5 ? 40 : 210; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.fillRect(rnd() * N, rnd() * N, 1.5, 1.5); }
  caveFloorTexture = new THREE.CanvasTexture(c);
  caveFloorTexture.wrapS = caveFloorTexture.wrapT = THREE.RepeatWrapping;
  return caveFloorTexture;
}

function buildDungeonCaveScene(theme, layout) {
  const scene = new THREE.Scene();
  const BG = theme.bg;
  scene.background = new THREE.Color(BG);
  // Fog pulled well back (was 950/2200): the arena is 1200 across, so at the
  // old near-plane mobs a lane or two away were already hazing out. Now the
  // whole fighting floor reads clearly and the murk only closes in past the
  // far walls — moody, but nothing hides in it.
  // The dungeon is `SIZE` across (2400): far enough that the chamber you stand
  // in and the ones beside it read clearly, and the murk takes the rest.
  const SIZE = layout.size || 1200, MID = SIZE / 2;
  scene.fog = new THREE.Fog(BG, 1250, 2800);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 2800);

  // A touch brighter than before (amb 1.0→1.3, hemi 0.7→0.95) so creatures
  // read against the dark stone without washing out the cave mood.
  scene.add(new THREE.AmbientLight(theme.amb, 1.3));
  scene.add(new THREE.HemisphereLight(theme.hemiTop, theme.hemiBot, 0.95));

  // The floor is trodden rock: mottled, cracked, with the pale of old mineral in it.
  const floorTex = makeCaveFloorTexture();
  floorTex.repeat.set((SIZE + 800) / 320, (SIZE + 800) / 320);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SIZE + 800, SIZE + 800),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(theme.floor).multiplyScalar(2.6).lerp(new THREE.Color(0x6a6662), 0.35), map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(MID, 0, MID);
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
  // The rock is modelled (tools/models/build_home.py), pale, and stained this
  // dungeon's colour; its crystal seams burn the dungeon's glow. One stained
  // copy of each material serves every piece.
  const rockStain = new THREE.Color(theme.rock).multiplyScalar(3.4).lerp(new THREE.Color(0x8a8682), 0.5).getHex();
  const stained = new Map();
  const stain = (g) => {
    g.traverse((o) => {
      const m = o.isMesh && o.material;
      if (!m || (m.name !== 'Plant' && m.name !== 'Glow')) return;
      let c = stained.get(m.uuid);
      if (!c) {
        c = m.clone();
        if (m.name === 'Plant') c.color.setHex(rockStain);
        else { c.color.setHex(theme.accent); if (c.emissive) c.emissive.setHex(theme.glow); }
        stained.set(m.uuid, c);
      }
      o.material = c;
    });
    return g;
  };
  // Rock that stands tall enough to get between the camera and you. Whatever
  // of it the camera is right up against is not drawn that frame, so backing
  // against a wall never fills the screen with it.
  const tallRock = [];
  const rock = (key, x, z, size, mode, roty) => { const g = kkProp(scene, key, x, z, size, mode, roty); if (!g) return null; if (key !== 'dg_stalag') tallRock.push(g); return stain(g); };
  scene.onBeforeRender = (_r, _s, cam) => {
    const cx = cam.position.x, cz = cam.position.z;
    for (const g of tallRock) { const dx = g.position.x - cx, dz = g.position.z - cz; g.visible = dx * dx + dz * dz > 200 * 200; }
    animateFinds(scene);
  };
  const caveRock = !!(hasKK && hasKK('dg_wall'));
  // A run of cave wall along a rect's long axis, in lengths of about 200.
  const wallRun = (w, k0) => {
    const horiz = w.w >= w.h, longLen = horiz ? w.w : w.h;
    const n = Math.max(1, Math.round(longLen / 200)), seg = longLen / n;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const rx = horiz ? (w.x + t * w.w) : w.x + w.w / 2, rz = horiz ? w.y + w.h / 2 : (w.y + t * w.h);
      // each length is turned a hair off the line, one way then the other, so where two lengths
      // overlap their faces cross cleanly instead of lying in one another (which saw-tooths)
      rock('dg_wall', rx, rz, seg * 1.08, 'fit', (horiz ? 0 : Math.PI / 2) + (((i + k0) % 2) ? Math.PI : 0) + ((i % 2) ? 0.07 : -0.07));
    }
  };
  if (caveRock) {
    layout.walls.forEach((w, k) => wallRun(w, k));
    // the cave's own sides, just beyond the floor you can walk
    const E = 26;
    [{ x: 0, y: -E - 28, w: SIZE, h: 28 }, { x: 0, y: SIZE + E, w: SIZE, h: 28 }, { x: -E - 28, y: 0, w: 28, h: SIZE }, { x: SIZE + E, y: 0, w: 28, h: SIZE }].forEach((w, k) => wallRun(w, k));
    // timber props in the doorways; where four chambers meet, a column of rock
    for (const d of (layout.doors || [])) {
      if (d.width > 300) { for (const s of [-1, 1]) rock('dg_column', d.x + (d.along === 'x' ? s * d.width / 2 : 0), d.y + (d.along === 'y' ? s * d.width / 2 : 0), 210, 'height', d.x + d.y); continue; }
      rock('dg_door', d.x, d.y, d.width * 1.32, 'fit', d.along === 'x' ? 0 : Math.PI / 2);
    }
    for (const [cx, cz] of [[1, 1], [2, 1], [1, 2], [2, 2]]) rock('dg_column', cx * SIZE / 3, cz * SIZE / 3, 230, 'height', cx * 2 + cz);
  }
  if (!caveRock) for (const w of layout.walls) {
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
    // One lantern to a chamber now, so each throws further.
    const light = new THREE.PointLight(theme.lanternLight, 1.6, 820);
    light.position.set(lx, 175, lz);
    scene.add(light);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: LEGEND_FX.glowTexture(), color: theme.lantern, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(64, 64, 1); glow.position.set(lx, 175, lz);
    scene.add(glow);
  }

  // A dim lamp hangs in every doorway: it marks the way on, and throws no light of its own.
  for (const [lx, lz] of (layout.doorLamps || [])) {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 8), new THREE.MeshBasicMaterial({ color: theme.lantern }));
    orb.position.set(lx, 150, lz); scene.add(orb);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: LEGEND_FX.glowTexture(), color: theme.lantern, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(44, 44, 1); glow.position.set(lx, 150, lz); scene.add(glow);
  }

  const bx = layout.boss.x, bz = layout.boss.y;
  // Floor dressing (replaces the 30 tall stalagmite spikes that used to be
  // scattered — and hang from the ceiling — right across the fighting floor,
  // hiding mobs). Low KayKit rubble & rocks hug the four corners and the arena
  // rim only; nothing stands over ankle height in the open, so a creature is
  // never lost behind the scenery. Each is kept well clear of the boss circle.
  const cornerClusters = [];
  for (const ch of (layout.chambers || [])) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cornerClusters.push([ch.x + sx * 340, ch.y + sz * 340]);
  let dN = 0;
  for (const [cxp, czp] of cornerClusters) {
    const nRock = 2 + (dN % 2);
    for (let k = 0; k < nRock; k++) {
      const jx = cxp + (((dN * 53) % 70) - 35), jz = czp + (((dN * 89) % 70) - 35);
      if (Math.hypot(jx - bx, jz - bz) < 240) { dN++; continue; }
      const pick = rockFloorPieces[dN % rockFloorPieces.length];
      const sz = 20 + (dN % 3) * 8;
      // A stand of stalagmites in the corner (waist-high at most, and out of the lanes), rubble about it.
      if (k === 0 && rock('dg_stalag', jx, jz, 46 + (dN % 3) * 14, 'height', dN * 1.1)) { dN++; continue; }
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

  buildFinds(scene, layout, theme, rockStain);

  // Exit portal in the entry chamber (by spawn).
  const px = layout.portal.x, pz = layout.portal.y;
  setDungeonKiosks([{ x: px, z: pz, portal: 'dungeon_exit' }, ...(scene.userData.findKiosks || [])]);
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
  if (want === 0 || !DUNGEON_LAYOUTS[want]) buildDungeonScene(); else buildDungeonCaveScene(DUNGEON_CAVE_THEMES[want], DUNGEON_LAYOUTS[want]);
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

  return { buildDungeonScene, rebuildDungeonForTier, applyDungeonFinds, dungeonTrapWarn, FIND_VERBS };
}
