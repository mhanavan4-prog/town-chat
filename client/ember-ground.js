// ---------------------------------------------------------------------------
// The Ember Wastes' ground, dressed.
//
// The plain is a field of ruby hex tiles, and it stays one: the tiles are the
// look of the place. But every tile was the same flat, loud red from the portal
// to the horizon. This lays the country over them, in the tiles' own shader,
// from the same four-scale noise the Wilds' ground reads (client/wilds-ground.js):
//
//   scorch   broad reaches where the ruby is burnt down to dark slag
//   ash      grey drifts lying over the tiles, dulling their shine
//   seams    thin veins of ember light running through the slag, breathing
//
// and it remakes the lava pools: they were three flat discs; now each is one
// sheet of slow-moving melt with a dark, broken crust at an uneven shore.
//
// Nothing here is a lore claim, and nothing changes where you can walk. On
// 'low' the tiles and the pools are left as they were.
// ---------------------------------------------------------------------------

export const EG_S = { macro: 2600, meso: 610, fine: 97 };   // world units per repeat of the noise, none a multiple of another

const EG_FRAG = `
uniform sampler2D uEN; uniform float uET;
varying vec3 vEW;
vec3 emberCountry(vec2 p) {
  float macro = texture2D(uEN, p / ${EG_S.macro.toFixed(1)}).r;
  float meso = texture2D(uEN, p / ${EG_S.meso.toFixed(1)} + 0.31).g;
  float fine = texture2D(uEN, p / ${EG_S.fine.toFixed(1)} + 0.67).b;
  float scorch = smoothstep(0.30, 0.58, macro * 0.72 + meso * 0.28);                 // 1 = burnt to slag
  float ash = smoothstep(0.50, 0.72, meso * 0.6 + fine * 0.25 + (1.0 - macro) * 0.15) * (0.35 + 0.65 * scorch);
  float vein = 1.0 - smoothstep(0.0, 0.035, abs(texture2D(uEN, p / 233.0 + 0.11).a - 0.5));
  vein *= smoothstep(0.35, 0.8, scorch) * (1.0 - ash);
  return vec3(scorch, ash, vein);
}
`;

// Lay the country over the ruby tile materials. `mats` are the MeshPhongMaterials of the instanced tiles; `noiseTex`
// is makeGroundNoise(THREE).tex. Returns { tick(t) }.
export function dressEmberTiles(THREE, mats, noiseTex) {
  const U = { uEN: { value: noiseTex }, uET: { value: 0 } };
  for (const mat of mats) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uEN = U.uEN; sh.uniforms.uET = U.uET;
      sh.vertexShader = 'varying vec3 vEW;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  #ifdef USE_INSTANCING
    vEW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  #else
    vEW = (modelMatrix * vec4(transformed, 1.0)).xyz;
  #endif`);
      sh.fragmentShader = EG_FRAG + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
  vec3 eC = emberCountry(vEW.xz);
  float eLit = dot(diffuseColor.rgb, vec3(0.5, 0.3, 0.2)) / 0.33;                    // how much of the day is left in the tile's own colour
  diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.60, 0.40, 0.44) * (0.82 + 0.36 * texture2D(uEN, vEW.xz / 410.0).g), vec3(0.085, 0.050, 0.048) * eLit, eC.x * 0.86);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.265, 0.25) * eLit, eC.y * 0.8);`)
        .replace('#include <specularmap_fragment>', '#include <specularmap_fragment>\n  specularStrength *= (1.0 - eC.y) * (1.0 - 0.6 * eC.x);')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance *= 0.6 * (1.0 - eC.x * 0.85) * (1.0 - eC.y);
  totalEmissiveRadiance += vec3(1.0, 0.36, 0.08) * eC.z * (0.55 + 0.3 * sin(uET * 0.9 + vEW.x * 0.004 + vEW.z * 0.003));`);
    };
    mat.customProgramCacheKey = () => 'emberTiles2';
    mat.needsUpdate = true;
  }
  return { tick(t) { U.uET.value = t; } };
}

const EG_LAVA = `
uniform sampler2D uEN; uniform float uET; uniform vec2 uEO; uniform float uER;
varying vec2 vEL;
vec4 emberLava() {
  vec2 p = (vEL + uEO) / 310.0;
  float r = length(vEL) / uER;
  float wob = texture2D(uEN, p * 1.9 + 0.2).r;
  r += (wob - 0.5) * 0.24;                                                        // an uneven shore
  float f1 = texture2D(uEN, p + vec2(uET * 0.011, uET * 0.007)).g;
  float f2 = texture2D(uEN, p * 2.3 - vec2(uET * 0.017, -uET * 0.009)).b;
  float heat = clamp(f1 * 0.62 + f2 * 0.38 + (0.55 - r) * 0.5, 0.0, 1.0);          // hotter toward the middle
  vec3 melt = mix(vec3(0.42, 0.045, 0.015), vec3(1.0, 0.32, 0.05), smoothstep(0.30, 0.56, heat));
  melt = mix(melt, vec3(1.0, 0.80, 0.36), smoothstep(0.60, 0.80, heat));
  float skin = smoothstep(0.50, 0.42, heat) * 0.75;                                // cooled rafts drifting on it
  melt = mix(melt, vec3(0.10, 0.035, 0.025), skin);
  float crust = smoothstep(0.74, 0.86, r);                                         // the shore: dark, broken, lit from the cracks
  float crack = 1.0 - smoothstep(0.0, 0.05, abs(texture2D(uEN, p * 3.1 + 0.5).a - 0.5));
  vec3 shore = vec3(0.115, 0.045, 0.030) + vec3(1.0, 0.34, 0.06) * crack * (1.0 - smoothstep(0.86, 1.0, r)) * 0.8;
  vec3 c = mix(melt, shore, crust);
  return vec4(c, 1.0 - smoothstep(0.96, 1.04, r));
}
`;

// One lava pool: a single sheet, `rad` to the outside of its crust. Unlit, as the old discs were.
export function makeLavaPool(THREE, noiseTex, x, z, rad, clock) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uEN = { value: noiseTex }; sh.uniforms.uET = clock; sh.uniforms.uEO = { value: new THREE.Vector2(x, z) }; sh.uniforms.uER = { value: rad };
    sh.vertexShader = 'varying vec2 vEL;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vEL = position.xy;');
    sh.fragmentShader = EG_LAVA + sh.fragmentShader.replace('#include <map_fragment>', 'vec4 eL = emberLava(); diffuseColor = eL;');
  };
  mat.customProgramCacheKey = () => 'emberLava1';
  const m = new THREE.Mesh(new THREE.CircleGeometry(rad * 1.12, 40), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(x, 1.8, z); m.renderOrder = 1; m.name = 'emberLava';
  return m;
}
