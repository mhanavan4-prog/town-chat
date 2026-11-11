// Every tree, bush and tuft of grass is a real one now: the Wilds' named trees,
// the town's trees and bushes, the ground cover and the dead trees all point at
// models built by tools/models/build_grove.py, not recoloured stock shapes. And
// the nine Wolf's Pact spots in the Wilds, which were harvestable but drew
// nothing, grow wolf's-claw clubmoss.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-woods-');
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
const nature = fs.readFileSync(path.join(root, 'client/props-nature.js'), 'utf8');
const script = fs.readFileSync(path.join(root, 'tools/models/build_grove.py'), 'utf8');
function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67 || b.readUInt32LE(16) !== 0x4e4f534a) return null;
  return { json: JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')), bytes: b.length };
}
const want = {
  fl_watchpine: 'scots_pine', fl_deadwood: 'dead_tree_a', fl_hexoak: 'oak', fl_palebirch: 'silver_birch', fl_bramble: 'bramble', fl_thornsnarl: 'blackthorn',
  tree_leaf1: 'oak', tree_leaf2: 'rowan', tree_leaf3: 'beech', tree_leaf4: 'silver_birch',
  bush1: 'hazel', bush2: 'holly', bush3: 'dog_rose',
  grass1: 'grass_tussock', grass2: 'grass_rush', grass3: 'grass_bracken', grass4: 'grass_seeding',
  tree_bare1a: 'dead_tree_a', tree_bare1b: 'dead_tree_b', tree_bare1c: 'dead_tree_c', tree_bare2a: 'dead_tree_b', tree_bare2b: 'dead_tree_c', tree_bare2c: 'dead_tree_a',
};
const bad = []; let gate = 0; const seen = new Set();
for (const [key, file] of Object.entries(want)) {
  if (!new RegExp(key + ":\\s+'kk/grove/" + file + "\\.glb'").test(main)) { bad.push('manifest ' + key); continue; }
  const g = readGlb(path.join(root, 'public/kk/grove', file + '.glb'));
  if (!g) { bad.push('glb ' + file); continue; }
  const prims = g.json.meshes.flatMap((m) => m.primitives);
  if (!prims.every((p) => p.attributes.COLOR_0 !== undefined && g.json.accessors[p.attributes.POSITION].componentType === 5126) || (g.json.images || []).length) bad.push('unsound ' + file);
  if (!new RegExp("'" + file + "':").test(script)) bad.push('not in the script ' + file);
  if (!/^fl_/.test(key) && !seen.has(file)) { seen.add(file); gate += g.bytes; }
}
check('every tree, bush, grass tuft and dead tree points at a real model that is on disk and sound', !bad.length, bad);
check('no tree, bush or grass still uses a recoloured stock shape', !/kk\/nature\/(Tree|Bush|Grass)_|kk\/forest\//.test(main.replace(/\/\/.*$/gm, '')));
check("the town's share, which loads with its first paint, stays under 700 KB", gate > 0 && gate < 700 * 1024, gate);
check('grass tufts, scattered by the hundred, are a few KB each', ['grass_tussock', 'grass_rush', 'grass_seeding'].every((f) => fs.statSync(path.join(root, 'public/kk/grove', f + '.glb')).size < 8 * 1024));
check("the Wilds' named trees stream in behind the town", /\/\^\(pl\|cr\|gv\|gd\|fl\|cave\)_\//.test(main));
const real = ['Pinus sylvestris', 'Quercus robur', 'Betula pendula', 'Rubus fruticosus', 'Prunus spinosa', 'Sorbus aucuparia', 'Fagus sylvatica', 'Corylus avellana', 'Ilex aquifolium', 'Rosa canina'];
check('each names the real species', real.every((w) => script.includes(w)));
// The Wolf's Pact spots are drawn.
check("the Wolf's Pact spots have a look (clubmoss), a model and a size", /wolf_pact_brew:\s+\{ shape: 'sprout'/.test(nature) && /pl_wolf_pact_brew: 'kk\/flora\/wolf_pact_brew\.glb'/.test(main) && /wolf_pact_brew: \[30, 'fit'\]/.test(main) && fs.existsSync(path.join(root, 'public/kk/flora/wolf_pact_brew.glb')));
require('../server.js');
setTimeout(() => {
  const h = global.__testHooks; const W2 = h.world2 || h.WORLD2;
  const looks = new Set([...nature.matchAll(/^\s{2}(\w+):\s+\{ shape:/gm)].map((m) => m[1]));
  const plantSpots = W2.natureDecor.filter((d) => /^wdecor_/.test(d.id));
  const unseen = [...new Set(plantSpots.filter((d) => !looks.has(d.type)).map((d) => d.type))];
  check('every plant spot the server puts in the Wilds is one the client can draw', plantSpots.length > 0 && !unseen.length, unseen);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
