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

// The sound of a horn ridden through: whispering, not a note. A horn's recording played faster to make it climb
// honked like a clown's; a voice played faster squeaks, so nothing here is bent. The ride builds instead by
// company: one whisper at the first horn, and more voices joining in as she goes (two from the fourth, three from
// the seventh), each a breath behind the last and a shade apart, a little louder each time and never loud. The last
// horn has its own sound: the whole host whispering at once.
// Record: the Wild Hunt is a host of the dead riding the night sky (Grimm gathered it; in Britain it is Herne's or
// Wild Edric's, and the Gabriel Hounds). That it whispers as it gathers round you is the game's.
function huntWhisperFor(passed, total) {
  const T = total || 9, n = Math.max(1, Math.min(T - 1, passed || 1));
  const along = T > 2 ? (n - 1) / (T - 2) : 0;
  const voices = 1 + Math.min(2, Math.floor((n - 1) / 3));
  const out = [];
  for (let v = 0; v < voices; v++) {
    const h = Math.sin(n * 12.9898 + v * 78.233) * 43758.5453, f = h - Math.floor(h);
    out.push({ delay: v === 0 ? 0 : 120 + v * 170 + Math.round(f * 90), rate: Math.round((0.96 + f * 0.08) * 1000) / 1000, vol: Math.round((0.3 + 0.28 * along) * (v === 0 ? 1 : 0.7) * 100) / 100 });
  }
  return out;
}

export default function createWildHuntView({ THREE, getScene, getMe, getAlt, isRiding, glowTexture }) {
  let state = null, group = null, groupScene = null, builtFor = '';
  // The soft round light used for the ring's heart and the wake is the game's own glow texture, built from
  // numbers (client/textures.js). A texture drawn on a canvas here came out in Safari as a pale blot speckled
  // with coloured squares.
  const glowTex = () => glowTexture();
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
      spark.position.set(r.x, r.alt, r.y); spark.scale.setScalar(200);
      ring.userData.i = i; beam.userData.i = i; spark.userData.i = i;
      group.add(ring, beam, spark);
    });
    scene.add(group); groupScene = scene;
    builtFor = JSON.stringify(rings);
  }

  // The line that says she has ridden tonight is shown for a little while after the last horn, then put away.
  let doneShownUntil = 0;
  function onState(msg) { state = msg; if (msg && msg.finished) doneShownUntil = performance.now() + 8000; }

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
      if (o.isSprite) o.material.opacity = isNext ? 0.3 + 0.25 * pulse : 0;
      else if (o.geometry.type === 'CylinderGeometry') o.material.opacity = isNext ? 0.16 + 0.1 * pulse : 0;
      else { o.visible = isNext || ahead; o.material.opacity = isNext ? 0.75 + 0.25 * pulse : 0.14; o.scale.setScalar(isNext ? 1 + 0.04 * pulse : 1); }
    }
    if (hud) {
      const text = state.done && now > doneShownUntil ? '' : huntLine(state, me, getAlt(), isRiding());
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
    // A light is dropped only when she has moved on from the last one: hovering in one place leaves no wake
    // (sixteen lights dropped on the same spot add up to a white blaze).
    if (now - w.last > 70) {
      v.mountBesom.getWorldPosition(tmp);
      if (!w.at || tmp.distanceTo(w.at) > 14) {
        w.last = now; w.at = (w.at || new THREE.Vector3()).copy(tmp);
        const s = w.sprites[w.i++ % w.sprites.length];
        s.position.copy(tmp); s.userData.born = now;
      }
    }
    for (const s of w.sprites) {
      const age = (now - s.userData.born) / 1100;
      s.material.opacity = age >= 1 ? 0 : (1 - age) * 0.32;
      s.scale.setScalar(20 + age * 34);
    }
  }

  return { onState, step, wake, getState: () => state, clear };
}

export { HUNT_WAKE_COLORS, HUNT_WAKE_NAMES, huntLine, huntWayWords, huntWhisperFor };
