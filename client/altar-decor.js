// ---------------------------------------------------------------------------
// Coven-altar decorations (Session N+). The witch-altars that replaced the
// Manor beds display a handful of adornments the owning player arranges; this
// module is the single source of truth for the decoration CATALOG (shared by
// the adorn UI in main.js) and the 3D BUILDERS (used by manor-scene.js). The
// server keeps its own small copy of the ids/costs — keep the two in sync.
//
// THREE is a global (same as the other client modules). Each builder returns a
// THREE.Group whose base sits at y=0; animated pieces drive themselves through
// onBeforeRender so no render-loop wiring is needed. Geometry here is the same
// that was signed off in the altar preview, lightly sized to sit six-to-an-
// altar without clipping.
// ---------------------------------------------------------------------------

// Catalog metadata. `free:true` = always placeable; otherwise `ms` is the
// one-time Moonstone unlock cost (then placeable forever on any altar you own).
export const ALTAR_DECOS = [
  { id: 'candles',  name: 'Candle trio',     emoji: '🕯️', free: true },
  { id: 'pentacle', name: 'Pentacle plaque', emoji: '⛤',  free: true },
  { id: 'incense',  name: 'Incense censer',  emoji: '🌫️', free: true },
  { id: 'chalice',  name: 'Chalice',         emoji: '🍷', free: true },
  { id: 'bell',     name: 'Hand bell',       emoji: '🔔', free: true },
  { id: 'runes',    name: 'Rune stones',     emoji: '🪨', free: true },
  { id: 'mirror',   name: 'Scrying mirror',  emoji: '🪞', ms: 40 },
  { id: 'cauldron', name: 'Cauldron bowl',   emoji: '🧪', ms: 50 },
  { id: 'skull',    name: 'Skull',           emoji: '💀', ms: 30 },
  { id: 'crystals', name: 'Crystal cluster', emoji: '🔮', ms: 60 },
  { id: 'grimoire', name: 'Grimoire',        emoji: '📖', ms: 50 },
  { id: 'raven',    name: 'Raven familiar',  emoji: '🐦', ms: 45 },
];
export const ALTAR_DECO_IDS = ALTAR_DECOS.map((d) => d.id);

// Six display positions across the altar top (local x,z; the scene supplies y).
export const ALTAR_SLOT_POS = [
  { x: -24, z: -24 }, { x: 0, z: -24 }, { x: 24, z: -24 },
  { x: -24, z: 26 },  { x: 0, z: 26 },  { x: 24, z: 26 },
];
export const ALTAR_SLOTS = ALTAR_SLOT_POS.length;

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
let _GLOW = null;
const GLOW = () => (_GLOW || (_GLOW = glowTexture()));

function mat(opts) { return new THREE.MeshLambertMaterial(opts); }
const M = () => ({
  stoneDark: mat({ color: 0x282230 }),
  iron: mat({ color: 0x1b1720 }),
  bronze: mat({ color: 0x8a6a2f, emissive: 0x2a1d08, emissiveIntensity: 0.4 }),
  wax: mat({ color: 0x1a1622 }),
  bone: mat({ color: 0xd8d0c0 }),
  crystal: mat({ color: 0x9b6cff, emissive: 0x3a1d6e, emissiveIntensity: 0.7, transparent: true, opacity: 0.85 }),
  book: mat({ color: 0x2a1030 }),
});

function flame(col, s, y) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW(), color: col, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.scale.set(s, s * 1.4, 1); m.position.y = y;
  m.onBeforeRender = () => { const t = performance.now(); m.material.opacity = 0.78 + Math.sin(t * 0.02 + y) * 0.16; m.scale.set(s + Math.sin(t * 0.011) * s * 0.12, s * 1.4 + Math.sin(t * 0.013) * s * 0.18, 1); };
  return m;
}

