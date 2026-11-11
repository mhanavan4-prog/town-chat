// The Wilds' own trees and bushes, the ogham grove and the crotal stone are
// models of the real trees, shrubs and stones (tools/models/build_grove.py).
// Each must be in the manifest, on disk, a sound glTF, sized as the hand-built
// one was, fade for the camera only if it is tall, and keep the hand-built one
// as its stand-in.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
const ogham = fs.readFileSync(path.join(root, 'client/props-ogham.js'), 'utf8');
const script = fs.readFileSync(path.join(root, 'tools/models/build_grove.py'), 'utf8');
function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67 || b.readUInt32LE(4) !== 2 || b.readUInt32LE(16) !== 0x4e4f534a) return null;
  return { json: JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')), bytes: b.length };
}
const types = ['mourning_willow', 'capwood', 'nightberry', 'fenfern', 'toadring', 'alder', 'ash_tree', 'hawthorn', 'wild_apple', 'ivy_bank', 'elder', 'gorse', 'heather', 'aspen', 'yew', 'crotal_stone'];
const block = main.slice(main.indexOf('const GROVE_MODELS = {'), main.indexOf('};', main.indexOf('const GROVE_MODELS = {')));
const bad = [];
let maxBytes = 0;
for (const t of types) {
  if (!new RegExp('gv_' + t + ": 'kk/grove/" + t + "\\.glb'").test(main)) { bad.push('manifest ' + t); continue; }
  const f = path.join(root, 'public/kk/grove', t + '.glb');
  const g = fs.existsSync(f) && readGlb(f);
  if (!g) { bad.push('glb ' + t); continue; }
  maxBytes = Math.max(maxBytes, g.bytes);
  const prims = g.json.meshes.flatMap((m) => m.primitives);
  if (!prims.every((p) => p.attributes.COLOR_0 !== undefined && p.attributes.NORMAL !== undefined && g.json.accessors[p.attributes.POSITION].componentType === 5126) || (g.json.images || []).length) bad.push('unsound ' + t);
  if (!new RegExp('\\b' + t + ": \\[\\d+, '(height|fit)', (true|false)\\]").test(block)) bad.push('no size ' + t);
  if (!new RegExp("'" + t + "':").test(script)) bad.push('not in the script ' + t);
}
check('all sixteen are in the manifest, on disk, sound, sized, and built by the script', !bad.length, bad);
check('each is small enough to stream (under 110 KB)', maxBytes > 0 && maxBytes < 110 * 1024, maxBytes);
// Only the tall ones fade for the camera, as the hand-built ones did.
const fades = Object.fromEntries([...block.matchAll(/(\w+): \[\d+, '\w+', (true|false)\]/g)].map((m) => [m[1], m[2] === 'true']));
const oghamTall = Object.fromEntries([...ogham.matchAll(/export function make(\w+)\(x, z, scale\) \{[\s\S]*?_done\(g, x, z, (true|false)\)/g)].map((m) => [m[1], m[2] === 'true']));
const nameOf = { alder: 'Alder', ash_tree: 'AshTree', hawthorn: 'Hawthorn', wild_apple: 'WildApple', ivy_bank: 'IvyBank', elder: 'Elder', gorse: 'Gorse', heather: 'Heather', aspen: 'Aspen', yew: 'Yew' };
check('the tall trees fade for the camera, the low bushes and the stone do not', Object.entries(nameOf).every(([t, n]) => fades[t] === oghamTall[n]) && fades.mourning_willow && fades.capwood && !fades.nightberry && !fades.fenfern && !fades.toadring && !fades.crotal_stone, { fades, oghamTall });
check('the decor builders use the model and keep the hand-built one as the stand-in', /return \{ \.\.\.spec, make: \(d\) => makeKKFlora\('gv_' \+ type, d, size, null, \{ mode, fade \}\) \|\| spec\.make\(d\) \};/.test(main) && /GROVE_MODELS\[t\] \? withGroveModel\(t, spec\) : spec/.test(main) && types.slice(0, 5).every((t) => new RegExp(t + ":\\s+withGroveModel\\('" + t + "'").test(main)));
check('they stream in behind the town with the plants and the creatures', /\.\.\.Object\.keys\(MANIFEST\)\.filter\(\(k\) => \/\^\(pl\|cr\|gv\|gd\|fl\|cave\|wl\|alt\|tw\|dg\|wd\)_\/\.test\(k\)\)/.test(main));
const real = ['Salix', 'dryad\'s saddle', 'Vaccinium myrtillus', 'Osmunda regalis', 'Marasmius oreades', 'Alnus glutinosa', 'Fraxinus excelsior', 'Crataegus monogyna', 'Malus sylvestris', 'Hedera helix', 'Sambucus nigra', 'Ulex europaeus', 'Calluna vulgaris', 'Populus tremula', 'Taxus baccata', 'Parmelia saxatilis'];
check('each names the real tree, plant, fungus or lichen it is', real.every((sp) => script.includes(sp)), real.filter((sp) => !script.includes(sp)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
