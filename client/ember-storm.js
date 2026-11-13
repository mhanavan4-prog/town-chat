// ---------------------------------------------------------------------------
// The Ember Wastes' ash storms, as the player sees and hears them (server:
// lib/emberStorm.js). The fog closes in and greys, ash drives sideways past
// the camera, the wind loops, and a lantern is lit on every waymarker and
// fingerpost of the field's track, bright enough to show through it.
// THREE is global. The server only says which phase it is; how thick the
// storm looks eases toward that, so nothing jumps.
//
// The Wastes' night lives here too, since it works the same air: after dark
// the sky goes to old blood, the fog draws in, the lights go down, and the
// track's lanterns are lit every night, storm or none. On a night the
// witches' ring has not yet sung, it glows (scene.userData.ringGlow).
// ---------------------------------------------------------------------------
export default function createEmberStorm({ getScene, getCamera, isActive, makeGlowTexture, startSfxLoop, stopSfxLoop, playSfx, say, isNight = () => false }) {
  const TARGET = { calm: 0, gathering: 0.3, storm: 1 };
  const CALM = { near: 900, far: 5200, color: new THREE.Color(0x2a0f0a) };
  const THICK = { near: 60, far: 820, color: new THREE.Color(0x4b403a) };
  const NIGHT = { near: 420, far: 3400, color: new THREE.Color(0x0e0405) };
  const NIGHT_THICK = new THREE.Color(0x231c1a);
  const NIGHT_LIGHT = { ambient: 0.3, sun: 0.12, hemi: 0.2 };
  let phase = 'calm', strength = 0, built = null, wind = false, clearUntil = 0, nightK = 0, ringSung = false, wasNight = null;
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();

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
    // a loosed knot of wind (data/ashFolk.js) blows the ash back off you for a while
    const goal = here && performance.now() >= clearUntil ? TARGET[phase] : 0;
    strength += Math.max(-dt * 0.12, Math.min(dt * 0.12, goal - strength));
    setWind(here && phase !== 'calm' && strength > 0.15);
    if (!scene) return;
    const b = build(scene);
    const s = strength;
    // the night: eased in and out over a dozen seconds; a new night and the ring may sing again
    const night = !!isNight();
    if (night && wasNight === false) {                   // dusk came while we watched: a new night
      ringSung = false;
      if (isActive() && typeof playSfx === 'function') playSfx('dead_rise');   // and the field's dead get up
    }
    wasNight = night;
    nightK += Math.max(-dt * 0.08, Math.min(dt * 0.08, (night ? 1 : 0) - nightK));
    const n = nightK;
    if (scene.fog) {
      const near0 = CALM.near + (NIGHT.near - CALM.near) * n, far0 = CALM.far + (NIGHT.far - CALM.far) * n;
      scene.fog.near = near0 + (THICK.near - near0) * s;
      scene.fog.far = far0 + (THICK.far - far0) * s;
      tmp.copy(CALM.color).lerp(NIGHT.color, n); tmp2.copy(THICK.color).lerp(NIGHT_THICK, n);
      tmp.lerp(tmp2, s); scene.fog.color.copy(tmp);
      if (scene.background && scene.background.isColor) scene.background.copy(tmp);
    }
    const L = scene.userData && scene.userData.lights;
    if (L) for (const k of ['ambient', 'sun', 'hemi']) if (L[k]) L[k].intensity = L.base[k] + (NIGHT_LIGHT[k] - L.base[k]) * n;
    // the ruby ground glows less by night
    for (const r of (scene.userData && scene.userData.rubyMats) || []) { r.mat.color.copy(r.base).multiplyScalar(1 - 0.5 * n); r.mat.emissiveIntensity = 0.4 - 0.25 * n; }
    const lit = Math.max(s * 1.4, n * 0.9);
    for (const l of b.lanterns) { l.visible = lit > 0.01; l.material.opacity = Math.min(1, lit); }
    const ring = scene.userData && scene.userData.ringGlow;
    if (ring) {
      const k = ringSung ? 0 : Math.max(0, n * 2 - 1);
      ring.visible = k > 0.01;
      if (ring.visible) { const breathe = 0.65 + 0.35 * Math.sin(performance.now() / 900); ring.traverse((o) => { if (o.material) o.material.opacity = (o.isSprite ? 0.7 : 0.5) * k * breathe; }); }
    }
    const show = s > 0.01;
    b.ash.visible = show && here;
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
  const clear = (ms) => { clearUntil = performance.now() + ms; };
  const sung = () => { if (!ringSung && isActive() && typeof playSfx === 'function') playSfx('ring_dim'); ringSung = true; };   // the glow goes out, and can be heard to
  const settleNight = () => { nightK = isNight() ? 1 : 0; };
  return { apply, update, settle, settleNight, clear, sung, phase: () => phase, strength: () => strength, night: () => nightK };
}
