// What dresses the town's rooms is modelled (tools/models/build_home.py): the
// café's bar, its cauldron, drying herbs and pumpkins; the rugs; the arcade's
// cabinets; the pedestals and the eight relics on them; the library's lectern,
// orb stand, floating books and the Real Shelf; the parlor's witchfire hearth
// and vigil candle; the court's thirteen candles; the bank's raven on his
// marble perch. Each keeps its hand-built shape as the stand-in.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
const furn = fs.readFileSync(path.join(root, 'client/furniture.js'), 'utf8');
const glb = (f) => { const p = path.join(root, 'public/kk/home', f + '.glb'); if (!fs.existsSync(p)) return null; const b = fs.readFileSync(p); return JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const keys = { furn_bar: 'bar_counter', furn_wrug: 'rug', furn_arcade: 'arcade_cabinet', furn_pedestal: 'pedestal', furn_orbstand: 'relic_orb_stand', furn_rblade: 'relic_blade', furn_rmoon: 'relic_crescent', furn_rlantern: 'relic_lantern', furn_rjar: 'relic_jar', furn_rplanchette: 'relic_planchette', furn_herbs: 'herb_bundle', furn_pumpkin: 'pumpkin', furn_lectern: 'lectern', furn_vigil: 'vigil_candle', furn_perch: 'marble_perch' };
check('the fifteen room pieces are in the manifest (streamed with the furniture) and sound', Object.entries(keys).every(([k, f]) => main.includes(k + ": 'kk/home/" + f + ".glb'") && glb(f) && glb(f).meshes.every((m) => m.primitives.every((p) => p.attributes.COLOR_0 !== undefined && p.attributes.POSITION !== undefined))), Object.entries(keys).filter(([k, f]) => !glb(f) || !main.includes(k + ": 'kk/home/" + f + ".glb'")));
check('no key is given twice in the manifest', Object.keys(keys).every((k) => main.split(k + ':').length === 2));
const body = (fn) => furn.slice(furn.indexOf('function ' + fn + '('), furn.indexOf('\n}\n', furn.indexOf('function ' + fn + '(')));
const uses = { makeRug: 'furn_wrug', makeBarCounter: 'furn_bar', makeArcadeCabinet: 'furn_arcade', makeDisplayPedestal: 'furn_pedestal' };
check('the rug, the bar, the cabinet and the pedestal use their models, the hand-built shapes behind them', Object.entries(uses).every(([fn, k]) => body(fn).includes("hallModel('" + k + "'") && /new THREE\.(Box|Cylinder|Plane)Geometry/.test(body(fn))));
check('a rug is dyed its room\'s colour and lies under the circles painted on the floor', /hallModel\('furn_wrug', 102\.6, 'fit', x, 0\.05, z, 0, color\)/.test(furn) && /real\.scale\.set\(w \/ 100, 0\.4, d \/ 100\)/.test(furn));
check('the bar stands with its back-bar to the wall and its front to the room', /hallModel\('furn_bar', len \+ 6, 'fit', x, 0, midZ, Math\.PI \/ 2\)/.test(furn));
check('a cabinet still shows its lit screen and throws its light', /lit\.position\.set\(0, 44, 13\.1\); cab\.add\(lit\);/.test(furn) && /new THREE\.PointLight\(screenColor, 0\.6, 60\); shine\.position/.test(furn));
const relics = ['furn_orbstand', 'alt_grimoire', 'furn_rblade', 'furn_rmoon', 'furn_rlantern', 'alt_bell', 'furn_rjar', 'furn_rplanchette'];
check('the eight relics under glass are their models', relics.every((k) => furn.includes("relicModel(p, '" + k + "'")), relics.filter((k) => !furn.includes("relicModel(p, '" + k + "'")));
check('the lantern and the vigil candle still burn', /relicModel\(p, 'furn_rlantern', 22, 'height'\)\) relicFlame\(p, 38\.5, 2\.3, 0x6fffb0\)/.test(furn) && /relicFlame\(vigil, 26\.5, 2\.2, 0x8fffbe\)/.test(furn));
check('the café: an iron cauldron, herbs hung to dry, pumpkins', /kkFurn\('wprop_cauldron', 38, 'fit', 0, 0, 0\)/.test(furn) && /hallModel\('furn_herbs', 46, 'height', hx, INDOOR_WALL_HEIGHT - 46, hz/.test(furn) && /hallModel\('furn_pumpkin', pr \* 2\.1, 'fit', px, 0, pz/.test(furn));
check('the library: lectern, orb stand, bound books adrift, the Real Shelf an oak bookcase', /hallModel\('furn_lectern', 64, 'height', shelfX, 0, shelfZ, Math\.PI\)/.test(furn) && /hallModel\('furn_orbstand', 16, 'fit', cx, 29, cz - 10, 0\)/.test(furn) && /hallModel\('cave_book', 13, 'height', 0, 0, 0, 0, col\)/.test(furn) && /hallModel\('furn_bookcase', 84, 'height', realX, 0, realZ, 0\)/.test(furn));
check('the parlor\'s hearth is the stone hearth, burning green', /hallModel\('furn_hearth', 62, 'fit', 0, 0, 0, 0, 0xa8dcc0\)/.test(furn) && /color: 0x49ff9e, transparent: true, opacity: 0\.9, depthWrite: false, blending: THREE\.AdditiveBlending/.test(furn));
check('the court\'s thirteen candles are wax, and the bank\'s auditor is the crow on a marble perch', /hallModel\('alt_candle', 11 \+ \(i % 3\) \* 3, 'height', cxp, 0, czp/.test(furn) && /hallModel\('furn_perch', 42, 'height', roomW - 60, 0, roomD \* 0\.2, 0\)/.test(furn) && /hallModel\('cr_gravewing_crow', 22, 'height', roomW - 60, 42, roomD \* 0\.2, -Math\.PI \/ 4\)/.test(furn) && /if \(!auditor\) scene\.add\(raven\);/.test(furn));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
