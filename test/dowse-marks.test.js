// Where you dug for Tobias Hext's well: client/dowse-marks.js draws a patch of
// turned earth and a bucket of water at each hole you dug in the Wilds (the
// KayKit Farmers dirt plot and Medieval water bucket, CC0, Kay Lousberg; plain
// shapes without them), yours only, kept for the session once dug.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
global.window = global; require('./three-stub.js'); const T = global.window.THREE;
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const main = read('client/main.js');
check('the dirt plot and the water bucket are in the manifest', /dig_plot:\s*'kk\/props\/dirt_plot\.gltf'/.test(main) && /dig_bucket:\s*'kk\/bld\/bucket_water\.gltf'/.test(main));
for (const [dir, f] of [['props', 'dirt_plot'], ['bld', 'bucket_water']]) {
  const g = JSON.parse(read(`public/kk/${dir}/${f}.gltf`));
  check(`${f} ships with its .bin and its texture beside it`, g.buffers.every((b) => fs.existsSync(path.join(root, 'public/kk', dir, b.uri))) && g.images.every((i) => fs.existsSync(path.join(root, 'public/kk', dir, i.uri))));
}
check('the client reads the digs from callers_state, and places them when the Wilds is built', /_dowseMarks\.update\(msg\)/.test(main) && (main.match(/buildWildsScene\(world2\); applyDrawDistanceTier\(GFX\.quality\); _dowseMarks\.place\(\);/g) || []).length === 3);

const src = read('client/dowse-marks.js').replace(/^export default /m, '');
const createDowseMarks = new Function('THREE', src + '\nreturn createDowseMarks;')(T);
const scene = new T.Scene();
let built = null;
const used = [];
const KK = { has: () => true, staticInstance: (k) => { used.push(k); return new T.Group(); } };
const dm = createDowseMarks({ KK, getWildsScene: () => built, heightAt: () => 7 });
const state = (dug) => ({ active: { steps: [{ kind: 'dowse', dowse: { dips: 3, dug } }] } });
dm.update(state([{ dipped: true, feet: 6, x: 3000, y: 3100 }]));
check('a dig seen before the Wilds is built is remembered, not lost', dm.marks().length === 1);
built = scene; dm.place();
check('…and drawn once it is, at the hole, on the ground', scene.children.length === 1 && scene.children[0].position.x === 3000 && scene.children[0].position.z === 3100 && scene.children[0].position.y === 7);
check('the KayKit earth and bucket are used', used.includes('dig_plot') && used.includes('dig_bucket'));
dm.update(state([{ dipped: true, feet: 6, x: 3000, y: 3100 }, { dipped: false, feet: 9, x: 3600, y: 3100 }]));
check('the test hole is drawn too, and the first is not drawn twice', scene.children.length === 2 && scene.children.map((g) => g.userData.dowseMark).sort().join() === 'dipped,test');
dm.update({ active: null });
check('when the working is done the holes stay for the session', scene.children.length === 2);
dm.update(state([{ dipped: true, feet: 6 }]));
check('a dig with no place is skipped, not drawn at the origin', scene.children.length === 2);
const plain = createDowseMarks({ KK: null, getWildsScene: () => new T.Scene(), heightAt: () => 0 });
plain.update(state([{ dipped: true, feet: 6, x: 10, y: 20 }]));
check('without KayKit, plain earth and a pail', plain.marks().length === 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
