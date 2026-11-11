// The town's wildflowers, the herbs in Mother Yarrow's beds, the town's fairy
// rings and the cottage's own furniture are models of the real things
// (tools/models/build_home.py, build_plants.py gd_*). Each must be on disk and
// sound, used where the hand-built one was, and leave the hand-built one as
// the stand-in until it lands.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
const wilds = fs.readFileSync(path.join(root, 'client/wilds-scene.js'), 'utf8');
const home = fs.readFileSync(path.join(root, 'tools/models/build_home.py'), 'utf8');
const plants = fs.readFileSync(path.join(root, 'tools/models/build_plants.py'), 'utf8');
function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67 || b.readUInt32LE(4) !== 2 || b.readUInt32LE(16) !== 0x4e4f534a) return null;
  return { json: JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')), bytes: b.length };
}
const models = {
  fp_foxglove: 'home/fp_foxglove', fp_meadow: 'home/fp_meadow', fp_harebell: 'home/fp_harebell', fp_campion: 'home/fp_campion',
  gd_chamomile: 'flora/gd_chamomile', gd_lavender: 'flora/gd_lavender', gd_calendula: 'flora/gd_calendula', gd_mugwort: 'flora/gd_mugwort', gd_rosemary: 'flora/gd_rosemary', gd_belladonna: 'flora/gd_belladonna',
  furn_cbed: 'home/bed', furn_hearth: 'home/hearth', furn_candle: 'home/candle_stand', furn_witchball: 'home/witch_ball',
};
const bad = [];
let maxBytes = 0;
for (const [key, file] of Object.entries(models)) {
  if (!main.includes(key + ": 'kk/" + file + ".glb'")) { bad.push('manifest ' + key); continue; }
  const g = readGlb(path.join(root, 'public/kk', file + '.glb'));
  if (!g) { bad.push('glb ' + file); continue; }
  maxBytes = Math.max(maxBytes, g.bytes);
  const prims = g.json.meshes.flatMap((m) => m.primitives);
  if (!prims.every((p) => p.attributes.COLOR_0 !== undefined && p.attributes.NORMAL !== undefined && g.json.accessors[p.attributes.POSITION].componentType === 5126) || (g.json.images || []).length) bad.push('unsound ' + file);
  const name = file.split('/')[1];
  if (!(home + plants).includes("'" + name + "':") && !(home + plants).includes("'" + key + "':")) bad.push('not built by a script ' + name);
}
check('every flower patch, garden herb and piece of furniture is in the manifest, on disk and sound', !bad.length, bad);
check('each is small enough to stream (under 100 KB)', maxBytes > 0 && maxBytes < 100 * 1024, maxBytes);
check("the town's flower decor is a patch of real wildflowers, which kind fixed by where it grows, with the hand-built patch standing in", /group = makeWildflowers\(d\.x, d\.y, d\.scale\) \|\| makeFlowerPatch\(d\.x, d\.y, d\.scale\);/.test(main) && /const WILDFLOWER_PATCHES = \['fp_foxglove', 'fp_meadow', 'fp_harebell', 'fp_campion'\];/.test(main) && !/Math\.random/.test(main.slice(main.indexOf('function makeWildflowers'), main.indexOf('function makeGardenHerb'))));
check("the wildflowers are part of the town's first paint (its decor is built once)", !/\(pl\|cr\|gv\|gd\|fp\)|\(pl\|cr\|gv\|fp/.test(main) && /\^\(pl\|cr\|gv\|gd\|fl\|cave\|wl\|alt\|tw\)_/.test(main));
check("Mother Yarrow's beds grow the Green Path herbs in the ground, the old blooms standing in", /const herb = makeGardenHerb && makeGardenHerb\(r \* 4 \+ c, px, pz\);/.test(wilds) && /if \(herb\) \{ scene\.add\(herb\); continue; \}/.test(wilds) && /makeFlowerPatch, makePlantBloom, makeGardenHerb, \/\/ Mother Yarrow's garden plot/.test(main));
check("the town's fairy rings become the real ring when it lands, the fae one still aglow", /KK\.staticInstance\('gv_toadring', 96, 'fit'\)/.test(main) && /if \(ring\.glow\) \{ const fae = new THREE\.PointLight\(0x8a5cf6/.test(main) && /scene\.remove\(t\.group\); scene\.add\(g\); t\.group = g; t\.real = true;/.test(main));
check('the cottage has its own bed, hearth, candle stand and witch ball, the hand-built ones standing in', /case 'bed':\s+g = kk\('furn_cbed', 200, 'fit'\)/.test(main) && /case 'hearth':\s+g = kk\('furn_hearth', 200, 'fit'\); if \(g\) addCottageFlame\(g, 'hearth'\)/.test(main) && /case 'candle_stand':\s+g = kk\('furn_candle', 88, 'height'\); if \(g\) addCottageFlame\(g, 'candle'\)/.test(main) && /case 'wall_charm':\s+g = kk\('furn_witchball', 40, 'height'\); if \(g\) g\.position\.y = 72;/.test(main) && /return buildProceduralProp\(id, meta, x, z, yaw\);/.test(main));
check("the hearth still burns and the candle still flickers on the models", /function addCottageFlame\(g, kind\)/.test(main) && /new THREE\.PointLight\(0xffb060, 1\.1, 420, 1\.8\)/.test(main.slice(main.indexOf('function addCottageFlame'))) && /flame\.position\.set\(0, top \+ 4, 0\)/.test(main));
const real = ['Digitalis purpurea', 'Campanula rotundifolia', 'red campion', 'ox-eye daisies', 'witch ball', 'box bed'];
check('each names what it is', real.every((w) => home.toLowerCase().includes(w.toLowerCase())));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
