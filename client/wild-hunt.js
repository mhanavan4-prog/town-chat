// The Wild Hunt, as it is seen (lib/wildHunt.js on the server, data/wildHunt.js):
// the horn-rings in the night sky over the Wilds, the line at the top of the
// screen that says which horn is next and where, and the wake a rider trails.

const HUNT_WAKE_COLORS = { ash: 0x8a8478, frost: 0xbfe6ff, ember: 0xff7a3c, moon: 0xf4f0d8 };
const HUNT_WAKE_NAMES = { ash: 'Ash wake', frost: 'Frost wake', ember: 'Ember wake', moon: 'Moon wake' };

// Which way to go for the next horn, in words. dx/dz: the horn from her; alt: its height less hers.
function huntWayWords(dist, dAlt, reach) {
  const far = dist < 150 ? 'here' : `${Math.round(dist / 10) * 10} paces`;
  const up = dAlt > reach ? 'climb' : dAlt < -reach ? 'sink' : 'level';
  return dist < 150 ? (up === 'level' ? 'ride through' : `right ${dAlt > 0 ? 'above' : 'below'} you: ${up}`) : `${far} · ${up}`;
}
function huntLine(state, me, alt, riding) {
  if (!state || !state.night || !state.rings || !state.rings.length) return '';
  if (state.done) return '🐎 You have ridden with the Hunt tonight.';
  if (!riding) return `📯 The Wild Hunt rides · horn ${state.next + 1} of ${state.total} · get on your besom`;
  const r = state.rings[state.next];
  if (!r || !me) return '';
  return `📯 Horn ${state.next + 1} of ${state.total} · ${huntWayWords(Math.hypot(r.x - me.x, r.y - me.y), r.alt - alt, state.reach || 90)}`;
}

export default function createWildHuntView({ THREE, getScene, getMe, getAlt, isRiding }) {
  let state = null, group = null, groupScene = null, builtFor = '';
  let glow = null;
  function glowTex() {
    if (glow) return glow;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    glow = new THREE.CanvasTexture(c);
    return glow;
  }
  function clear() { if (group && group.parent) group.parent.remove(group); group = null; groupScene = null; builtFor = ''; }

  function build(scene) {
    clear();
    group = new THREE.Group(); group.name = 'wildHuntGlow'; group.userData.floats = true;
    const rings = state.rings;
    rings.forEach((r, i) => {
      const prev = rings[i - 1] || r, next = rings[i + 1] || r;
      const dx = next.x - prev.x, dz = next.y - prev.y;
      const ring = new THREE.Mesh(new THREE.TorusGeometry((state.radius || 110) * 0.8, 5, 8, 40),
        new THREE.MeshBasicMaterial({ color: 0xf2e6b8, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      ring.position.set(r.x, r.alt, r.y);
      ring.rotation.y = Math.atan2(dx, dz);   // faces along the course, to be ridden through
      // a thread of light down to the ground, so the horn can be found from far off
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, r.alt, 6, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xf2e6b8, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }));
      beam.position.set(r.x, r.alt / 2, r.y);
      const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff3c4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      spark.position.set(r.x, r.alt, r.y); spark.scale.setScalar(260);
      ring.userData.i = i; beam.userData.i = i; spark.userData.i = i;
      group.add(ring, beam, spark);
    });
    scene.add(group); groupScene = scene;
    builtFor = JSON.stringify(rings);
  }

  function onState(msg) { state = msg; }

  // Each frame: the rings (in the Wilds, by night), and the line at the top.
  function step(now) {
    const hud = document.getElementById('huntHud');
    const scene = getScene(), me = getMe();
    const show = !!(state && state.night && state.rings && state.rings.length && scene && me && me.room === 'wilds');
    if (!show) { if (group) clear(); if (hud && !hud.classList.contains('hidden')) hud.classList.add('hidden'); return; }
    if (!group || groupScene !== scene || builtFor !== JSON.stringify(state.rings)) build(scene);
    const next = state.done ? -1 : state.next, pulse = 0.5 + 0.5 * Math.sin(now * 0.004);
    for (const o of group.children) {
      const i = o.userData.i, isNext = i === next, ahead = next >= 0 && i > next;
      if (o.isSprite) o.material.opacity = isNext ? 0.5 + 0.35 * pulse : 0;
      else if (o.geometry.type === 'CylinderGeometry') o.material.opacity = isNext ? 0.16 + 0.1 * pulse : 0;
      else { o.visible = isNext || ahead; o.material.opacity = isNext ? 0.75 + 0.25 * pulse : 0.14; o.scale.setScalar(isNext ? 1 + 0.04 * pulse : 1); }
    }
    if (hud) {
      const text = huntLine(state, me, getAlt(), isRiding());
      if (hud.textContent !== text) hud.textContent = text;
      hud.classList.toggle('hidden', !text);
    }
  }

  // The wake behind a rider: a short line of fading lights from the broom's tail.
  const tmp = new THREE.Vector3();
  function wake(v, kind, riding, scene, now) {
    const color = riding && kind ? HUNT_WAKE_COLORS[kind] : null;
    let w = v.huntWake;
    if (!color || !v.mountBesom || !scene) {
      if (w) { for (const s of w.sprites) if (s.parent) s.parent.remove(s); v.huntWake = null; }
      return;
    }
    if (!w || w.scene !== scene || w.kind !== kind) {
      if (w) for (const s of w.sprites) if (s.parent) s.parent.remove(s);
      w = v.huntWake = { sprites: [], i: 0, last: 0, scene, kind };
      for (let k = 0; k < 16; k++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        s.name = 'huntWakeGlow'; s.userData.born = -1e9; s.userData.floats = true; scene.add(s); w.sprites.push(s);
      }
    }
    if (now - w.last > 70) {
      w.last = now;
      const s = w.sprites[w.i++ % w.sprites.length];
      v.mountBesom.getWorldPosition(tmp);
      s.position.copy(tmp); s.userData.born = now;
    }
    for (const s of w.sprites) {
      const age = (now - s.userData.born) / 1100;
      s.material.opacity = age >= 1 ? 0 : (1 - age) * 0.55;
      s.scale.setScalar(26 + age * 46);
    }
  }

  return { onState, step, wake, getState: () => state, clear };
}

export { HUNT_WAKE_COLORS, HUNT_WAKE_NAMES, huntLine, huntWayWords };
