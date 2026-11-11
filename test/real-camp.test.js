// The Thornwarden scouts' camp in the Wilds and the town's memorial stones and
// board are modelled (tools/models/build_home.py): ridge tents, palisade
// stakes, a watchtower, a weapon rack, a pennant, KayKit's crates and the
// modelled camp fire; a round-headed stone with its candles; a pentice board.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
const wilds = fs.readFileSync(path.join(root, 'client/wilds-scene.js'), 'utf8');
const town = fs.readFileSync(path.join(root, 'client/town-scene.js'), 'utf8');
const glb = (f) => { const p = path.join(root, 'public/kk/home', f + '.glb'); if (!fs.existsSync(p)) return null; const b = fs.readFileSync(p); return JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const keys = { wl_tent: 'camp_tent', wl_stake: 'palisade_stake', wl_tower: 'watchtower', wl_rack: 'weapon_rack', wl_pennant: 'pennant_pole', tw_headstone: 'headstone', tw_board: 'notice_board', wl_megalith: 'megalith', wl_altarslab: 'altar_slab', tw_pyre: 'pyre' };
check('the ten models are in the manifest and sound', Object.entries(keys).every(([k, f]) => main.includes(k + ": 'kk/home/" + f + ".glb'") && glb(f) && glb(f).meshes.every((m) => m.primitives.every((p) => p.attributes.COLOR_0 !== undefined))), Object.entries(keys).filter(([, f]) => !glb(f)));
check('they stream in behind the first paint with the other built models', /\/\^\(pl\|cr\|gv\|gd\|fl\|cave\|wl\|alt\|tw\|dg\|wd\)_\/\.test\(k\)/.test(main));
const camp = wilds.slice(wilds.indexOf('function addThornwardenCamp('), wilds.indexOf('function addGiantWerewolfTree('));
check('the camp uses each model when it has loaded, and builds the old shape when not', ['wl_stake', 'wl_tent', 'prop_crate', 'wl_tower', 'wl_campfire', 'wl_rack', 'wl_pennant'].every((k) => camp.includes("real('" + k + "'")) && /KK\.has\(key\) && KK\.staticInstance\) \? KK\.staticInstance\(key, size, mode\) : null/.test(camp) && (camp.match(/new THREE\.(Box|Cylinder|Cone)Geometry/g) || []).length > 12);
check('the tents open to the south, the pennant is dyed the scouts\' red, the fire still burns and lights the camp', /real\('wl_tent', 190, 'fit', tx, tz, -Math\.PI \/ 2/.test(camp) && /real\('wl_pennant', 150, 'height', flagX, flagZ, 0, 0x8a1010\)/.test(camp) && /fireFlame\.scale\.y = 1\.8; fireFlame\.position\.set\(CX, 28, CZ \+ 55\);\s+scene\.add\(fireFlame\);/.test(camp) && /scene\.add\(campLight\);/.test(camp));
check('the memorial and the After the Law stone become the modelled stone, candles still lit', /altarModel\(g, 'tw_headstone', 64, 'height', \(grp\) => \{ for \(const dx of \[-14, 14\]\) grp\.add\(stoneFlame\(dx, 15, 8, 1\)\); \}\);/.test(town) && /altarModel\(g, 'tw_headstone', 41, 'height'/.test(town));
check('the Town Board becomes the modelled board, its panel stained violet', /altarModel\(g, 'tw_board', 74, 'height', \(grp\) => grp\.traverse/.test(town) && /o\.material\.color\.setHex\(0x5a4a80\)/.test(town));
const circle = wilds.slice(wilds.indexOf('function addUnboundCircleSet('), wilds.indexOf('function addThornwardenCamp('));
check('the Unbound Circle: carved standing stones facing the middle, a three-stone altar, cressets, the small boundary stones', /real\('wl_megalith', h, 'height', sx, sz, angle \+ Math\.PI/.test(circle) && /real\('wl_altarslab', 74, 'fit', CX, CZ, 0\)/.test(circle) && /real\('furn_torch', 58, 'height', tx, tz, angle\)/.test(circle) && /real\('wl_megalith', bh, 'height', bx, bz/.test(circle) && /scene\.add\(circleGlow\);/.test(circle));
check('the town bonfire is the laid pyre, still burning and lighting the square; the ritual torches stand on iron cressets', /KK\.staticInstance\('tw_pyre', 94, 'fit'\) : null;\s+if \(laid\) g\.add\(laid\);/.test(main) && /townBonfireProp = \{ group: g, flames, light \};/.test(main) && /g\.add\(altarModel\(stand, 'furn_torch', 68, 'height'\)\);/.test(town) && /return \{ group: g, flame, light \};/.test(town));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
