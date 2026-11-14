// ---------------------------------------------------------------------------
// The town's ground, dressed.
//
// The town stands on a board of hex tiles, and it stays one. But each tile was
// a single flat colour: one green from the gate to the tree line, one brown
// for every path. This lays some country over the board in the tiles' own
// shader, from the four-scale noise the Wilds' ground reads
// (client/wilds-ground.js), by world position, so nothing repeats tile to tile:
//
//   the green    drifts between lush, dry and mossy in broad patches, with a
//                finer mottle over it so it reads as turf, not paint
//   the paths    get grit and pebbles, darker damp reaches, and a paler crown
//                where feet have worn them
//   the pond     moves: slow ripples and a little light on them
//
// Which is which is read from the tile's own colour (the paths are the brown of
// the tile's texture), so the road tiles need no second material. Nothing here
// changes where you can walk. On 'low' the board is left as it was.
// ---------------------------------------------------------------------------

export const TG_S = { macro: 1310, meso: 290, fine: 61, grit: 17 };   // world units per repeat, none a multiple of another

const TG_FRAG = `
uniform sampler2D uTN; uniform float uTT;
varying vec3 vTW;
vec3 townTurf(vec3 c, vec2 p) {
  float macro = texture2D(uTN, p / ${TG_S.macro.toFixed(1)}).r;
  float meso = texture2D(uTN, p / ${TG_S.meso.toFixed(1)} + 0.37).g;
  float fine = texture2D(uTN, p / ${TG_S.fine.toFixed(1)} + 0.71).b;
  float grit = texture2D(uTN, p / ${TG_S.grit.toFixed(1)} + 0.13).a;
  float lum = dot(c, vec3(0.3, 0.5, 0.2));
  float path = smoothstep(0.02, 0.10, c.r - c.g);                                 // the tile's brown is its path
  // turf: lush where the broad noise is high, dry where it is low, moss in the fine hollows
  vec3 lush = c * vec3(0.80, 1.06, 0.78), dry = c * vec3(1.16, 1.08, 0.74), moss = c * vec3(0.70, 0.90, 0.80);
  vec3 turf = mix(dry, lush, smoothstep(0.32, 0.68, macro * 0.6 + meso * 0.4));
  turf = mix(turf, moss, smoothstep(0.60, 0.80, meso * 0.5 + fine * 0.5) * 0.55);
  turf *= 0.86 + 0.28 * (fine * 0.6 + grit * 0.4);
  // path: grit, damp reaches, the odd pale pebble
  vec3 dirt = c * (0.80 + 0.34 * (fine * 0.5 + grit * 0.5));
  dirt = mix(dirt, c * vec3(0.66, 0.62, 0.60), smoothstep(0.55, 0.78, meso) * 0.55);
  dirt = mix(dirt, vec3(lum) * vec3(1.45, 1.40, 1.30), smoothstep(0.80, 0.86, grit * 0.7 + fine * 0.3) * 0.6);
  return mix(turf, dirt, path);
}
vec3 townPond(vec3 c, vec2 p) {
  float a = texture2D(uTN, p / 240.0 + vec2(uTT * 0.012, uTT * 0.008)).r;
  float b = texture2D(uTN, p / 131.0 - vec2(uTT * 0.016, -uTT * 0.011)).g;
  float rip = a * 0.55 + b * 0.45;
  float lum = dot(c, vec3(0.3, 0.5, 0.2)) / 0.62;
  vec3 w = mix(vec3(0.13, 0.33, 0.39), vec3(0.32, 0.58, 0.62), smoothstep(0.30, 0.70, rip)) * mix(1.0, min(lum, 1.3), 0.5);
  return w + smoothstep(0.70, 0.80, rip) * 0.16;
}
`;

// Dress tile materials. kind: 'turf' (grass and road tiles) or 'pond'. Returns { tick(t) }.
export function dressTownTiles(THREE, mats, noiseTex, kind) {
  const U = { uTN: { value: noiseTex }, uTT: { value: 0 } };
  for (const mat of mats) {
    if (!mat) continue;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTN = U.uTN; sh.uniforms.uTT = U.uTT;
      sh.vertexShader = 'varying vec3 vTW;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  #ifdef USE_INSTANCING
    vTW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  #else
    vTW = (modelMatrix * vec4(transformed, 1.0)).xyz;
  #endif`);
      sh.fragmentShader = TG_FRAG + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = ' + (kind === 'pond' ? 'townPond' : 'townTurf') + '(diffuseColor.rgb, vTW.xz);');
    };
    mat.customProgramCacheKey = () => 'townTiles3_' + kind;
    mat.needsUpdate = true;
  }
  return { tick(t) { U.uTT.value = t; } };
}