// ── builders ────────────────────────────────────────────────────────────────
const BUILD = {
  candles() {
    const g = new THREE.Group(); const m = M();
    [[-7, 2], [7, -2], [0, 7]].forEach((p, i) => {
      const s = 0.85 + (i * 0.11);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(3 * s, 3.6 * s, 20 * s, 10), m.wax); c.position.set(p[0], 10 * s, p[1]); g.add(c);
      const fl = flame(0xffcf6a, 7.5, 22 * s); fl.position.x = p[0]; fl.position.z = p[1]; g.add(fl);
    });
    return g;
  },
  pentacle() {
    const g = new THREE.Group(); const m = M(); const R = 11;
    const star = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      // +π/2 puts the first vertex at the TOP (three.js is Y-up here), so the
      // star points up — matching the canvas-drawn pentacles elsewhere. (−π/2
      // put a vertex at the bottom, rendering it inverted/point-down.)
      const a1 = Math.PI / 2 + i * 4 * Math.PI / 5, a2 = Math.PI / 2 + (i + 1) * 4 * Math.PI / 5;
      const x1 = Math.cos(a1) * R, y1 = Math.sin(a1) * R, x2 = Math.cos(a2) * R, y2 = Math.sin(a2) * R, len = Math.hypot(x2 - x1, y2 - y1);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 1.4, 1.4), m.bronze);
      bar.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0); bar.rotation.z = Math.atan2(y2 - y1, x2 - x1); star.add(bar);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 1.5, 1, 8, 28), m.bronze); star.add(ring);
    star.position.set(0, 17, 0); g.add(star);
    const easel = new THREE.Mesh(new THREE.BoxGeometry(2, 16, 2), m.iron); easel.position.set(0, 8, 2.4); easel.rotation.x = 0.2; g.add(easel);
    return g;
  },
  incense() {
    const g = new THREE.Group(); const m = M();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(7, 5, 5, 12), m.bronze); bowl.position.y = 3; g.add(bowl);
    const sand = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1.5, 12), m.stoneDark); sand.position.y = 5.5; g.add(sand);
    [[-2, 0], [1, 2], [2, -1]].forEach((p) => {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 16, 4), mat({ color: 0x6a3b2a })); st.position.set(p[0], 13, p[1]); st.rotation.z = (p[0]) * 0.04; g.add(st);
      const tip = flame(0xff6a3a, 2.6, 21); tip.position.x = p[0]; tip.position.z = p[1]; g.add(tip);
    });
    const sm = new THREE.Mesh(new THREE.ConeGeometry(5, 36, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xb9a6d6, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    sm.position.y = 34; g.add(sm);
    sm.onBeforeRender = () => { const t = performance.now(); sm.rotation.y = t * 0.0008; sm.material.opacity = 0.08 + Math.sin(t * 0.004) * 0.05; };
    return g;
  },
  chalice() {
    const g = new THREE.Group(); const m = M();
    g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 2, 12), m.bronze), { position: new THREE.Vector3(0, 1, 0) }));
    g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 10, 8), m.bronze), { position: new THREE.Vector3(0, 7, 0) }));
    g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6), m.bronze), { position: new THREE.Vector3(0, 8, 0) }));
    g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(7, 3.5, 10, 12), m.bronze), { position: new THREE.Vector3(0, 17, 0) }));
    const wine = new THREE.Mesh(new THREE.CircleGeometry(6, 12), new THREE.MeshBasicMaterial({ color: 0x5a0f22 })); wine.rotation.x = -Math.PI / 2; wine.position.y = 21.5; g.add(wine);
    return g;
  },
  bell() {
    const g = new THREE.Group(); const m = M();
    g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 12, 12, 1, true), m.bronze), { position: new THREE.Vector3(0, 12, 0) }));
    g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.bronze), { position: new THREE.Vector3(0, 18, 0) }));
    g.add(Object.assign(new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.8, 6, 12), m.bronze), { position: new THREE.Vector3(0, 22, 0) }));
    g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), m.iron), { position: new THREE.Vector3(0, 7, 0) }));
    return g;
  },
  runes() {
    const g = new THREE.Group();
    [[-6, -3, 0], [0, -5, 0.4], [5, 3, -0.3], [-2, 4, 0.6], [7, -2, 0.2]].forEach((p, i) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(6, 3.4, 7), mat({ color: [0x6b5d46, 0x5a4e3a, 0x655843][i % 3] })); s.position.set(p[0], 1.7, p[1]); s.rotation.y = p[2]; g.add(s);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW(), color: 0x7be3a3, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(6, 6, 1); gl.position.set(p[0], 4, p[1]); g.add(gl);
    });
    return g;
  },
  mirror() {
    const g = new THREE.Group(); const m = M();
    const frame = new THREE.Mesh(new THREE.TorusGeometry(13, 2.4, 8, 28), m.bronze); frame.position.y = 20; g.add(frame);
    const glass = new THREE.MeshPhongMaterial({ color: 0x0a0a12, shininess: 90, specular: 0x8899ff });
    const gm = new THREE.Mesh(new THREE.CircleGeometry(12.5, 28), glass); gm.position.set(0, 20, 0.3); g.add(gm);
    const gm2 = new THREE.Mesh(new THREE.CircleGeometry(12.5, 28), glass); gm2.position.set(0, 20, -0.3); gm2.rotation.y = Math.PI; g.add(gm2);
    const sheen = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW(), color: 0x8e7bd0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); sheen.scale.set(16, 16, 1); sheen.position.set(0, 20, 1); g.add(sheen);
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(3, 10, 3), m.iron), { position: new THREE.Vector3(0, 4, 0) }));
    g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 3, 12), m.iron), { position: new THREE.Vector3(0, 1.5, 0) }));
    sheen.onBeforeRender = () => { sheen.material.opacity = 0.28 + Math.sin(performance.now() * 0.003) * 0.14; };
    return g;
  },
  cauldron() {
    const g = new THREE.Group(); const m = M();
    const pot = new THREE.Mesh(new THREE.SphereGeometry(10, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.72), m.iron); pot.position.y = 10; pot.scale.y = 0.9; g.add(pot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(8.4, 1.4, 8, 16), m.iron); rim.position.y = 16.5; rim.rotation.x = Math.PI / 2; g.add(rim);
    for (let i = 0; i < 3; i++) { const a = i * 2 * Math.PI / 3; g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 6, 6), m.iron), { position: new THREE.Vector3(Math.cos(a) * 6, 3, Math.sin(a) * 6) })); }
    const brew = new THREE.Mesh(new THREE.CircleGeometry(8, 16), new THREE.MeshBasicMaterial({ color: 0x6be3a3 })); brew.rotation.x = -Math.PI / 2; brew.position.y = 16.2; g.add(brew);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW(), color: 0x6be3a3, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(20, 16, 1); gl.position.y = 20; g.add(gl);
    gl.onBeforeRender = () => { const t = performance.now(); gl.material.opacity = 0.35 + Math.sin(t * 0.005) * 0.2; gl.position.y = 20 + Math.sin(t * 0.004) * 2; };
    return g;
  },
  skull() {
    const g = new THREE.Group(); const m = M();
    const cr = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 10), m.bone); cr.position.y = 10; cr.scale.set(1, 1.05, 1.15); g.add(cr);
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(11, 5, 9), m.bone), { position: new THREE.Vector3(0, 4.5, 1.5) }));
    [-3.2, 3.2].forEach((x) => g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 8), m.iron), { position: new THREE.Vector3(x, 11, 6.5) })));
    return g;
  },
  crystals() {
    const g = new THREE.Group(); const m = M();
    const base = new THREE.Mesh(new THREE.DodecahedronGeometry(5, 0), m.stoneDark); base.position.y = 3; base.scale.y = 0.5; g.add(base);
    [[0, 18, 0, 1.2], [-4, 13, 2, 0.8], [4, 12, -2, 0.7], [2, 10, 4, 0.6]].forEach((p) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(2.4 * p[3], p[1], 5), m.crystal); c.position.set(p[0], p[1] / 2 + 2, p[2]); c.rotation.set((p[0]) * 0.03, 0, (p[2]) * 0.03); g.add(c);
    });
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW(), color: 0x9b6cff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.set(26, 26, 1); gl.position.y = 14; g.add(gl);
    gl.onBeforeRender = () => { gl.material.opacity = 0.3 + Math.sin(performance.now() * 0.004) * 0.18; };
    return g;
  },
  grimoire() {
    const g = new THREE.Group(); const m = M();
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(20, 5, 26), m.book), { position: new THREE.Vector3(0, 4, 0) }));
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(18, 3.4, 24), m.bone), { position: new THREE.Vector3(0, 4, 0) }));
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(4, 5.5, 3), m.bronze), { position: new THREE.Vector3(0, 4, 13) }));
    const sig = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW(), color: 0x7be3a3, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending })); sig.scale.set(14, 14, 1); sig.position.set(0, 7, 0); g.add(sig);
    sig.onBeforeRender = () => { sig.material.opacity = 0.12 + Math.abs(Math.sin(performance.now() * 0.0015)) * 0.22; };
    return g;
  },
  raven() {
    const g = new THREE.Group(); const m = M();
    const body = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 10), m.iron); body.scale.set(1, 1.1, 1.5); body.position.y = 12; g.add(body);
    g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(4.5, 10, 8), m.iron), { position: new THREE.Vector3(0, 19, 6) }));
    const beak = new THREE.Mesh(new THREE.ConeGeometry(1.6, 6, 6), mat({ color: 0x2a2420 })); beak.position.set(0, 19, 11); beak.rotation.x = Math.PI / 2; g.add(beak);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(4, 14, 6), m.iron); tail.position.set(0, 11, -9); tail.rotation.x = -Math.PI / 2.1; g.add(tail);
    [-2, 2].forEach((x) => g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffcf4a })), { position: new THREE.Vector3(x, 20, 9.5) })));
    g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 4, 10), m.stoneDark), { position: new THREE.Vector3(0, 2, 0) }));
    return g;
  },
};

// Build one decoration group by id (null for an unknown id).
export function buildDecoration(id) {
  const fn = BUILD[id];
  if (!fn) return null;
  try { return fn(); } catch (e) { return null; }
}
