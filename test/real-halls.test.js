// What stands in the town's halls (tavern, library, great hall) is modelled:
// trestle table, bench, bookcase, banner, high seat, chandelier, shield and
// cresset (tools/models/build_home.py), with KayKit's barrel and the cottage's
// stone hearth. Each builder uses its model once loaded and keeps the hand-built
// shape as the stand-in.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
const furn = fs.readFileSync(path.join(root, 'client/furniture.js'), 'utf8');
const glb = (f) => { const p = path.join(root, 'public/kk/home', f + '.glb'); if (!fs.existsSync(p)) return null; const b = fs.readFileSync(p); return JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const keys = { furn_htable: 'hall_table', furn_hbench: 'hall_bench', furn_bookcase: 'bookcase', furn_banner: 'hall_banner', furn_highseat: 'high_seat', furn_chandelier: 'chandelier', furn_shield: 'wall_shield', furn_torch: 'standing_torch' };
check('the eight hall pieces are in the manifest (streamed with the furniture) and sound', Object.entries(keys).every(([k, f]) => main.includes(k + ": 'kk/home/" + f + ".glb'") && glb(f) && glb(f).meshes.every((m) => m.primitives.every((p) => p.attributes.COLOR_0 !== undefined))));
const body = (fn) => furn.slice(furn.indexOf('function ' + fn + '('), furn.indexOf('\n}\n', furn.indexOf('function ' + fn + '(')));
const uses = { buildTorch: 'furn_torch', makeTable: 'furn_htable', makeBench: 'furn_hbench', makeBarrel: 'prop_barrel', makeBookshelf: 'furn_bookcase', makeBanner: 'furn_banner', makeFireplace: 'furn_hearth', makeThrone: 'furn_highseat', makeChandelier: 'furn_chandelier', makeShield: 'furn_shield' };
check('each builder uses its model and keeps the hand-built shape behind it', Object.entries(uses).every(([fn, k]) => body(fn).includes("hallModel('" + k + "'") && /new THREE\.(Box|Cylinder|Plane|Circle|Torus)Geometry/.test(body(fn))), Object.keys(uses).filter((fn) => !body(fn).includes("hallModel('" + uses[fn] + "'")));
check('banners and shields are dyed the colour asked for, on the cloth and field only', /hallModel\('furn_banner', 50, 'height', x, y - 25, z, rotY, color\)/.test(furn) && /hallModel\('furn_shield', 28, 'height', x, y - 14, z, rotY, color\)/.test(furn) && /o\.material\.name === 'Plant'\) \{ o\.material = o\.material\.clone\(\); o\.material\.color\.setHex\(dye\); \}/.test(furn) && ['hall_banner', 'wall_shield'].every((f) => { const n = glb(f).materials.map((m) => m.name); return n.includes('Plant') && n.includes('Trim'); }));
check('the torch, the fireplace and the chandelier still burn and light the room', /fl\.position\.set\(0, 68, 0\); cresset\.add\(fl\);/.test(furn) && /new THREE\.PointLight\(0xff8a3a, 1\.1, 260\); warm\.position/.test(furn) && /new THREE\.PointLight\(0xffb86c, 0\.9, 220\); glow\.position\.y = 4; wheel\.add\(glow\);/.test(furn));
// A harvest that fails (a full pack, too far, not regrown) says why on screen even with notices quietened.
check('a failed harvest always says why on screen', /setUnlockToast\('🌿 ' \+ msg\.message, \{ always: true \}\);/.test(main.slice(main.indexOf("msg.type === 'harvest_error'"), main.indexOf("msg.type === 'harvest_error'") + 500)));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
