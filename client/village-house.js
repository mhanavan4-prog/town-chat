// ---------------------------------------------------------------------------
// The Wildlands Village's opened buildings (data/villageHouses.js): the Tithe
// Barn, the Watch Tower and the Moot Hall. One room each, built the first time
// you go in and kept. THREE is a global; KayKit placement (kkPlace) and the
// sign helper are injected. Mirrors the crypt's module shape, so the swap
// plumbing in main.js treats a village room as it treats the crypt.
// ---------------------------------------------------------------------------
import { makeHearthFire } from './hearth-fire.js';
import { plankTexture, roomSurface, roomCaster } from './room-light.js';

export default function createVillageHouse({ kkPlace, makeSignSprite, makeGlowTexture, createHumanoid, GFX }) {
  const built = {}; // house id -> { scene, camera }

  const LOOK = {
    barn:  { bg: 0x1a120a, wall: 0x5a4028, floor: 0x6a5232, amb: 0xffe2b0, light: 0xffc070, h: 230 },
    tower: { bg: 0x0e1014, wall: 0x4a4c54, floor: 0x3a3a40, amb: 0xc8d4e8, light: 0xffd090, h: 300 },
    hall:  { bg: 0x16100a, wall: 0x6a4a2c, floor: 0x4a3420, amb: 0xffdcb0, light: 0xffb060, h: 250 },
    lodging: { bg: 0x100c0a, wall: 0x5e4a38, floor: 0x40301f, amb: 0xffd8a8, light: 0xffb060, h: 200 },
    cottage: { bg: 0x120e0a, wall: 0x6a5a44, floor: 0x4a3a28, amb: 0xffe0b8, light: 0xffb868, h: 190 },
    forge: { bg: 0x0e0908, wall: 0x3a3230, floor: 0x2c2624, amb: 0xffc8a0, light: 0xff8a3a, h: 240 },
  };

  function build(house) {
    if (built[house.id]) return built[house.id];
    const W = house.width, D = house.height, L = LOOK[house.id] || LOOK.hall;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(L.bg);
    scene.fog = new THREE.Fog(L.bg, 500, 1500);
    const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 1, 2200);
    built[house.id] = { scene, camera };

    // Light that shows (client/room-light.js): the floor and walls are shaded at every pixel so fire and lamps pool on
    // them, the room's own light is turned down to leave the corners dim, and a soft overhead light casts the shadows.
    const rich = !(GFX && GFX.st && GFX.st.quality === 'low');
    scene.add(new THREE.AmbientLight(L.amb, rich ? 0.36 : 0.5));
    const fill = new THREE.DirectionalLight(0xfff0d8, rich ? 0.26 : 0.22);
    fill.position.set(W / 2, 360, D * 0.7); fill.userData.noShadowCaster = true;
    scene.add(fill);
    if (rich) roomCaster(THREE, scene, fill, W, D, 0.6);

    const boards = rich ? plankTexture(THREE, house.id === 'tower' || house.id === 'forge' ? 'flag' : 'plank').tex : null;
    if (boards) boards.repeat.set((W + 80) / 240, (D + 80) / 240);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 80, D + 80), roomSurface(THREE, rich ? new THREE.Color(L.floor).multiplyScalar(1.7).getHex() : L.floor, { rich, map: boards }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, D / 2);
    scene.add(floor);
    // the shell: four walls and a roof, set back so the camera never clips them
    const wallMat = roomSurface(THREE, L.wall, { rich });
    for (const [wx, wy, wz, ww, wh, wd] of [
      [W / 2, L.h / 2, -24, W + 120, L.h, 44], [W / 2, L.h / 2, D + 60, W + 120, L.h, 44],
      [-24, L.h / 2, D / 2, 44, L.h, D + 120], [W + 24, L.h / 2, D / 2, 44, L.h, D + 120],
      [W / 2, L.h + 20, D / 2, W + 160, 44, D + 160],
    ]) { const m = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, wd), wallMat); m.position.set(wx, wy, wz); scene.add(m); }
    // (No tie-beams across: the camera rides high indoors and they hung across the view.)
    // posts up the two long walls, as any old hall or barn has
    const beamMat = new THREE.MeshLambertMaterial({ color: 0x2e1e10 });
    if (house.id !== 'tower') for (let x = 90; x < W; x += 190) { const p = new THREE.Mesh(new THREE.BoxGeometry(16, L.h, 16), beamMat); p.position.set(x, L.h / 2, 6); scene.add(p); }
    // lamps are kept low: the kit's furniture is pale and takes light hard
    const lamp = (x, z, y, power, reach) => { const l = new THREE.PointLight(L.light, (power || 1.3) * 0.42, reach || 520, 1.6); l.position.set(x, y || 120, z); scene.add(l); return l; };
    const glow = (x, y, z, size, color) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: color || L.light, transparent: true, opacity: 0.55, depthWrite: false })); s.scale.set(size, size, 1); s.position.set(x, y, z); scene.add(s); return s; };
    const sign = (text, x, y, z) => { const s = makeSignSprite(text); s.position.set(x, y, z); scene.add(s); };
    const spot = (id) => house.spots.find((s) => s.id === id);
    // a hearth against the north wall with its fire lit (the model is the stonework and the logs; the fire is drawn)
    const hearth = (x, z, size, power) => { kkPlace(scene, 'furn_hearth', x, z, size, 0, 'fit'); const f = makeHearthFire(THREE, size / 190); f.position.set(x, 9 * size / 190, z + 3); const fl = f.userData.light; fl.userData.base *= (power || 1) * (rich ? 1.45 : 1); fl.color.set(L.light); if (rich) { fl.position.set(0, 62 * size / 190, 64 * size / 190); fl.distance *= 1.25; } scene.add(f); };   // (rich: lifted and out from the fire-back, so it falls on the boards before it)

    if (house.id === 'barn') {
      lamp(W * 0.25, D / 2); lamp(W * 0.75, D / 2); lamp(W / 2, 120, 150);
      // the storekeeper's ledger on its stand, with the store behind it
      const s = spot('store');
      kkPlace(scene, 'furn_lectern', s.x, s.y - 30, 70, 0, 'height');
      sign('📒 The ledger — Press F', s.x, 130, s.y - 30);
      for (const [x, z, r] of [[90, 90, 0.2], [170, 80, 1.1], [120, 170, 0.6], [W - 90, 90, -0.3], [W - 170, 100, 0.8], [W - 110, 180, 0.1], [90, D - 190, 0.5], [W - 100, D - 200, -0.6]]) kkPlace(scene, 'prop_haybale', x, z, 62, r, 'fit');
      for (const [x, z] of [[230, 60], [W - 240, 60], [W / 2 - 110, 60], [W / 2 + 110, 60]]) { const g = kkPlace(scene, 'wd_sheaf', x, z, 54, 0, 'height'); if (g) g.position.y = 0; }
      kkPlace(scene, 'furn_sidetable', s.x + 110, s.y - 20, 40, 0, 'height');
      { const k = kkPlace(scene, 'tw_key', s.x + 110, s.y - 20, 18, 0.6, 'fit'); if (k) k.position.y = 40; }
      kkPlace(scene, 'prop_lantern_std', 60, D / 2, 70, 0, 'height'); kkPlace(scene, 'prop_lantern_std', W - 60, D / 2, 70, 0, 'height');
    } else if (house.id === 'tower') {
      lamp(W / 2, D / 2, 150, 1.5, 620);
      const s = spot('lookout');
      // the ladder up through the floors: two rails and their rungs, leant on the north wall
      const wood = new THREE.MeshLambertMaterial({ color: 0x6a4a28 });
      for (const dx of [-22, 22]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(7, L.h + 30, 7), wood); rail.position.set(s.x + dx, L.h / 2, s.y - 70); rail.rotation.x = 0.16; scene.add(rail); }
      for (let y = 22; y < L.h; y += 26) { const rung = new THREE.Mesh(new THREE.BoxGeometry(46, 5, 5), wood); rung.position.set(s.x, y, s.y - 70 - (L.h / 2 - y) * 0.16); scene.add(rung); }
      // the way up: an opening in the floor above, with the night showing through it
      const hatch = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ color: 0x8fb0e8, transparent: true, opacity: 0.35, depthWrite: false }));
      hatch.rotation.x = Math.PI / 2; hatch.position.set(s.x, L.h - 4, s.y - 60); scene.add(hatch);
      sign('🗼 The look-out — Press F', s.x, 150, s.y - 60);
      kkPlace(scene, 'furn_shield', 30, D / 2, 60, Math.PI / 2, 'fit'); kkPlace(scene, 'furn_torch', 70, 70, 100, 0, 'height'); kkPlace(scene, 'furn_torch', W - 70, 70, 100, 0, 'height');
      kkPlace(scene, 'furn_sidetable', W - 90, D / 2 + 20, 40, 0, 'height'); { const l = kkPlace(scene, 'furn_rlantern', W - 90, D / 2 + 20, 22, 0, 'height'); if (l) l.position.y = 40; }
      kkPlace(scene, 'furn_banner', W / 2 + 120, 14, 110, 0, 'height');
    } else if (house.id === 'lodging') {
      // the Lyke-Wake: beds down the west side, the fire and its keeper to the east, a candle in the window
      const b = spot('bed'), k = spot('keeper');
      for (const [x, z] of [[90, 90], [90, 230], [250, 90]]) kkPlace(scene, 'furn_cbed', x, z, 110, Math.PI / 2, 'fit');
      sign('🛏️ A bed — Press F', b.x, 120, b.y - 20);
      hearth(k.x, 34, 150, 0.9);
      lamp(k.x, 110, 70, 0.8, 480);
      try {
        const keeper = createHumanoid ? createHumanoid(3, null, 'keeper').group : null;
        if (keeper) { keeper.position.set(k.x + 70, 0, k.y - 40); keeper.traverse((o) => { if (!o.isMesh && !o.isSkinnedMesh) return; for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m && m.color) m.color.lerp(new THREE.Color(0x5a5048), 0.5); }); scene.add(keeper); }
      } catch (e) { /* the house keeps itself */ }
      sign('🕯️ The keeper — Press F', k.x + 70, 118, k.y - 40);
      kkPlace(scene, 'furn_sidetable', W - 60, D / 2, 40, 0, 'height');
      const c = kkPlace(scene, 'cave_candle', W - 60, D / 2, 22, 0, 'height'); if (c) c.position.y = 40;
      glow(W - 60, 68, D / 2, 40, 0xffd080); lamp(W - 60, D / 2, 74, 0.5, 220);
      kkPlace(scene, 'furn_stool', k.x - 60, k.y + 40, 24, 0, 'height');   // knee-high (the kit's is a bar stool: set by its height)
      lamp(W * 0.3, D * 0.55, 100, 0.4, 320);
    } else if (house.id === 'cottage') {
      // the wise-woman's one room: her shelf of remedies to the west, herself by the
      // hearth to the east, a stool at the fire, and herbs hung to dry along the beam
      const w = spot('wares'), u = spot('unwitch'), t = spot('trade');
      hearth(W / 2, 34, 150, 0.9);
      lamp(W / 2, 110, 70, 0.9, 520);
      kkPlace(scene, 'furn_bookcase', w.x, w.y - 110, 150, 0, 'height');
      // her table is table-high (it was set by its width, and stood as tall as she does), with the bottles on it
      for (const [dx, key, sz] of [[-13, 'cave_potion', 18], [0, 'cave_jar', 16], [13, 'cave_eyejar', 16]]) { const g = kkPlace(scene, key, w.x + dx, w.y - 50, sz, 0, 'height'); if (g) g.position.y = 44; }
      kkPlace(scene, 'furn_sidetable', w.x, w.y - 50, 44, 0, 'height');
      sign('🌿 Remedies — Press F', w.x, 150, w.y - 110);
      // Dame Averil herself, by the fire: the Witch's body, in an old woman's greys and browns
      try {
        const dame = createHumanoid ? createHumanoid(0, null, 'dame').group : null;
        if (dame) {
          dame.position.set(u.x, 0, u.y - 60); dame.rotation.y = 0; // facing into the room (south)
          dame.traverse((o) => { if (!o.isMesh && !o.isSkinnedMesh) return; for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m && m.color) m.color.lerp(new THREE.Color(0x6a5a48), 0.5); });
          scene.add(dame);
        }
      } catch (e) { /* a room without its mistress is still a room */ }
      sign('🌿 Dame Averil — Press F', u.x, 118, u.y - 60);
      kkPlace(scene, 'furn_stool', t.x, t.y, 24, 0, 'height');   // knee-high (the kit's is a bar stool: set by its height)
      for (let x = 70; x < W - 40; x += 62) { const g = kkPlace(scene, 'furn_herbs', x, 60, 34, x, 'height'); if (g) g.position.y = L.h - 70; }
      // (no rug: the kit's is pale and took the firelight as a white sheet in so small a room)
      kkPlace(scene, 'wd_besom', W - 50, D - 110, 90, 0.3, 'height');
      kkPlace(scene, 'furn_sidetable', W - 70, 150, 40, 0, 'height'); { const j = kkPlace(scene, 'furn_rjar', W - 70, 150, 16, 0, 'height'); if (j) j.position.y = 40; }
      lamp(W * 0.25, D * 0.55, 100, 0.45, 300); lamp(W * 0.75, D * 0.55, 100, 0.45, 300);
    } else if (house.id === 'forge') {
      // the Smithy: the fire on the north wall with the anvil before it, the groat stone to the west, the slack-tub to
      // the east, and the boy who works the bellows (the smith is never there)
      const gr = spot('groat'), tb = spot('tub'), sm = spot('smith');
      hearth(W / 2, 36, 190, 1.3);
      lamp(W / 2, 120, 80, 1.3, 620);
      const iron = new THREE.MeshLambertMaterial({ color: 0x2b2b30 }), stone = new THREE.MeshLambertMaterial({ color: 0x6a6660 }), oak = new THREE.MeshLambertMaterial({ color: 0x4a3018 });
      const put = (geo, mat, x, y, z, ry) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = true; scene.add(m); return m; };
      // the anvil on its block
      put(new THREE.CylinderGeometry(20, 23, 26, 10), oak, W / 2, 13, 150);
      put(new THREE.BoxGeometry(20, 12, 14), iron, W / 2, 32, 150); put(new THREE.BoxGeometry(44, 10, 18), iron, W / 2, 43, 150);
      { const horn = put(new THREE.ConeGeometry(6, 20, 8), iron, W / 2 - 31, 43, 150); horn.rotation.z = Math.PI / 2; }
      // the groat stone: a flat grey stone, a few coins on it
      put(new THREE.CylinderGeometry(46, 52, 16, 9), stone, gr.x, 8, gr.y - 60, 0.4);
      const coin = new THREE.MeshLambertMaterial({ color: 0xd8b24a, emissive: 0x3a2a08 });
      for (const [dx, dz] of [[-10, -4], [6, 8], [14, -10]]) put(new THREE.CylinderGeometry(4.5, 4.5, 1.6, 10), coin, gr.x + dx, 17, gr.y - 60 + dz);
      sign('⚒️ The groat stone — Press F', gr.x, 110, gr.y - 60);
      lamp(gr.x, gr.y - 20, 90, 0.5, 260);
      // the slack-tub: half a barrel of forge water, with the fire in it
      put(new THREE.CylinderGeometry(38, 33, 40, 14), oak, tb.x, 20, tb.y - 60);
      for (const y of [8, 32]) put(new THREE.TorusGeometry(37, 1.8, 6, 20), iron, tb.x, y, tb.y - 60).rotation.x = Math.PI / 2;
      { const w = put(new THREE.CircleGeometry(34, 18), new THREE.MeshBasicMaterial({ color: 0x8a4a22, transparent: true, opacity: 0.85 }), tb.x, 38, tb.y - 60); w.rotation.x = -Math.PI / 2; w.castShadow = false; }
      sign('💧 The slack-tub — Press F', tb.x, 110, tb.y - 60);
      // tongs and hammers along the wall, the bellows by the fire
      for (const [x, len] of [[W / 2 - 150, 50], [W / 2 - 134, 38], [W / 2 + 140, 46], [W / 2 + 156, 34]]) put(new THREE.BoxGeometry(4, len, 4), iron, x, 150 - len / 2, 8);
      put(new THREE.BoxGeometry(60, 12, 34), oak, W / 2 + 120, 30, 70, -0.5);
      // the bellows-boy
      try {
        const boy = createHumanoid ? createHumanoid(3, null, 'bellowsboy').group : null;
        if (boy) { boy.scale.multiplyScalar(0.82); boy.position.set(sm.x, 0, sm.y - 50); scene.add(boy); }
      } catch (e) { /* the fire keeps itself */ }
      sign('⚒️ The bellows-boy — Press F', sm.x, 104, sm.y - 50);
      kkPlace(scene, 'furn_torch', 60, D - 150, 100, 0, 'height'); kkPlace(scene, 'furn_torch', W - 60, D - 150, 100, 0, 'height');
      lamp(W * 0.5, D * 0.6, 110, 0.5, 340);
    } else {
      // the Moot Hall: the hearth on the north wall, the long table down the middle, the board by the door
      const h = spot('hearth'), b = spot('board');
      hearth(h.x, 40, 190, 1.1);
      lamp(h.x, 120, 70, 1.0, 640);
      sign('🔥 The hearth — Press F', h.x, 170, 70);
      // the long table, made of three trestle tables end to end, at a height to sit at (one at 330 stood
      // higher than a head), with a bench down each side
      for (const dz of [-92, 0, 92]) {
        kkPlace(scene, 'furn_htable', W / 2, D / 2 + 20 + dz, 92, Math.PI / 2, 'fit');
        for (const sx of [-50, 50]) kkPlace(scene, 'furn_hbench', W / 2 + sx, D / 2 + 20 + dz, 90, Math.PI / 2, 'fit');
      }
      kkPlace(scene, 'furn_highseat', h.x + 200, 64, 90, 0, 'height');   // beside the hearth, not before it: it stood square in front of the fire
      const ch = kkPlace(scene, 'furn_chandelier', W / 2, D / 2 + 20, 130, 0, 'fit'); if (ch) ch.position.y = 170;
      lamp(W / 2, D / 2 + 20, 160, 1.2, 600);
      kkPlace(scene, 'furn_wrug', W / 2, D - 170, 190, 0, 'fit');
      kkPlace(scene, 'tw_board', b.x + 60, b.y, 150, -Math.PI / 2, 'fit');
      sign('📜 The moot board — Press F', b.x + 40, 150, b.y);
      for (const x of [140, W - 140]) kkPlace(scene, 'furn_banner', x, 14, 120, 0, 'height');
      for (const [x, z] of [[70, 80], [W - 70, 80], [70, D - 150], [W - 70, D - 150]]) { kkPlace(scene, 'furn_torch', x, z, 100, 0, 'height'); lamp(x, z, 100, 0.7, 320); }
      kkPlace(scene, 'furn_shield', 30, D / 2, 64, Math.PI / 2, 'fit'); kkPlace(scene, 'furn_shield', W - 30, D / 2, 64, -Math.PI / 2, 'fit');
    }

    // the way out, at the south end where you came in
    const doorX = W / 2, doorZ = D - 40;
    const archMat = new THREE.MeshLambertMaterial({ color: 0x24160c });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(124, 18, 30), archMat); lintel.position.set(doorX, 150, doorZ); scene.add(lintel);
    for (const sx of [-56, 56]) { const post = new THREE.Mesh(new THREE.BoxGeometry(18, 150, 30), archMat); post.position.set(doorX + sx, 75, doorZ); scene.add(post); }
    const out = new THREE.Mesh(new THREE.PlaneGeometry(98, 140), new THREE.MeshBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
    out.position.set(doorX, 72, doorZ - 2); scene.add(out);
    out.onBeforeRender = () => { out.material.opacity = 0.15 + Math.sin(performance.now() * 0.0022) * 0.07; };
    sign(`← Out to the village — Press F`, doorX, 176, doorZ);
    return built[house.id];
  }
  return { build, built };
}
