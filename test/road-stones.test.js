// The old roads' stones (client/road-stones.js): kerbs and worn flags laid along the drove road in the
// Wilds and the track across the Ember Wastes, from two models in the KayKit idiom.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const src = read('client/road-stones.js');
// the placing is plain arithmetic: run it here, without the scene
const roadStoneSpots = new Function(src.slice(src.indexOf('export function roadStoneSpots'), src.indexOf('export function layRoadStones')).replace('export function', 'return function'))();
const { ROAD } = require('../data/droveRoad');
const half = ROAD.width / 2;
const a = roadStoneSpots([ROAD.pts], half, null, 23), b = roadStoneSpots([ROAD.pts], half, null, 23);
const distToRoad = (x, y) => { let best = 1e9; for (let i = 0; i < ROAD.pts.length - 1; i++) { const [ax, ay] = ROAD.pts[i], [bx, by] = ROAD.pts[i + 1], L2 = (bx - ax) ** 2 + (by - ay) ** 2, t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2)); best = Math.min(best, Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay))); } return best; };
check('the same road is laid the same way every time', JSON.stringify(a) === JSON.stringify(b) && a.kerbs.length > 30 && a.setts.length > 15);
check('kerb stones stand at the road\'s edges, with gaps; flags lie in the way', a.kerbs.every((k) => Math.abs(distToRoad(k.x, k.y) - half) < 30) && a.setts.every((k) => distToRoad(k.x, k.y) < half) && a.kerbs.length < 2 * Math.floor(4500 / 105));
check('the two models are in the kit and the manifest', ['road_setts', 'road_kerb'].every((n) => fs.existsSync(path.join(root, 'public/kk/home', n + '.glb'))) && /rd_setts: 'kk\/home\/road_setts\.glb', rd_kerb: 'kk\/home\/road_kerb\.glb'/.test(read('client/main.js')));
check('the drove road and the Wastes\' track are both laid with them, the Wastes\' scorched', /layRoadStones\(scene, KK, \[P\], w2\.drove\.width \/ 2, H, null, 23\)/.test(read('client/wilds-scene.js')) && /layRoadStones\(scene, KK, FIELD_TRACK, 105, H, \(g\) => scorch\(g, 0\.14\), 11\)/.test(read('client/ember-scene.js')));
check('each model is one instanced mesh, with normals of unit length (a packed normal scaled by the bake draws black)', /new THREE\.InstancedMesh\(geo, o\.material, items\.length\)/.test(src) && /new THREE\.Float32BufferAttribute\(out, 3\)/.test(src));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
