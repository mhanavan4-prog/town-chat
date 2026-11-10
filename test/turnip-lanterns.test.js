// The town's door lanterns at Samhain are turnips, as the record has it for
// Ireland and Man (data/mythOrRecord.js 'pumpkin_lanterns'; the Hop-tu-Naa
// caller's moots), not the American pumpkin. Drawn in client/props-turnip.js,
// one InstancedMesh per part for every door in town together.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const town = read('client/town-scene.js');
check('no pumpkins at the town doors any more', !/kkPlace\(scene, 'prop_pumpkin/.test(town));
check('turnip lanterns flank every door instead, two to a door, faces turned out', /turnips\.push\(\{ x: dp\.x \+ out\[0\] \+ perp\[0\]/.test(town) && /turnips\.push\(\{ x: dp\.x \+ out\[0\] - perp\[0\]/.test(town) && /const face = side === 'south' \? 0/.test(town) && /makeTurnipLanterns\(turnips\)/.test(town));
const main = read('client/main.js');
check('the plain pumpkin no longer loads (the carved one stays, for the Jack-o\'-Head guise)', !/prop_pumpkin2/.test(main) && /prop_pumpkin:\s*'kk\/props\/pumpkin_orange_jackolantern\.gltf'/.test(main) && !fs.existsSync(path.join(root, 'public/kk/props/pumpkin_orange.gltf')));
const myth = require('../data/mythOrRecord.js');
const all = Object.values(myth).filter(Array.isArray).flat();
const pl = all.find((q) => q && q.id === 'pumpkin_lanterns');
check('the record it follows is still in the game: turnips in Ireland and Man, the carved pumpkin American', pl && pl.answer === 'myth' && /turnips/.test(pl.verdict) && /American/.test(pl.verdict));

// Build a set with a small stand-in that counts what is made.
const made = { inst: [], basic: 0, lambert: 0 };
class V { set() { return this; } }
const T = {
  Group: class { constructor() { this.children = []; this.userData = {}; } add(o) { this.children.push(o); } },
  Matrix4: class { compose() { return this; } },
  Quaternion: class { setFromEuler() { return this; } setFromAxisAngle() { return this; } },
  Euler: class {}, Vector3: V,
  SphereGeometry: class { applyMatrix4() {} }, CylinderGeometry: class { applyMatrix4() {} }, ConeGeometry: class { applyMatrix4() {} }, BoxGeometry: class { applyMatrix4() {} },
  MeshBasicMaterial: class { constructor(o) { made.basic++; this.color = o.color; } },
  MeshLambertMaterial: class { constructor(o) { made.lambert++; this.color = o.color; } },
  InstancedMesh: class { constructor(g, m, n) { this.count = n; this.mat = m; this.set = 0; this.instanceMatrix = {}; made.inst.push(this); } setMatrixAt() { this.set++; } },
};
const src = read('client/props-turnip.js').replace(/^export /gm, '');
const names = [...src.matchAll(/^function (\w+)/gm)].map((m) => m[1]);
const mod = new Function('THREE', src + '\nreturn {' + names.join(',') + '};')(T);
const spots = Array.from({ length: 30 }, (_, i) => ({ x: i * 10, z: 0, size: 10, rot: i }));
const g = mod.makeTurnipLanterns(spots);
check('thirty lanterns are a handful of draw calls, not hundreds', made.inst.length === g.children.length && made.inst.length <= 10, made.inst.length);
check('…every part placed for every lantern', made.inst.every((im) => im.count === 30 && im.set === 30));
check('a cream root, a purple shoulder, and a carved face lit from inside', made.inst.some((im) => im.mat.color === 0xeddfba) && made.inst.some((im) => im.mat.color === 0x7b3f72) && made.basic === 3);
check('no lanterns, no meshes', mod.makeTurnipLanterns([]).children.length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
