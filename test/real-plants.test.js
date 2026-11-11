// The Wilds plants and the cottage pots are models of the real plants they
// stand for (tools/models/build_plants.py), not coloured spheres and cones.
// Each one must be in the manifest, on disk, a sound binary glTF that three
// r128 can draw (vertex colours, normals, no textures to fetch), small enough
// to stream, and still fall back to the hand-built shape until it lands.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
const nature = fs.readFileSync(path.join(root, 'client/props-nature.js'), 'utf8');
const script = fs.readFileSync(path.join(root, 'tools/models/build_plants.py'), 'utf8');

// A .glb, read the way a loader would: header, JSON chunk, binary chunk.
function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67 || b.readUInt32LE(4) !== 2) return null; // 'glTF', v2
  const jsonLen = b.readUInt32LE(12);
  if (b.readUInt32LE(16) !== 0x4e4f534a) return null; // 'JSON'
  const json = JSON.parse(b.slice(20, 20 + jsonLen).toString('utf8'));
  return { json, bytes: b.length };
}

const plantTypes = [...nature.matchAll(/^\s{2}(\w+):\s+\{ shape:/gm)].map((m) => m[1]);
check('there are seventeen Wilds plants to model (the sixteen, and the clubmoss where the Wolf\'s Pact is gathered)', plantTypes.length === 17, plantTypes);
const sizeBlock = main.slice(main.indexOf('const PLANT_MODEL_SIZE = {'), main.indexOf('};', main.indexOf('const PLANT_MODEL_SIZE = {')));
const pots = { potted_herb: 'pot_herb', decor_chamomile: 'pot_chamomile', decor_lavender: 'pot_lavender', decor_calendula: 'pot_calendula', decor_mugwort: 'pot_mugwort', decor_yarrow: 'pot_yarrow', decor_belladonna: 'pot_belladonna' };

const models = [...plantTypes.map((t) => ['pl_' + t, t]), ...Object.values(pots).map((p) => ['furn_' + p, p])];
let allSound = true, maxBytes = 0, bad = [];
for (const [key, file] of models) {
  const re = new RegExp(key + ": 'kk/flora/" + file + "\\.glb'");
  if (!re.test(main)) { bad.push('manifest ' + key); allSound = false; continue; }
  const f = path.join(root, 'public/kk/flora', file + '.glb');
  if (!fs.existsSync(f)) { bad.push('missing ' + file); allSound = false; continue; }
  const g = readGlb(f);
  if (!g) { bad.push('not a glb ' + file); allSound = false; continue; }
  maxBytes = Math.max(maxBytes, g.bytes);
  const prims = (g.json.meshes || []).flatMap((m) => m.primitives);
  const ok = prims.length > 0 && prims.every((p) => 'POSITION' in p.attributes && 'NORMAL' in p.attributes && 'COLOR_0' in p.attributes)
    && !(g.json.images || []).length && !(g.json.textures || []).length
    // three r128 cannot read quantized positions back for bounding boxes: keep them float
    && prims.every((p) => g.json.accessors[p.attributes.POSITION].componentType === 5126)
    && !(g.json.extensionsRequired || []).some((e) => !['KHR_mesh_quantization'].includes(e));
  if (!ok) { bad.push('unsound ' + file); allSound = false; }
  if (!new RegExp("'" + file + "':").test(script)) { bad.push('not built by the script ' + file); allSound = false; }
}
check('every plant and pot is in the manifest, on disk, and a sound glTF: vertex colours and normals, no textures, float positions', allSound, bad);
check('each is small enough to stream (under 120 KB)', maxBytes > 0 && maxBytes < 120 * 1024, maxBytes);
check('every plant has a size to stand at', plantTypes.every((t) => new RegExp('\\b' + t + ": \\[\\d+, '(height|fit)'\\]").test(sizeBlock)));
check('the plants stream in behind the town, so the first load is no heavier', /\.\.\.Object\.keys\(MANIFEST\)\.filter\(\(k\) => \/\^\(pl\|cr\|gv\|gd\|fl\|cave\|wl\|alt\|tw\)_\/\.test\(k\)\)/.test(main));
check('makePlant draws the model when it has landed, and the hand-built shape till then', /const real = size && KK\.staticInstance \? KK\.staticInstance\('pl_' \+ type, size\[0\], size\[1\]\) : null;/.test(main) && /if \(v\.shape === 'bloom'\) return makePlantBloom/.test(main));

// The pots: every grown decor has its own, and the plain pot is rosemary.
const furn = fs.readFileSync(path.join(root, 'data/furniture.js'), 'utf8');
const grown = [...furn.matchAll(/id: '(decor_\w+)'[^\n]*source: 'grown'/g)].map((m) => m[1]);
const potMap = main.slice(main.indexOf('const COTTAGE_POT_MODELS = {'), main.indexOf('};', main.indexOf('const COTTAGE_POT_MODELS = {')));
check('every herb you can pot has a model of that herb', grown.length >= 6 && grown.every((id) => new RegExp(id + ": 'furn_pot_").test(potMap)) && /potted_herb: 'furn_pot_herb'/.test(potMap), grown);
check('the pots stream with the furniture, and the cottage redraws when one lands', /cottageAwaitingKK\.add\(key\)/.test(main) && /for \(const k of cottageAwaitingKK\) if \(KK\.has\(k\)\) \{ renderCottageFurniture\(lastCottageLayout\)/.test(main));
check('the hanging yarrow hangs on the wall where its peg was', /if \(g && meta && meta\.hang\) g\.position\.y = 34;/.test(main));

// Each model is the plant the docstring says, and the script names it.
const real = { toadstool: 'Amanita muscaria', wolfsbane_bloom: 'Aconitum napellus', shrinking_violet: 'Viola odorata', rainbow_petal: 'Viola tricolor', stumbleweed: 'Lolium temulentum', gibberish_root: 'Mandragora officinarum', meditation_lotus: 'Nymphaea alba', healing_herb: 'Prunella vulgaris', regen_root: 'Taraxacum officinale', cleansing_clover: 'Trifolium repens', giants_cap: 'Macrolepiota procera', featherleaf: 'Dryopteris filix-mas', swift_root: 'Daucus carota', pumpkin_blossom: 'Cucurbita pepo', bats_breath: 'Tacca chantrieri', ravens_feather_plant: 'Helleborus', wolf_pact_brew: 'Lycopodium clavatum' };
check('each plant names the real species it is modelled on', Object.values(real).every((sp) => script.includes(sp)) && Object.keys(real).length === 17);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
