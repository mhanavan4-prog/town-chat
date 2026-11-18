// The floating-object audit. Walks a scene and reports anything solid that is
// not held up: not touching the ground, and not touching (through any chain of
// touching things) something that does. A building seated forty units too high
// has no part on the ground, so the whole of it is reported; a lantern on a
// post on a wall is held up by the wall and is not.
//
// Used by window.__testDrive.floaters() in the automated zone tours. Works on
// bounding boxes, so it is forgiving: it misses a thing that hovers inside
// another thing's box, and it does not cry wolf over a sign on a bracket.

const FLOAT_SKIP_NAME = /sky|cloud|stars?|moon|firefl|mote|smoke|flame|glow|beam|aura|spark|mist|fog|rain|snow|wisp|ghost|bird|crow|raven|moth|butterfl|banner|flag|shadow|ripple|foam|label|nameplate|grass/i;

function floatSkips(o) {
  if (!o.isMesh || o.isSkinnedMesh || o.isSprite || o.isPoints || o.isLine) return true;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!m || m.visible === false) return true;
  if (m.transparent || m.opacity < 1 || m.depthWrite === false || (m.blending !== undefined && m.blending !== 1)) return true;
  for (let p = o; p; p = p.parent) {
    if (!p.visible) return true;
    if (p.isBone) return true;   // worn on a body: a hat, a blade in the hand
    // a creature with wings is in the air on purpose: any part of a body that has a wing among its parts (found by a self-check in Safari)
    if ((p.name && /^wing_[LR]$/.test(p.name)) || (p.children && p.children.some((c) => /^wing_[LR]$/.test(c.name)))) return true;
    if (p.userData && (p.userData.gfxSky || p.userData.floats)) return true;
    if (p.name && FLOAT_SKIP_NAME.test(p.name)) return true;
  }
  return false;
}

// Who to blame: the nearest ancestor with a name, or the shape of the thing.
function floatName(o) {
  for (let p = o; p; p = p.parent) if (p.name) return p.name;
  const g = o.geometry || {};
  return g.type || 'mesh';
}

