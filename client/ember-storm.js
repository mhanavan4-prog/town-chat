// ---------------------------------------------------------------------------
// The Ember Wastes' ash storms, as the player sees and hears them (server:
// lib/emberStorm.js). The fog closes in and greys, ash drives sideways past
// the camera, the wind loops, and a lantern is lit on every waymarker and
// fingerpost of the field's track, bright enough to show through it.
// THREE is global. The server only says which phase it is; how thick the
// storm looks eases toward that, so nothing jumps.
// ---------------------------------------------------------------------------
export default function createEmberStorm({ getScene, getCamera, isActive, makeGlowTexture, startSfxLoop, stopSfxLoop, playSfx, say }) {
  const TARGET = { calm: 0, gathering: 0.3, storm: 1 };
  const CALM = { near: 900, far: 5200, color: new THREE.Color(0x2a0f0a) };
  const THICK = { near: 60, far: 820, color: new THREE.Color(0x4b403a) };
  let phase = 'calm', strength = 0, built = null, wind = false;
  const tmp = new THREE.Color();

  function build(scene) {
    if (built && built.scene === scene) return built;
    const N = 700, RAD = 650;
    const pos = new Float32Array(N * 3), drift = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 2 * RAD; pos[i * 3 + 1] = Math.random() * 220; pos[i * 3 + 2] = (Math.random() - 0.5) * 2 * RAD; drift[i] = 0.6 + Math.random() * 0.8; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const ash = new THREE.Points(geo, new THREE.PointsMaterial({ size: 7, color: 0x9a8c84, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    ash.frustumCulled = false; ash.visible = false; scene.add(ash);
    // the track's lanterns: a warm glow on each marker, unfogged so it carries through the ash
    const lanterns = [];
    const tex = typeof makeGlowTexture === 'function' ? makeGlowTexture() : null;
    for (const [x, y, h] of (scene.userData && scene.userData.stormLights) || []) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffb35a, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      sp.scale.set(70, 70, 1); sp.position.set(x, h, y); sp.visible = false; scene.add(sp); lanterns.push(sp);
    }
    built = { scene, ash, pos, drift, RAD, lanterns };
    return built;
  }

  function apply(msg) {
    const next = TARGET[msg.phase] != null ? msg.phase : 'calm';
    // arriving into weather already on: say so (a turn of the weather has its own toast)
    if (!msg.turn && msg.says && next !== phase && typeof say === 'function') say(msg.says);
    phase = next;
    if (msg.sfx && typeof playSfx === 'function' && isActive()) playSfx(msg.sfx);
  }

  function setWind(on) {
    if (on === wind) return;
    wind = on;
    if (on) { if (typeof startSfxLoop === 'function') startSfxLoop('ash_storm_wind', 0.55, 4); }
    else if (typeof stopSfxLoop === 'function') stopSfxLoop('ash_storm_wind', 5);
  }

  function update(dt) {
    const scene = getScene();
    const here = !!(scene && isActive());
    const goal = here ? TARGET[phase] : 0;
    strength += Math.max(-dt * 0.12, Math.min(dt * 0.12, goal - strength));
    setWind(here && phase !== 'calm' && strength > 0.15);
    if (!scene) return;
    const b = build(scene);
    const s = strength;
    if (scene.fog) {
      scene.fog.near = CALM.near + (THICK.near - CALM.near) * s;
      scene.fog.far = CALM.far + (THICK.far - CALM.far) * s;
      tmp.copy(CALM.color).lerp(THICK.color, s); scene.fog.color.copy(tmp);
      if (scene.background && scene.background.isColor) scene.background.copy(tmp);
    }
    const show = s > 0.01;
    b.ash.visible = show && here;
    for (const l of b.lanterns) { l.visible = show; l.material.opacity = Math.min(1, s * 1.4); }
    if (!b.ash.visible) return;
    b.ash.material.opacity = 0.75 * s;
    const cam = getCamera(); if (!cam) return;
    const cx = cam.position.x, cz = cam.position.z, a = b.pos, R = b.RAD, wx = 520 * s, t = performance.now() / 1000;
    for (let i = 0; i < b.drift.length; i++) {
      a[i * 3] += wx * b.drift[i] * dt;
      a[i * 3 + 2] += Math.sin(t * 1.3 + i) * 40 * dt;
      a[i * 3 + 1] += Math.cos(t * 0.9 + i * 0.7) * 25 * dt;
      const dx = a[i * 3] - cx, dz = a[i * 3 + 2] - cz;
      if (dx > R || dx < -R || dz > R || dz < -R || a[i * 3 + 1] < 0 || a[i * 3 + 1] > 240) {
        a[i * 3] = cx - R + Math.random() * 60; a[i * 3 + 1] = Math.random() * 220; a[i * 3 + 2] = cz + (Math.random() - 0.5) * 2 * R;
        if (dx <= R && dx >= -R) a[i * 3] = cx + (Math.random() - 0.5) * 2 * R;
      }
    }
    b.ash.geometry.attributes.position.needsUpdate = true;
  }

  // QA: jump to how thick it will be (a slow headless frame rate would take minutes to get there)
  const settle = () => { strength = TARGET[phase] || 0; };
  return { apply, update, settle, phase: () => phase, strength: () => strength };
}
