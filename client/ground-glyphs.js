// ---------------------------------------------------------------------------
// The witch-signs' light and motes. The signs themselves are cut into the turf (client/turf-sigils.js): by day
// you see the chalk; by night a cold light lies in the cut, and now and then a mote lifts off one and goes out.
// glyphShow() is how strongly the light shows for the hour; raiseGlyphMotes() is every sign's motes, in one draw.
// ---------------------------------------------------------------------------

// how much of the light in a cut shows by full day, against 1 at night: by day it is the chalk you see
export const GLYPH_DAY = 0.06;
// motes per glyph, by graphics tier
export const GLYPH_MOTES = { low: 0, medium: 2, high: 4 };

// how strongly the light shows for a given daylight (1 full day, 0 full night)
export function glyphShow(lightAmount) {
  const l = Math.max(0, Math.min(1, lightAmount == null ? 1 : lightAmount));
  return GLYPH_DAY + (1 - GLYPH_DAY) * (1 - l);
}

const MOTE_VERT = `
  attribute vec4 aSeed; attribute vec3 aCol;
  uniform float uT, uShow;
  varying vec3 vCol; varying float vA;
  void main() {
    float life = fract(uT * aSeed.y + aSeed.x);
    vec3 p = position;
    float sway = sin(uT * 0.9 + aSeed.x * 31.0) * 3.0 * life;
    p.x += cos(aSeed.z) * aSeed.w + sway;
    p.z += sin(aSeed.z) * aSeed.w + cos(uT * 0.7 + aSeed.x * 17.0) * 3.0 * life;
    p.y += 1.5 + life * 10.0 + life * life * 38.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(520.0 * (1.0 - life * 0.55) / -mv.z, 1.0, 5.0);
    vCol = aCol; vA = sin(life * 3.14159) * uShow;
  }`;
const MOTE_FRAG = `
  varying vec3 vCol; varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(vCol, vA * smoothstep(0.5, 0.08, d));
  }`;

// list: [{ x, y, z, r, col }] with y the ground there, r how far from the middle a mote may lift off, col a hex colour.
// Returns the uniforms ({ uT, uShow }), or null when the tier has no motes.
export function raiseGlyphMotes(THREE, scene, list, quality) {
  const per = GLYPH_MOTES[quality] == null ? GLYPH_MOTES.high : GLYPH_MOTES[quality];
  if (!per || !list.length) return null;
  const n = list.length * per, pos = new Float32Array(n * 3), seed = new Float32Array(n * 4), col = new Float32Array(n * 3);
  let s = 0x9e3779b9 >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const c = new THREE.Color();
  let k = 0;
  for (const g of list) {
    c.setHex(g.col);
    for (let i = 0; i < per; i++, k++) {
      pos[k * 3] = g.x; pos[k * 3 + 1] = g.y; pos[k * 3 + 2] = g.z;
      seed[k * 4] = rnd(); seed[k * 4 + 1] = 0.07 + rnd() * 0.09; seed[k * 4 + 2] = rnd() * Math.PI * 2; seed[k * 4 + 3] = (0.25 + rnd() * 0.75) * g.r;
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  const uniforms = { uT: { value: 0 }, uShow: { value: 1 } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 3;
  scene.add(pts);
  return uniforms;
}