function findFloaters(THREE, scene, floorAt, opts) {
  const o = opts || {};
  const touch = o.touch != null ? o.touch : 8;       // how close to the ground counts as on it
  const gap = o.gap != null ? o.gap : 8;             // how close two things must be to hold each other
  const minGap = o.minGap != null ? o.minGap : 12;   // how high a thing must float to be worth reporting
  const huge = o.huge || 3000;                       // the ground, a sky dome, a sea: holds things up, is never reported
  const boxes = [];
  const box = new THREE.Box3(), m4 = new THREE.Matrix4(), tmp = new THREE.Box3();
  scene.updateMatrixWorld(true);
  scene.traverse((mesh) => {
    if (floatSkips(mesh)) return;
    const g = mesh.geometry; if (!g) return;
    if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox || !isFinite(g.boundingBox.min.y)) return;
    const add = (b) => {
      if (!isFinite(b.min.x + b.max.x + b.min.y + b.max.y + b.min.z + b.max.z)) return;   // a hidden instance (scale 0)
      const w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
      boxes.push({ x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z, big: w > huge, mesh, held: false });
    };
    if (mesh.isInstancedMesh) {
      const n = Math.min(mesh.count, o.maxInstances || 20000);
      for (let i = 0; i < n; i++) { mesh.getMatrixAt(i, m4); m4.premultiply(mesh.matrixWorld); tmp.copy(g.boundingBox).applyMatrix4(m4); add(tmp); }
    } else { box.copy(g.boundingBox).applyMatrix4(mesh.matrixWorld); add(box); }
  });

  // On the ground: the lowest point reaches the floor somewhere under the box.
  const floorUnder = (b) => {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    return Math.max(floorAt(cx, cz), floorAt(b.x0, b.z0), floorAt(b.x1, b.z0), floorAt(b.x0, b.z1), floorAt(b.x1, b.z1));
  };
  const cell = 96, grid = new Map(), bigs = [];
  const key = (i, j) => i * 100003 + j;
  boxes.forEach((b, idx) => {
    if (b.big) { b.held = true; bigs.push(b); return; }
    for (let i = Math.floor((b.x0 - gap) / cell); i <= Math.floor((b.x1 + gap) / cell); i++)
      for (let j = Math.floor((b.z0 - gap) / cell); j <= Math.floor((b.z1 + gap) / cell); j++) {
        const k = key(i, j); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(idx);
      }
    b.floor = floorUnder(b);
    if (b.y0 <= b.floor + touch) b.held = true;
  });
  // Indoors the walls and ceiling are cut away so the room can be seen into, and
  // are not there to hold anything. A thing against the edge of the floor hangs
  // on a wall; a thing whose top is up at ceiling height hangs from the ceiling.
  if (o.room) {
    let rx0 = Infinity, rx1 = -Infinity, rz0 = Infinity, rz1 = -Infinity;
    for (const b of boxes) if (b.held) { rx0 = Math.min(rx0, b.x0); rx1 = Math.max(rx1, b.x1); rz0 = Math.min(rz0, b.z0); rz1 = Math.max(rz1, b.z1); }
    const reach = o.wallReach || 45, ceil = o.ceiling || 105;
    for (const b of boxes) {
      if (b.held) continue;
      if (b.y1 >= ceil || b.x0 - rx0 <= reach || rx1 - b.x1 <= reach || b.z0 - rz0 <= reach || rz1 - b.z1 <= reach) b.held = true;
    }
  }
  const touches = (a, b) => a.x0 <= b.x1 + gap && b.x0 <= a.x1 + gap && a.z0 <= b.z1 + gap && b.z0 <= a.z1 + gap && a.y0 <= b.y1 + gap && b.y0 <= a.y1 + gap;
  const neighbours = (b, fn) => {
    const seen = new Set();
    for (let i = Math.floor((b.x0 - gap) / cell); i <= Math.floor((b.x1 + gap) / cell); i++)
      for (let j = Math.floor((b.z0 - gap) / cell); j <= Math.floor((b.z1 + gap) / cell); j++)
        for (const idx of grid.get(key(i, j)) || []) { if (seen.has(idx)) continue; seen.add(idx); const c = boxes[idx]; if (c !== b && touches(b, c)) fn(c); }
  };
  // Anything standing on a deck, a platform or a sea that is itself too big to
  // report is held by it, but only where it actually rests on it.
  for (const b of boxes) if (!b.held) for (const g of bigs) if (g.mesh !== b.mesh && touches(b, g) && Math.abs(b.y0 - g.y1) <= gap) { b.held = true; break; }
  const queue = boxes.filter((b) => b.held && !b.big);
  while (queue.length) { const b = queue.pop(); neighbours(b, (c) => { if (!c.held) { c.held = true; queue.push(c); } }); }

  // What is left floats. Gather it into things, each a set of touching parts.
  const out = [];
  for (const b of boxes) {
    if (b.held || b.seen) continue;
    const part = [], stack = [b]; b.seen = true;
    while (stack.length) { const c = stack.pop(); part.push(c); neighbours(c, (d) => { if (!d.held && !d.seen) { d.seen = true; stack.push(d); } }); }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const names = new Map();
    for (const c of part) {
      x0 = Math.min(x0, c.x0); x1 = Math.max(x1, c.x1); y0 = Math.min(y0, c.y0); y1 = Math.max(y1, c.y1); z0 = Math.min(z0, c.z0); z1 = Math.max(z1, c.z1);
      const n = floatName(c.mesh); names.set(n, (names.get(n) || 0) + 1);
    }
    const floor = floorAt((x0 + x1) / 2, (z0 + z1) / 2);
    const up = y0 - floor;
    if (up < minGap || Math.max(x1 - x0, y1 - y0, z1 - z0) < (o.minSize || 16)) continue;   // not floating, or too small to be a thing (a spark, a mote)
    const name = [...names.entries()].sort((a, c) => c[1] - a[1]).slice(0, 2).map((e) => e[0]).join('+');
    out.push({ name, x: Math.round((x0 + x1) / 2), z: Math.round((z0 + z1) / 2), bottom: Math.round(y0), gap: Math.round(up), w: Math.round(Math.max(x1 - x0, z1 - z0)), h: Math.round(y1 - y0), parts: part.length });
  }
  out.sort((a, c) => c.w * c.h - a.w * a.h);
  return { checked: boxes.length, floating: out.length, list: out.slice(0, o.top || 40) };
}

export { findFloaters };
