// ---------------------------------------------------------------------------
// The witch-glyphs burned into the Wilds' ground, as fire and not as paint.
// A glyph is a cut in the earth with something still alight in it: the line burns unevenly, hot in one stretch
// and a dull ember in the next, the hot place creeping along the cut; a little of its light lies on the ground
// beside it; and now and then a mote lifts off and goes out. By day the fire is hard to see and what you notice
// is the burnt ground (client/textures.js makeGroundSigilTextures draws both).
// glyphFire() is the burning line (a shader on the glow decal); raiseGlyphMotes() is every glyph's motes, in one draw.
// ---------------------------------------------------------------------------

// how much of the fire shows by full day, against 1 at night
export const GLYPH_DAY = 0.4;
// motes per glyph, by graphics tier
export const GLYPH_MOTES = { low: 0, medium: 2, high: 4 };

const GLYPH_NOISE = `
  float glyphHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float glyphNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(glyphHash(i), glyphHash(i + vec2(1.0, 0.0)), f.x), mix(glyphHash(i + vec2(0.0, 1.0)), glyphHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }`;

// The glow decal's material: its texture's alpha says how near the middle of the cut a pixel is (1 in the cut,
// falling away through the light spilled beside it). Returns the uniform to keep fed: x seed, y seconds, z how
// strongly it shows (night and day).
export function glyphFire(mat, seed) {
  const u = { value: { x: seed, y: 0, z: 1 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGlyph = u;
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 uGlyph;' + GLYPH_NOISE + '\nvoid main() {')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float gS = texelColor.a;
          float gBurn = smoothstep(0.3, 0.78, glyphNoise(vUv * 6.0 + uGlyph.x + vec2(uGlyph.y * 0.06, -uGlyph.y * 0.045)));
          float gFlick = 0.78 + 0.44 * glyphNoise(vUv * 21.0 + uGlyph.x * 3.0 - uGlyph.y * 0.9);
          float gCore = smoothstep(0.5, 0.95, gS);
          float gLine = gCore * (0.3 + 1.25 * gBurn) * gFlick;       // a cooled stretch is a dull ember
          float gSpill = (1.0 - gCore) * gS * (0.7 + 1.5 * gBurn);  // and throws less light on the ground beside it
          diffuseColor.rgb = mix(diffuse, vec3(1.0), 0.2 * gBurn * gCore * gCore);   // only the liveliest of it goes white
          diffuseColor.a = opacity * (gLine + gSpill) * uGlyph.z;
        }`);
  };
  mat.customProgramCacheKey = () => 'glyph-fire';
  return u;
}

// how strongly the fire shows for a given daylight (1 full day, 0 full night)
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
