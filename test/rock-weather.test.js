// client/rock-weather.js: every stone in the game is broken and aged. The shape is chipped but never grows past
// what it was and never lifts off its foot; a carved stone keeps its shape; normalized and indexed models come
// through whole; the surface is aged in the shader from numbers, and a cloned material keeps the aging.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const THREE = require('../public/three.min.js');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const raw = read('client/rock-weather.js');
const src = raw.replace(/export const /g, 'const ').replace(/export function /g, 'function ');
const R = new Function('THREE', src + '\nreturn { weatherRockGeometry, weatherRockMaterial, weatherRock, reweatherRock, rockShaderParts, rockLike, ROCK_DEFAULT };')(THREE);

const box = (g) => { g.computeBoundingBox(); return g.boundingBox; };
const src1 = new THREE.DodecahedronGeometry(10, 0); const b0 = box(src1);
const w = R.weatherRockGeometry(THREE, src1, { cut: 1, split: 1, seed: 3 }), b1 = box(w);
const pos = w.attributes.position;
let finite = true; for (let i = 0; i < pos.count; i++) if (!Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))) finite = false;
check('split finer: four times the triangles', pos.count === src1.attributes.position.count * 4, [pos.count]);
check('every point is a number', finite);
check('chipped, only ever inward: it never grows past what it collided as', b1.min.x >= b0.min.x - 1e-6 && b1.max.x <= b0.max.x + 1e-6 && b1.max.y <= b0.max.y + 1e-6 && b1.min.z >= b0.min.z - 1e-6 && b1.max.z <= b0.max.z + 1e-6, [b0, b1]);
check('and it stays seated: its foot is where it was', Math.abs(b1.min.y - b0.min.y) < 0.05 * 20, [b0.min.y, b1.min.y]);
check('it really is broken: smaller than it was, by a cut and not a whisker', (b1.max.x - b1.min.x) + (b1.max.y - b1.min.y) + (b1.max.z - b1.min.z) < ((b0.max.x - b0.min.x) + (b0.max.y - b0.min.y) + (b0.max.z - b0.min.z)) * 0.97);
const h = w.attributes.rockH; let hl = 1, hh = 0; for (let i = 0; i < h.count; i++) { hl = Math.min(hl, h.getX(i)); hh = Math.max(hh, h.getX(i)); }
check('each point knows how high up the stone it is (for the moss at its foot)', h && hl === 0 && hh === 1);
let seamOk = true;
// twins along a seam move as one: no point of the source splits into two
{ const m = new Map(); const sp = new THREE.DodecahedronGeometry(10, 0); const g = R.weatherRockGeometry(THREE, sp, { cut: 1, split: 0, seed: 3 }); const sp2 = sp.attributes.position, gp = g.attributes.position;
  for (let i = 0; i < sp2.count; i++) { const k = [sp2.getX(i), sp2.getY(i), sp2.getZ(i)].map((v) => v.toFixed(4)).join(); const v = [gp.getX(i), gp.getY(i), gp.getZ(i)].map((q) => q.toFixed(4)).join(); if (m.has(k) && m.get(k) !== v) seamOk = false; m.set(k, v); } }
check('a corner shared by several faces moves as one, so the stone has no cracks in its skin', seamOk);
check('the same stone breaks the same way every time', R.weatherRockGeometry(THREE, src1, { cut: 1, split: 1, seed: 3 }).attributes.position.array.every((v, i) => v === pos.array[i]));

// a model as the loader gives it: indexed, normals as normalized bytes
const ig = new THREE.BufferGeometry();
ig.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]), 3));
ig.setAttribute('normal', new THREE.BufferAttribute(new Int8Array([0, 127, 0, 0, 127, 0, 0, 127, 0, 0, 127, 0]), 3, true));
ig.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2]);
const ow = R.weatherRockGeometry(THREE, ig, { cut: 1, split: 1 });
let nOk = true; for (let i = 0; i < ow.attributes.normal.count; i++) { const L = Math.hypot(ow.attributes.normal.getX(i), ow.attributes.normal.getY(i), ow.attributes.normal.getZ(i)); if (!(L > 0.9 && L < 1.1)) nOk = false; }
check('a model with byte normals and an index comes through whole (three of this age would leave its normals 127 long)', nOk && ow.attributes.position.count === 48);
const carved = R.weatherRockGeometry(THREE, ig, { cut: 0 });
check('a carved stone keeps its shape exactly (a milestone keeps its letters), only learning its height', carved.index && carved.attributes.position.array.every((v, i) => v === ig.attributes.position.array[i]) && carved.attributes.normal.normalized && carved.attributes.rockH);

