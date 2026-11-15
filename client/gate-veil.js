// The March gate, as a way through and not only a frame: a veil of light hung between its posts, sparks rising in
// it, a fire-glow on the ground before it and a light on the stones. On the Wilds side it is the Wastes showing
// through (ember-red); on the Wastes side it is the Wilds (green). client/wilds-scene.js and client/ember-scene.js
// each hang one; main.js ticks whichever scene is on screen (scene.userData.gateTick).
//
// The game's own dressing; nothing here is from the record.

const GV_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const GV_FRAG = `
  uniform float uT; uniform float uO; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
  float gvN(vec2 p) { return sin(p.x * 3.1 + sin(p.y * 2.3 + uT * 0.7)) * sin(p.y * 4.7 - uT * 1.3 + sin(p.x * 1.9)); }
  void main() {
    vec2 uv = vUv;
    // soft at the posts and the lintel, and thinning toward the top like heat off a fire
    float edge = smoothstep(0.0, 0.2, uv.x) * smoothstep(1.0, 0.8, uv.x) * smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.55, uv.y);
    float f = 0.5 + 0.5 * gvN(uv * vec2(2.0, 3.0) + vec2(0.0, -uT * 0.25));
    float g = 0.5 + 0.5 * gvN(uv * vec2(5.0, 7.0) + vec2(3.0, -uT * 0.6));
    float veil = (0.35 + 0.65 * f) * (0.6 + 0.4 * g);
    float streak = pow(0.5 + 0.5 * sin(uv.x * 38.0 + sin(uv.y * 6.0 + uT) * 2.0), 6.0) * 0.35;
    gl_FragColor = vec4(mix(uA, uB, f) * (veil + streak), edge * uO * (0.5 + 0.5 * veil));
  }
`;
export const GATE_SPARKS = 36;

// at: { x, y, z } the middle of the gate's foot; the gate stands across the road (its opening runs along z).
// tone: 'ember' (seen from the Wilds) or 'green' (seen from the Wastes). Returns tick(seconds).
export function hangGateVeil(THREE, scene, at, { tone = 'ember', width = 230, height = 205, quality = 'high', glowTex = null } = {}) {
  const ember = tone === 'ember';
  const A = new THREE.Color(ember ? 0xff3a10 : 0x3fae5a), B = new THREE.Color(ember ? 0xffc060 : 0xd8ffb0);
  const U = { uT: { value: 0 }, uO: { value: 0.85 }, uA: { value: A }, uB: { value: B } };
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 1, 1), new THREE.ShaderMaterial({ uniforms: U, vertexShader: GV_VERT, fragmentShader: GV_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  veil.rotation.y = Math.PI / 2; veil.position.set(at.x, at.y + height / 2 + 2, at.z); veil.renderOrder = 3; scene.add(veil);
  // sparks (or motes) rising between the posts
  const pos = new Float32Array(GATE_SPARKS * 3), seed = new Float32Array(GATE_SPARKS);
  for (let i = 0; i < GATE_SPARKS; i++) seed[i] = (i * 0.6180339887) % 1;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparks = new THREE.Points(geo, new THREE.PointsMaterial({ size: ember ? 9 : 7, map: glowTex || null, color: ember ? 0xffa040 : 0xc8ff9a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false; scene.add(sparks);
  // the light it throws: on the ground, and (not on low) on the stones
  let pool = null, lamp = null;
  if (glowTex) {
    pool = new THREE.Mesh(new THREE.CircleGeometry(width * 1.5, 28), new THREE.MeshBasicMaterial({ map: glowTex, color: ember ? 0xff6a20 : 0x7ad060, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(at.x, at.y + 3, at.z); pool.renderOrder = 2; scene.add(pool);
  }
  if (quality === 'high') { lamp = new THREE.PointLight(ember ? 0xff6a28 : 0x8fe070, 1.3, width * 3.2, 1.6); lamp.position.set(at.x, at.y + height * 0.55, at.z); scene.add(lamp); }
  return function tick(t) {
    U.uT.value = t;
    for (let i = 0; i < GATE_SPARKS; i++) {
      const s = seed[i], life = (t * (0.16 + 0.12 * s) + s * 7.0) % 1;
      pos[i * 3] = at.x + Math.sin(t * 0.9 + s * 40) * 6;
      pos[i * 3 + 1] = at.y + 6 + life * height * 0.95;
      pos[i * 3 + 2] = at.z + (s * 2 - 1) * width * 0.4 + Math.sin(t * 1.3 + s * 20) * 8;
    }
    geo.attributes.position.needsUpdate = true;
    const fl = 0.88 + 0.12 * Math.sin(t * 3.1) * Math.sin(t * 1.7 + 1.0);
    if (lamp) lamp.intensity = 1.3 * fl;
    if (pool) pool.material.opacity = 0.42 * fl;
  };
}
