// The witch's shelves in her cave hold modelled things (tools/models/build_home.py,
// cave_*), dyed where the cave asks for a colour, with the hand-built shapes
// standing in until a model has loaded.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
const cave = fs.readFileSync(path.join(root, 'client/cave-scene.js'), 'utf8');
const glb = (f) => { const p = path.join(root, 'public/kk/home', f + '.glb'); if (!fs.existsSync(p)) return null; const b = fs.readFileSync(p); return JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const made = ['cave_potion', 'cave_candle', 'cave_crystal', 'cave_book', 'cave_hourglass', 'cave_eyejar', 'cave_jar', 'cave_moon', 'cave_mushroom', 'cave_feathers'];
check('the ten shelf models are in the manifest, streamed, and on disk', made.every((k) => main.includes(k + ": 'kk/home/" + k + ".glb'") && glb(k)) && /\(pl\|cr\|gv\|gd\|fl\|cave\)_/.test(main));
const uses = { makePotion: 'cave_potion', makeSkull: 'prop_skull', makeCandle: 'cave_candle', makeCrystal: 'cave_crystal', makeBook: 'cave_book', makeHourglass: 'cave_hourglass', makeEyeJar: 'cave_eyejar', makeBone: 'prop_bone_a', makeJar: 'cave_jar', makeMoon: 'cave_moon', makeMushroom: 'cave_mushroom', makeFeatherBundle: 'cave_feathers' };
const body = (fn) => cave.slice(cave.indexOf('  function ' + fn + '('), cave.indexOf('\n  }\n', cave.indexOf('  function ' + fn + '(')));
check('each of the twelve shelf builders uses a model and keeps its hand-built shape behind it', Object.entries(uses).every(([fn, k]) => body(fn).includes("shelfModel('" + k + "'") && /new THREE\.Mesh\(/.test(body(fn))), Object.keys(uses).filter((fn) => !body(fn).includes("shelfModel('" + uses[fn] + "'")));
const dyed = ['cave_potion', 'cave_candle', 'cave_crystal', 'cave_book', 'cave_jar', 'cave_mushroom', 'cave_eyejar'];
check('the dyed ones have a part to dye and trim that keeps its colour', dyed.every((k) => { const n = glb(k).materials.map((m) => m.name); return n.includes('Plant') && (n.includes('Trim') || n.includes('Glow')); }), dyed.map((k) => glb(k).materials.map((m) => m.name)));
check('the candles still burn, and the eye can be seen through its jar', /fl\.scale\.y = 1\.6; fl\.position\.y = cH \+ 2\.5; realCandle\.add\(fl\);/.test(cave) && /shelfModel\('cave_eyejar', 15\.5, 'height', x, y, z, null, \{ glass: 0\.5 \}\)/.test(cave));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