// the surface
const parts = R.rockShaderParts({ ...R.ROCK_DEFAULT });
check('the aging is all sums in the shader: no pictures, no canvas', !/createElement|getContext|CanvasTexture|DataTexture|texture2D/.test(raw));
check('mottled, grained, cracked, darker beneath, lichened where the sky reaches, mossed at the foot', /mottled at three grains/.test(parts.frag) && /crystals/.test(parts.frag) && /hair-cracks/.test(parts.frag) && /darker underneath/.test(parts.frag) && /crotal/.test(parts.frag) && /wall-lichen/.test(parts.frag) && /moss at the foot/.test(parts.frag));
const burnt = R.rockShaderParts({ ...R.ROCK_DEFAULT, stone: 'basalt', lichen: 0, moss: 0 });
check('burnt stone has nothing growing on it', !/crotal/.test(burnt.frag) && !/moss at the foot/.test(burnt.frag));
const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
R.weatherRockMaterial(THREE, m, { lichen: 1 });
check('stone does not shine', m.roughness >= 0.95 && m.metalness === 0);
const sh = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
m.onBeforeCompile(sh);
check('it finds its places in the material\'s own shader', /vRH = rockH;/.test(sh.vertexShader) && /grime and moss at the foot/.test(sh.fragmentShader));
const c = m.clone();
const sh2 = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
c.onBeforeCompile(sh2);
check('a clone of an aged material is aged too (three does not copy the hook)', /vRH = rockH;/.test(sh2.vertexShader));
R.reweatherRock(c, { stone: 'basalt', lichen: 0, moss: 0 });
check('and can be burnt on its own without burning the stone it was cloned from', c.customProgramCacheKey() !== m.customProgramCacheKey() && /crotal/.test(m.customProgramCacheKey() + JSON.stringify(m.userData.rockWeather.lichen)) === false && m.userData.rockWeather.lichen === 1);
check('glass, lamps and painted parts are not stone', !R.rockLike(null, new THREE.MeshLambertMaterial({ color: 0xff2222 })) && !R.rockLike(null, new THREE.MeshLambertMaterial({ color: 0x888888, transparent: true })) && !R.rockLike(null, new THREE.MeshLambertMaterial({ color: 0x888888, emissive: 0x553300 })) && R.rockLike(null, new THREE.MeshLambertMaterial({ color: 0x8a877c })));

// where it is used
const main = read('client/main.js');
check('the models are aged once as they load, so every copy is', /if \(ROCK_WEATHER\[key\]\) \{ try \{ weatherRock\(THREE, gltf\.scene, ROCK_WEATHER\[key\], rockLike\);/.test(main) && /rock1: \{ \.\.\.ROCK_NATURAL/.test(main) && /stone_pillar: \{ cut: 1, split: 1/.test(main) && /wd_milestone: \{ \.\.\.ROCK_DRESSED \}/.test(main));
check('the hand-made stones are aged too: the Crick-stone, the ring\'s stand-ins, the fallback rocks, the crotal stone, the Wilds\' loose stones',
  /weatherRock\(THREE, holed,/.test(read('client/props-menantol.js')) && /weatherRock\(THREE, m,/.test(read('client/props-countless.js')) && /weatherRock\(THREE, rock,/.test(read('client/props-nature.js')) && /weatherRock\(THREE, rock, \{ cut: 0, lichen: 0\.5 \}\)/.test(read('client/props-stone.js')) && /if \(name === 'stone'\) weatherRock\(THREE, mesh,/.test(read('client/wilds-ground.js')));
check('the Wastes burn theirs', /reweatherRock\(m, \{ stone: 'basalt', lichen: 0, moss: 0 \}\)/.test(read('client/ember-scene.js')));
check('the season does not dye stone', /if \(m\.userData && m\.userData\.rockWeather\) continue;/.test(read('client/wilds-season.js')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
