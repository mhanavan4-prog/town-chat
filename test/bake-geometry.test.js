// Many copies of one model drawn as one mesh (client/bake-geometry.js): the model's packed normals are
// made whole before its placement is baked in, or the copies draw black (the Wilds' grass and shrubs did).
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const src = read('client/bake-geometry.js');
// a stand-in for three.js, enough to run it: normals packed as bytes, as the kits ship them
const applied = [];
const THREE = { Float32BufferAttribute: class { constructor(a, n) { this.array = a; this.itemSize = n; this.count = a.length / n; } } };
const packed = new Int8Array([0, 127, 0, 90, 90, 0, 0, 0, 0]);
const attr = { count: 3, getX: (i) => packed[i * 3], getY: (i) => packed[i * 3 + 1], getZ: (i) => packed[i * 3 + 2] };
const geometry = { clone() { return { attributes: { normal: attr }, setAttribute(k, v) { this.attributes[k] = v; }, applyMatrix4(m) { applied.push([m, this.attributes.normal.array instanceof Float32Array]); }, computeVertexNormals() {} }; } };
const bakeGeometry = new Function('THREE', src.replace('export function', 'return function'))(THREE);
const out = bakeGeometry(geometry, 'M');
const n = out.attributes.normal.array, len = (i) => Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
check('packed normals come out as floats of unit length; one of no length is given a direction', n instanceof Float32Array && [0, 1, 2].every((i) => Math.abs(len(i) - 1) < 1e-6) && n[7] === 1);
check('and only then is the placement baked in', applied.length === 1 && applied[0][0] === 'M' && applied[0][1] === true);
check('the original geometry is left alone', geometry.clone().attributes.normal === attr);
const users = ['client/main.js', 'client/ember-scene.js', 'client/road-stones.js'];
check('every instanced crowd bakes through it: the Wilds\' decor, the Wastes\' scatter, the roads\' stones', users.every((f) => /import \{ bakeGeometry \} from '\.\/bake-geometry\.js'/.test(read(f)) && /bakeGeometry\(o\.geometry, o\.matrixWorld\)/.test(read(f))) && !users.some((f) => /geo\.applyMatrix4\(o\.matrixWorld\)/.test(read(f))));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
