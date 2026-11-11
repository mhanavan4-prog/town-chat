// The last hand-built odds and ends: the altar's trinkets, the bone piles, the
// Chaos Dragon and the will-o'-wisp.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
const town = fs.readFileSync(path.join(root, 'client/town-scene.js'), 'utf8');
const mm = fs.readFileSync(path.join(root, 'client/mob-meshes.js'), 'utf8');
const dm = fs.readFileSync(path.join(root, 'client/dungeon-mobs.js'), 'utf8');
const glb = (f) => { const p = path.join(root, 'public/kk', f); if (!fs.existsSync(p)) return null; const b = fs.readFileSync(p); return b.readUInt32LE(0) === 0x46546c67 ? JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')) : null; };
const files = { alt_candle: 'home/altar_candle.glb', alt_athame: 'home/athame.glb', alt_censer: 'home/censer.glb', cr_dragon: 'critters/dragon.glb' };
check('the candle, the knife, the censer and the dragon are in the manifest and sound', Object.entries(files).every(([k, f]) => main.includes(k + ": 'kk/" + f + "'") && glb(f) && glb(f).meshes.every((m) => m.primitives.every((p) => p.attributes.COLOR_0 !== undefined))));
check('each altar trinket is made hand-built first and swapped for its model when that lands', /function altarModel\(g, key, size, mode, dress\)/.test(town) && /if \(!g\.userData\.altarReal && KK && KK\.onAssetLoad\) KK\.onAssetLoad\(swap\);/.test(town) && ['prop_skull', 'alt_candle', 'alt_athame', 'alt_censer'].every((k) => town.includes("altarModel(g, '" + k + "'")));
check('the candle keeps its flame and the censer its smoke', /fl\.position\.y = h \+ 2; grp\.add\(fl\);/.test(town) && /puff\.position\.set\(sx, sy \+ h - 2, sz\); grp\.add\(puff\);/.test(town));
check("the bone piles are KayKit's own bones, the hand-built pile standing in", /KK\.has\('prop_ribcage'\) && KK\.has\('prop_skull'\) && KK\.has\('prop_bone_a'\)/.test(main) && /const boneMat = new THREE\.MeshLambertMaterial\(\{ color: 0xd8d2c0 \}\);/.test(main));
const names = []; (function walk(j) { for (const n of j.nodes) names.push(n.name); })(glb('critters/dragon.glb'));
check('the Chaos Dragon is a dragon: head, wings and tail jointed, its own red kept', ['head', 'wing_L', 'wing_R', 'tail'].every((n) => names.includes(n)) && /chaos_dragon: \['dragon', 60\]/.test(dm) && /\/dragon\/\.test\(mobType\) \? 0 :/.test(dm));
check("the will-o'-wisp is a light: a flame that flickers, no body, no eyes, no horns", /if \(mobType === 'will_o_wisp'\) return withHealthBar\(makeWisp\(visual\), 30\);/.test(mm) && /blending: THREE\.AdditiveBlending/.test(mm.slice(mm.indexOf('function makeWisp'))) && !/horn|eye/i.test(mm.slice(mm.indexOf('function makeWisp(visual) {'), mm.indexOf('// Attaches the standard floating health bar'))));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
