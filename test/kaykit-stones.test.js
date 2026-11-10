// The Wilds' old places in real KayKit stone (Forest Nature Pack, CC0, Kay
// Lousberg): the Nine-and-Twenty's standing, fallen and low stones, and the
// Crick-stone's uprights and fallen stone, with the old plain shapes kept as
// the fallback. The ring must stay one object per stone (the count is honest),
// and collision must not change with the look.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
global.window = global; require('./three-stub.js'); global.THREE = global.window.THREE;
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const main = read('client/main.js');
check('the two stones are in the KayKit manifest', /stone_pillar:\s*'kk\/nature\/Rock_6_D_Color1\.gltf'/.test(main) && /stone_low:\s*'kk\/nature\/Rock_3_E_Color1\.gltf'/.test(main));
for (const f of ['Rock_6_D_Color1', 'Rock_3_E_Color1']) {
  const g = JSON.parse(read(`public/kk/nature/${f}.gltf`));
  check(`${f} is shipped, with its .bin, and shares the forest texture already there`, g.buffers.every((b) => fs.existsSync(path.join(root, 'public/kk/nature', b.uri))) && g.images.every((i) => i.uri === 'forest_texture.png') && fs.existsSync(path.join(root, 'public/kk/nature/forest_texture.png')));
}
const scene = read('client/wilds-scene.js');
check('the Wilds hands KK to both places', /makeCountlessRing\(w2\.countless, WILDS_WALLS, KK\)/.test(scene) && /makeMenAnTol\(w2\.menAnTol, WILDS_WALLS, makeSignSprite, KK\)/.test(scene));

// Build both, with a stand-in KK and without, through the real modules.
const load = (p) => { const src = read(p).replace(/^export /gm, ''); const names = [...src.matchAll(/^function (\w+)/gm)].map((m) => m[1]); return new Function('THREE', src + '\nreturn {' + names.join(',') + '};')(global.THREE); };
const ring = load('client/props-countless.js'), men = load('client/props-menantol.js');
const C = require('../data/countlessStones.js'), M = require('../data/menAnTol.js');
const geo = { ...C.COUNTLESS, stones: C.COUNTLESS_STONES };
const used = [];
const KK = { has: (k) => ['stone_pillar', 'stone_low', 'rock3'].includes(k), staticInstance: (k) => { used.push(k); const g = new global.THREE.Group(); g.userData.kk = k; return g; } };
const wallsA = [], wallsB = [];
const withKK = ring.makeCountlessRing(geo, wallsA, KK), without = ring.makeCountlessRing(geo, wallsB, null);
check(`one object per stone either way (${C.COUNTLESS_N})`, withKK.children.length === C.COUNTLESS_N && without.children.length === C.COUNTLESS_N);
check('every stone keeps its kind, standing, fallen or low', withKK.children.every((o, i) => o.userData.countlessStone === C.COUNTLESS_STONES[i][1]));
const kinds = { s: 0, f: 0, l: 0 }; for (const [, k] of C.COUNTLESS_STONES) kinds[k]++;
check('with KayKit: pillars and the slimmer rock stand, the pillar lies fallen, the squat rock is a stump', used.filter((k) => k === 'stone_low').length === kinds.l && used.filter((k) => k === 'stone_pillar' || k === 'rock3').length === kinds.s + kinds.f && used.includes('rock3'));
check('collision is the same with the look or without it', JSON.stringify(wallsA) === JSON.stringify(wallsB) && wallsA.length === kinds.s + kinds.l);
check('without KayKit, the plain stones are drawn', without.children.every((o) => o.isMesh));

used.length = 0;
const mw1 = [], mw2 = [];
const mGeo = { x: M.MEN_AN_TOL.x, y: M.MEN_AN_TOL.y, hole: M.MEN_HOLE, stone: M.MEN_STONE, upright: M.MEN_UPRIGHT };
men.makeMenAnTol(mGeo, mw1, null, KK); men.makeMenAnTol(mGeo, mw2, null, null);
check('the Crick-stone: two KayKit uprights and the fallen stone', used.filter((k) => k === 'stone_pillar').length === 3);
check('…and the hole collides exactly as before', JSON.stringify(mw1) === JSON.stringify(mw2) && mw1.length === 4);
const src = read('client/props-menantol.js');
check('the holed stone is still drawn here (KayKit has none), roughened the same way every time and seam-safe', /TorusGeometry/.test(src) && /Math\.round\(pos\.getX\(i\)\)/.test(src) && !/Math\.random/.test(src));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
