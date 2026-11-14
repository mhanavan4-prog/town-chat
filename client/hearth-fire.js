// A hearth's fire: an ember bed, five tongues of flame that lean and stretch out of step with one another, a few
// sparks going up, and a light that flickers with them. Drawn for the firebox of the hearth model
// (public/kk/home/hearth.glb): `s` is 1 for a hearth 190 across, and the fire stands at the group's origin, on the
// logs. THREE is passed in. Used by the village's hearths (client/village-house.js) and the one in your own home.
export function makeHearthFire(THREE, s = 1, { light = true } = {}) {
  const g = new THREE.Group();
  const now = () => performance.now() * 0.001;

  const bed = new THREE.Mesh(new THREE.CylinderGeometry(17 * s, 20 * s, 4 * s, 9), new THREE.MeshBasicMaterial({ color: 0xff5a14 }));
  bed.scale.z = 0.4; bed.position.set(0, 1 * s, -3 * s); g.add(bed);
  bed.onBeforeRender = () => { const k = 0.8 + 0.2 * Math.sin(now() * 3.1); bed.material.color.setRGB(1, 0.3 * k, 0.06 * k); };

  // a tongue of flame: wide low down, drawn to a point
  const prof = [[0, 0], [0.5, 0.1], [0.62, 0.28], [0.44, 0.6], [0.17, 0.85], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(prof, 7);
  // x, z, width, height, colour, opacity, phase, speed
  const TONGUES = [
    [0, 0, 15, 44, 0xff6a14, 0.82, 0.0, 5.1], [-13, 1, 10, 31, 0xff8a20, 0.8, 1.7, 6.3], [13, 0, 10.5, 35, 0xff7a1a, 0.8, 3.1, 5.7],
    [-4, 3, 8, 30, 0xffc040, 0.88, 0.9, 7.2], [5, 3, 6, 22, 0xfff0b0, 0.92, 2.3, 8.4],
  ];
  for (const [x, z, w, h, color, opacity, ph, sp] of TONGUES) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set(x * s, 3 * s, z * s);
    m.onBeforeRender = () => {
      const t = now();
      m.scale.set(w * s * (1 + 0.1 * Math.sin(t * sp * 0.7 + ph)), h * s * (0.86 + 0.16 * Math.sin(t * sp + ph) + 0.06 * Math.sin(t * sp * 2.3 + ph * 2)), w * s * 0.6);
      m.rotation.z = 0.1 * Math.sin(t * sp * 0.5 + ph * 1.3);
    };
    m.scale.set(w * s, h * s, w * s * 0.6);
    g.add(m);
  }

  // sparks: each goes up, drifts, and starts again
  const sparkGeo = new THREE.OctahedronGeometry(1.1 * s, 0);
  for (let k = 0; k < 5; k++) {
    const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const ph = k * 0.73, x0 = (k - 2) * 7 * s;
    m.onBeforeRender = () => {
      const u = ((now() * (0.35 + 0.07 * k)) + ph) % 1;
      m.position.set(x0 + Math.sin(u * 9 + ph) * 5 * s, (22 + u * 34) * s, 2 * s);
      m.material.opacity = 0.9 * (1 - u);
    };
    m.position.set(x0, 22 * s, 2 * s);
    g.add(m);
  }

  if (light) {
    const l = new THREE.PointLight(0xffa550, 1.0, 520 * Math.max(0.8, s), 1.7);
    l.position.set(0, 34 * s, 30 * s); g.add(l);
    l.userData.base = l.intensity;   // whoever places the fire may turn it up or down: set userData.base, the flicker reads it
    bed.onAfterRender = () => { const t = now(); l.intensity = l.userData.base * (0.86 + 0.1 * Math.sin(t * 9.3) + 0.06 * Math.sin(t * 23.1)); };
    g.userData.light = l;
  }
  return g;
}
