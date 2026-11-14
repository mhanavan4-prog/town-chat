// Worn gear with models of its own (tools/models/build_gear.py -> public/kk/gear, client/gear-models.js):
// every ordinary thing that can be put on has one, so a character looks different for what it wears.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const ITEMS = require('../data/itemCatalog');
const mod = read('client/gear-models.js'), main = read('client/main.js'), py = read('tools/models/build_gear.py'), hum = read('client/humanoid.js'), guises = read('client/guises.js');
const IDS = [...mod.slice(mod.indexOf('GEAR_IDS = ['), mod.indexOf('];')).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
const WORN = Object.keys(ITEMS).filter((id) => ITEMS[id].slot);
// the holly wand keeps the lit tip it was drawn with (it lights the way at night), so it has no model of this kind
const EXEMPT = ['holly_wand'];

check('every ordinary thing that can be worn has a model, bar the holly wand', WORN.filter((id) => !EXEMPT.includes(id)).every((id) => IDS.includes(id)), WORN.filter((id) => !EXEMPT.includes(id) && !IDS.includes(id)));
check('and nothing is listed that cannot be worn', IDS.every((id) => ITEMS[id] && ITEMS[id].slot), IDS.filter((id) => !(ITEMS[id] && ITEMS[id].slot)));
check('each listed model is built (a file in public/kk/gear)', IDS.every((id) => fs.existsSync(path.join(root, 'public/kk/gear', id + '.glb'))), IDS.filter((id) => !fs.existsSync(path.join(root, 'public/kk/gear', id + '.glb'))));
check('each has its builder in build_gear.py', IDS.every((id) => new RegExp(`\\ndef ${id}\\(`).test(py) && new RegExp(`'${id}': ${id},`).test(py)), IDS.filter((id) => !new RegExp(`\\ndef ${id}\\(`).test(py)));
const sizes = IDS.map((id) => [id, fs.statSync(path.join(root, 'public/kk/gear', id + '.glb')).size]);
check('each is small (under 50 KB) and the whole wardrobe under 1 MB', sizes.every(([, s]) => s < 50000) && sizes.reduce((a, [, s]) => a + s, 0) < 1000000, sizes.filter(([, s]) => s >= 50000));
check('the models stream in the background, never holding up the way in', /for \(const id of GEAR_IDS\) MANIFEST\['gear_' \+ id\] = 'kk\/gear\/' \+ id \+ '\.glb';/.test(main) && /\.\.\.GEAR_IDS\.map\(\(id\) => 'gear_' \+ id\)\];/.test(main));
check('a seat for every slot', ['weapon', 'head', 'chest', 'feet', 'ring'].every((s) => new RegExp(`\\n  ${s}: \\{ pos: `).test(mod)));
check('gear drawn the old way is redrawn when its model arrives', /const stale = !!\(v\.kk && itemId && v\[meshKey\] && !v\[meshKey\]\.userData\.gear && KK/.test(main));
check('the old box bodies keep the old drawn gear', /_gearBody = !!v\.kk; v\[meshKey\] = makeFn\(itemId\); _gearBody = true;/.test(main));
check('a worn hat takes the place of the hat the body came with, and stays so (headwear is settled every frame)', /setEmbeddedHatVisible\(vis\) \{ for \(const m of embeddedHats\) \{ m\.userData\._gearHides = !vis;/.test(hum) && /\(worn \|\| m\.userData\._gearHides\) \? false : m\.userData\._hwBase/.test(guises));
check('boots stand square to the body, whichever way the foot bone points', /feet: \{[^\n]*body: true/.test(mod) && /if \(seat\.body && parent\.isBone\)/.test(main));

// ── the hundred legendaries: a model each as well, fetched when first seen worn ──
const LEG = require('../data/legendaryCatalog');
const LEGS = LEG.LEGENDARIES || LEG;
const LIDS = [...mod.slice(mod.indexOf('LEGEND_GEAR_IDS = ['), mod.indexOf('];', mod.indexOf('LEGEND_GEAR_IDS = ['))).matchAll(/'(lg_[a-z_]+)'/g)].map((m) => m[1]);
const pyl = read('tools/models/build_gear_legend.py');
const lgCat = Object.keys(LEGS).filter((id) => LEGS[id] && LEGS[id].slot);
check('every legendary has a model (a hundred of them)', lgCat.length === 100 && lgCat.every((id) => LIDS.includes(id)) && LIDS.length === lgCat.length, lgCat.filter((id) => !LIDS.includes(id)));
check('each is built: a builder in build_gear_legend.py and a file', LIDS.every((id) => new RegExp(`\\ndef ${id}\\(\\):\\n    """`).test(pyl) && fs.existsSync(path.join(root, 'public/kk/gear', id + '.glb'))), LIDS.filter((id) => !fs.existsSync(path.join(root, 'public/kk/gear', id + '.glb'))));
check('build_gear.py builds them with the rest', /from build_gear_legend import LEGEND/.test(py) && /GEAR\.update\(LEGEND\)/.test(py));
const lsizes = LIDS.map((id) => [id, fs.statSync(path.join(root, 'public/kk/gear', id + '.glb')).size]);
check('each legendary model is under 100 KB', lsizes.every(([, s]) => s < 100000), lsizes.filter(([, s]) => s >= 100000));
check('they are not fetched up front: no place in the manifest, asked for when first worn, and whoever wears one is redrawn when it lands',
  !/LEGEND_GEAR_IDS\) MANIFEST/.test(main) && /function wantGear\(itemId\)/.test(main) && /if \(!t\) \{ wantGear\(itemId\); return null; \}/.test(main)
  && /KK\.onGear\(\(\) => \{ for \(const id in players\) if \(visuals\[id\]\) applyEquipVisual\(id, players\[id\]\); \}\)/.test(main));
check('a chest piece asks for its model too (it is drawn only once the model is in)', /chest: \(v, itemId\) => \{ if \(v\.kk && itemId && KK\.wantGear\) KK\.wantGear\(itemId\);/.test(main));
check('a hat is fitted to the class it is on (the Knight\'s hair, the Mystic\'s hood, the Necromancer\'s skull)', /head: \{[^\n]*byChar: \{ 0: [^\n]*5: \{/.test(mod) && /seat\.byChar && seat\.byChar\[v\.kk\.charId\]/.test(main) && /mixer, act, inst, charId,/.test(hum));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
