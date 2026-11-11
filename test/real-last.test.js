// The last hand-built pieces are modelled (tools/models/build_home.py): the
// cottage's harvest charms, the locksmith's key, the small noticeboard, the
// bank's vault door and hoard, the manor's talking-board table, altars,
// chandelier and candles. Each keeps its hand-built shape as the stand-in.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const main = read('client/main.js'), furn = read('client/furniture.js'), cottage = read('client/cottage-scene.js'), manor = read('client/manor-scene.js'), town = read('client/town-scene.js'), props = read('client/props-town.js');
const glb = (f) => { const p = path.join(root, 'public/kk/home', f + '.glb'); if (!fs.existsSync(p)) return null; const b = fs.readFileSync(p); return JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const keys = { tw_key: 'skeleton_key', wd_kern: 'kern_baby', wd_sheaf: 'sheaf_hung', furn_vaultdoor: 'vault_door', furn_hoard: 'coin_hoard', furn_scrytable: 'scry_table', furn_altar: 'stone_altar' };
check('the seven models are in the manifest and sound', Object.entries(keys).every(([k, f]) => main.includes(k + ": 'kk/home/" + f + ".glb'") && glb(f) && glb(f).meshes.every((m) => m.primitives.every((p) => p.attributes.COLOR_0 !== undefined))), Object.entries(keys).filter(([, f]) => !glb(f)));
check('the harvest charms stream in with the other built models', /\/\^\(pl\|cr\|gv\|gd\|fl\|cave\|wl\|alt\|tw\|dg\|wd\)_\/\.test\(k\)/.test(main));
const mats = (f) => new Set(glb(f).materials.map((m) => m.name));
check('only the ribbon of the hung sheaf takes a dye; the straw keeps its colour', mats('sheaf_hung').has('Plant') && mats('sheaf_hung').has('Trim') && /const dye = form === 'maiden' \? 0xb33a3a : 0xc9a24a;/.test(cottage));
check('the last sheaf is the kern baby or the hung hank, the hand-built one behind it', /kkStatic\(form === 'kern' \? 'wd_kern' : 'wd_sheaf', form === 'kern' \? 30 : 38, 'height'\)/.test(cottage) && /g\.name = 'lastSheaf';/.test(cottage) && /dress\.name = 'kernDress'/.test(cottage) && /createCottageScene\(\{\s+makeSignSprite, COTTAGE_WORLD, kkStatic:/.test(main));
check('the locksmith\'s sign is a real key, and the small noticeboard the pentice board in old oak', /altarModel\(keyGrp, 'tw_key', 26, 'height'/.test(town) && /KK\.staticInstance\('tw_board', 48, 'height'\)/.test(props) && /setHex\(0x8a6a44\)/.test(props));
check('the bank: the vault door with its hexafoil, a hoard, two chests thrown open', /hallModel\('furn_vaultdoor', 142, 'height', 70, 24, 0, Math\.PI\)/.test(furn) && /hallModel\('furn_hoard', 132, 'fit', cx, 0, hoardZ\(roomD - 26\), 0\)/.test(furn) && /hallModel\('dg_chest_open', 36, 'fit', px, 0, roomD - 30, Math\.PI \+ rotY\)/.test(furn) && /scene\.add\(vaultHinge\);/.test(furn));
check('the manor: talking-board table, carved altars dyed the coven\'s cloth, wheel chandelier, wax candles', /place\(g, 'furn_scrytable', 0, 0, 134, 0, 'fit'\)/.test(manor) && /place\(g, 'furn_altar', 0, 0, 126, Math\.PI \/ 2, 'fit'\)/.test(manor) && /o\.material\.color\.setHex\(cloth\)/.test(manor) && /place\(chand, 'furn_chandelier', 0, 0, 100, 0, 'fit'\)/.test(manor) && /place\(g, 'alt_candle', 0, 0, 15 \* scale, 0, 'height'\)/.test(manor) && /altarDecorGroups\[slot\] = decorGroup;/.test(manor));
check('with no models to hand the manor still builds its hand-made pieces', /const place = \(\.\.\.a\) => \(kkPlace \? kkPlace\(\.\.\.a\) : null\);/.test(manor) && /if \(!carved\) g\.add\(plinth\);/.test(manor));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
