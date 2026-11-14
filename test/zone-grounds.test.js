// The Ember Wastes' and the town's ground, dressed (client/ember-ground.js, client/town-ground.js): the hex tiles stay,
// and country is laid over them in their own shaders. Low keeps what it had.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const eg = read('client/ember-ground.js'), tg = read('client/town-ground.js'), es = read('client/ember-scene.js'), main = read('client/main.js');
const load = (src, names) => new Function(src.replace(/export const /g, 'const ').replace(/export function /g, 'function ') + `\nreturn { ${names} };`)();
const E = load(eg, 'EG_S, dressEmberTiles, makeLavaPool'), T = load(tg, 'TG_S, dressTownTiles');

// a material stand-in: run the hook against stub shader text and see what it did
const PHONG_V = 'void main() {\n#include <begin_vertex>\n}', PHONG_F = 'void main() {\n#include <color_fragment>\n#include <specularmap_fragment>\n#include <emissivemap_fragment>\n#include <map_fragment>\n}';
const compile = (mat) => { const sh = { uniforms: {}, vertexShader: PHONG_V, fragmentShader: PHONG_F }; mat.onBeforeCompile(sh); return sh; };
const noScale = (S) => Object.values(S).every((a, i, all) => all.every((b, j) => i === j || (Math.max(a, b) / Math.min(a, b)) % 1 > 0.02));

check('ember: the noise is read at scales that never line up', noScale(E.EG_S));
const em = [{}, {}, {}], dressed = E.dressEmberTiles(null, em, 'NOISE');
const esh = compile(em[0]);
check('ember: every ruby tile material is dressed, with one clock between them', em.every((m) => typeof m.onBeforeCompile === 'function' && m.needsUpdate === true && m.customProgramCacheKey()) && compile(em[1]).uniforms.uET === esh.uniforms.uET && esh.uniforms.uEN.value === 'NOISE');
check('ember: by world position, through the instance matrix (nothing repeats tile to tile)', /USE_INSTANCING[\s\S]*modelMatrix \* instanceMatrix \* vec4\(transformed, 1\.0\)/.test(esh.vertexShader));
check('ember: scorch, ash and seams each do their part (colour, shine, glow)', /emberCountry\(vEW\.xz\)/.test(esh.fragmentShader) && /specularStrength \*=/.test(esh.fragmentShader) && /totalEmissiveRadiance \+=/.test(esh.fragmentShader) && /float scorch/.test(eg) && /float ash/.test(eg) && /float vein/.test(eg));
check('ember: the dressing works on the tile\'s own colour, so the night\'s dimming still shows', /eLit = dot\(diffuseColor\.rgb/.test(esh.fragmentShader) && /r\.mat\.color\.copy\(r\.base\)\.multiplyScalar/.test(read('client/ember-storm.js')));
dressed.tick(12.5);
check('ember: the seams breathe on the clock', esh.uniforms.uET.value === 12.5 && /sin\(uET \* /.test(esh.fragmentShader));

const T3 = { MeshBasicMaterial: function (o) { Object.assign(this, o); }, CircleGeometry: function (r, n) { this.r = r; this.n = n; }, Mesh: function (g, m) { this.geometry = g; this.material = m; this.rotation = {}; this.position = { set(x, y, z) { this.x = x; this.y = y; this.z = z; } }; }, Vector2: function (x, y) { this.x = x; this.y = y; } };
const clock = { value: 0 }, pool = new E.makeLavaPool(T3, 'NOISE', 900, 1200, 200, clock);
const lsh = compile(pool.material);
check('lava: one sheet where there were three discs, a little wider than its crust (the shore is uneven)', pool.geometry.r > 200 && pool.geometry.r < 240 && pool.position.x === 900 && pool.position.z === 1200 && pool.position.y > 0 && pool.position.y < 3);
check('lava: unlit as before, see-through only at its ragged edge', pool.material.transparent === true && pool.material.depthWrite === false && /1\.0 - smoothstep\(0\.96, 1\.04, r\)/.test(eg));
check('lava: it moves, on the scene\'s clock, and each pool is its own piece of the noise', lsh.uniforms.uET === clock && lsh.uniforms.uEO.value.x === 900 && lsh.uniforms.uER.value === 200 && /uET \* 0\.0/.test(eg));
check('ember scene: dressed on medium and high, left alone on low', /const emberRich = !\(GFX && GFX\.st && GFX\.st\.quality === 'low'\);/.test(es) && /emberNoise = emberRich \? makeGroundNoise\(THREE\)\.tex : null/.test(es) && /if \(emberNoise\) \{ scene\.add\(makeLavaPool\(/.test(es) && /GFX,\n\s*makeGlowTexture, setEmberAmbient/.test(main));
check('ember scene: the pools stand where they stood (the random draws come before the new pool is made)', es.indexOf('const ox = (rnd() - 0.5) * rad * 0.3') < es.indexOf('scene.add(makeLavaPool(') && es.indexOf('if (inTown(x, z)) continue;   // the town stands on cold ground') < es.indexOf('scene.add(makeLavaPool('));
check('ember scene: a failure leaves the tiles plain, not the Wastes broken', /ember ground: tiles left plain/.test(es));

check('town: the noise is read at scales that never line up', noScale(T.TG_S));
const tm = [{}, null, {}], pm = [{}];
T.dressTownTiles(null, tm, 'NOISE', 'turf'); const pond = T.dressTownTiles(null, pm, 'NOISE', 'pond');
const tsh = compile(tm[0]), psh = compile(pm[0]);
check('town: turf and paths share one shader; a missing tile material is passed over', /townTurf\(diffuseColor\.rgb, vTW\.xz\)/.test(tsh.fragmentShader) && typeof tm[2].onBeforeCompile === 'function' && tm[0].customProgramCacheKey() !== pm[0].customProgramCacheKey());
check('town: a path is known by the brown of its own tile (no second material for the road tiles)', /float path = smoothstep\(0\.02, 0\.10, c\.r - c\.g\);/.test(tg));
check('town: the pond moves', /townPond\(diffuseColor\.rgb, vTW\.xz\)/.test(psh.fragmentShader) && (pond.tick(3), psh.uniforms.uTT.value === 3) && /activeScene\.userData\.pondTick\(\)/.test(main));
check('town: the pond lies above the backstop plane (it had only ever shown that plane)', /pos\.y = 18\.5; m4\.compose\(pos, qt, waterScl\)/.test(main) && /base\.position\.set\(w\.width \/ 2, -6, w\.height \/ 2\)/.test(main) && -0.2 * 100 + 18.5 > -6 && -0.2 * 100 + 18.5 < 0);
check('town: dressed on medium and high, left alone on low; a failure leaves the board plain', /if \(GFX\.st\.quality !== 'low'\) \{\s*try \{\s*const tn = makeGroundNoise\(THREE\)\.tex;/.test(main) && /town ground: the board left plain/.test(main));
check('names are each module\'s own (one bundle, one scope)', [eg, tg].every((src) => src.split('\n').filter((l) => /^(export )?(const|function|let) /.test(l)).every((l) => /\b(EG_|TG_|dressEmberTiles|makeLavaPool|dressTownTiles)/.test(l))));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
