// Batching the small decor (client/decor-batch.js), run against the real
// three.js r128: the town's and the Wilds' harvestable plants drawn as one
// InstancedMesh per shared shape and map chunk, each copy keeping its own
// colour and place; harvesting still shrinks and dulls a plant; clicking finds
// it by an invisible stand-in; a tree the camera fades is batched too, and
// swapped for a whole copy of itself while it is ghosted.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const THREE = require('../public/three.min.js');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'client/decor-batch.js'), 'utf8').replace(/^export /gm, '');
const names = [...src.matchAll(/^function (\w+)/gm)].map((m) => m[1]);
const B = new Function('THREE', src + '\nreturn {' + names.join(',') + '};')(THREE);

// A little flower, the way the plant builders make one: a stem and a head.
function flower(x, z, color) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 6, 5), new THREE.MeshLambertMaterial({ color: 0x3a7a3f }));
  stem.position.y = 3; g.add(stem);
  const head = new THREE.Mesh(new THREE.SphereGeometry(2, 6, 6), new THREE.MeshLambertMaterial({ color }));
  head.position.y = 7; g.add(head);
  g.position.set(x, 0, z); g.rotation.y = x * 0.01;
  g.userData = { kind: 'decor', decorId: 'd' + x, decorType: 'flower' };
  return g;
}
const scene = new THREE.Scene();
const entries = [];
const cols = [0xff6b9b, 0xffd43b, 0xc58ad6];
for (let i = 0; i < 30; i++) { const x = 100 + i * 40, z = 200; const g = flower(x, z, cols[i % 3]); entries.push({ v: { group: g, type: 'flower', harvested: false, originalMaterials: [] }, group: g, id: 'd' + x }); }
const near = (a, b) => a.elements.every((x, k) => Math.abs(x - b.elements[k]) < 1e-4); // the batch stores matrices as float32
const before = entries.map((e) => { e.group.updateMatrixWorld(true); return e.group.children.map((c) => c.matrixWorld.clone()); });
const made = B.batchDecorGroups(scene, entries);
const ims = scene.children.filter((o) => o.isInstancedMesh);
// 30 flowers × 2 parts were 60 draws, all in one 2400-wide chunk.
check('sixty little meshes become two batches: the stems and the heads, every colour together', made === ims.length && made === 2, made);
// A copy is a unit template scaled to its part: stem 0.6 × 6 × 0.6, head radius 2.
const sizes = [[0.6, 6, 0.6], [2, 2, 2]];
const want = (i, j) => before[i][j].clone().multiply(new THREE.Matrix4().makeScale(...sizes[j]));
check('every copy is placed, turned and sized as its part was', entries.every((e, i) => e.v.batch.every((p, j) => { const m = new THREE.Matrix4(); p.im.getMatrixAt(p.index, m); return near(m, want(i, j)); })));
check('spheres of any size share one template (the copy carries the size)', B.decorBatchNorm(new THREE.SphereGeometry(2.4, 6, 5)).key === B.decorBatchNorm(new THREE.SphereGeometry(3.6, 6, 5)).key && B.decorBatchNorm(new THREE.ConeGeometry(3, 30, 4)).key === B.decorBatchNorm(new THREE.ConeGeometry(1.1, 4.5, 4)).key);
const c = new THREE.Color();
check('…and keeps its own colour (the batch material is white)', entries.every((e, i) => { const head = e.v.batch[1]; head.im.getColorAt(head.index, c); return c.getHex() === cols[i % 3] && head.im.material.color.getHex() === 0xffffff; }));
check('each batch is culled as its own chunk, not as one small shape at the origin', ims.every((im) => { const b = im.geometry.boundingSphere; const xs = []; for (let i = 0; i < im.count; i++) { const mm = new THREE.Matrix4(); im.getMatrixAt(i, mm); xs.push(mm.elements[12]); } return xs.every((x) => Math.abs(x - b.center.x) <= b.radius); }) && ims.some((im) => im.geometry.boundingSphere.radius > 400));
check('a stand-in keeps each plant\'s place and userData, in the scene, with a hit box that is never drawn', entries.every((e) => e.v.group.parent === scene && e.v.group.userData.decorId === e.id && e.v.group.position.x === e.group.position.x && e.v.group.children[0].material.visible === false));
scene.updateMatrixWorld(true);
const ray = new THREE.Raycaster(new THREE.Vector3(100, 50, 200), new THREE.Vector3(0, -1, 0));
const hits = ray.intersectObjects(entries.map((e) => e.v.group), true);
check('…so clicking a plant still finds it', hits.length > 0 && hits[0].object.parent.userData.decorId === 'd100');

// Harvesting.
const v = entries[0].v;
B.setDecorBatchHarvested(v, true);
const m = new THREE.Matrix4(); v.batch[1].im.getMatrixAt(v.batch[1].index, m);
const s = new THREE.Vector3(); m.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
v.batch[1].im.getColorAt(v.batch[1].index, c);
check('harvested: shrunk to 0.42 and dulled brown, as before', Math.abs(s.x - 0.42 * 2) < 1e-5 && c.getHex() === 0x6b5a45);
const other = entries[1].v; other.batch[1].im.getColorAt(other.batch[1].index, c);
check('…and only that plant', c.getHex() === cols[1]);
B.setDecorBatchHarvested(v, false);
v.batch[1].im.getMatrixAt(v.batch[1].index, m); v.batch[1].im.getColorAt(v.batch[1].index, c);
check('grown back: its place and colour restored', near(m, want(0, 1)) && c.getHex() === cols[0]);

// What is left alone.
const tree = flower(0, 0, 0x00ff00); tree.userData.camFade = true;
const lit = flower(0, 0, 0x00ff00); lit.add(new THREE.PointLight(0xffffff, 1, 10));
// A shape too rare to batch stays in its plant, and is harvested the old way.
const odd = flower(5000, 5000, 0xff0000); odd.add(new THREE.Mesh(new THREE.TorusGeometry(3, 1, 6, 8), new THREE.MeshLambertMaterial({ color: 0x123456 })));
const oddEntries = [{ v: { group: odd, type: 'flower' }, group: odd, id: 'odd' }];
for (let i = 0; i < 6; i++) { const g = flower(5040 + i * 30, 5000, 0xff0000); oddEntries.push({ v: { group: g, type: 'flower' }, group: g, id: 'f' + i }); }
const sc2 = new THREE.Scene(); B.batchDecorGroups(sc2, oddEntries);
const ov = oddEntries[0].v;
check('a shape too rare to batch stays in its plant, drawn as before', ov.rest.length === 1 && ov.restGroup && ov.restGroup.parent === sc2 && ov.restGroup.children.filter((c) => c.isMesh).length === 1 && ov.batch.length === 2);
B.setDecorBatchHarvested(ov, true);
check('…and is harvested the old way: shrunk with it, dulled', Math.abs(ov.restGroup.scale.x - 0.42) < 1e-9 && ov.rest[0].material.color.getHex() === 0x6b5a45);
const fadedPart = flower(0, 0, 0x00ff00); fadedPart.children[1].userData.camFade = true;
check('anything with a light in it, or a faded part inside it, is not batched; a faded tree itself is', !B.decorBatchable(lit) && !B.decorBatchable(fadedPart) && B.decorBatchable(tree) && B.decorBatchable(flower(1, 1, 0xff0000)));

// Sparse: three or four to a chunk across three chunks, gathered over the wider stretch.
const sc4 = new THREE.Scene();
const sparse = [];
for (const cx of [0, 1, 2]) for (let i = 0; i < 4; i++) { const g = flower(cx * 2400 + 300 + i * 60, 300, 0xff00ff); sparse.push({ v: { group: g, type: 'flower' }, group: g, id: 's' + cx + i }); }
B.batchDecorGroups(sc4, sparse);
check('a shape too sparse for any one chunk is gathered over a wider stretch (three chunks a side) instead', sc4.children.filter((o) => o.isInstancedMesh).length === 2 && sc4.children.filter((o) => o.isInstancedMesh).every((im) => im.count === 12) && sparse.every((e) => !e.v.rest.length));

// A wood of trees the camera fades, batched.
const sc3 = new THREE.Scene();
const wood = [];
for (let i = 0; i < 8; i++) { const g = flower(9000 + i * 50, 9000, 0x2f6b3a); g.userData.camFade = true; g.userData.decorId = 't' + i; wood.push({ v: { group: g, type: 'tree' }, group: g, id: 't' + i }); }
B.batchDecorGroups(sc3, wood);
const tv = wood[0].v;
const swap = tv.group.userData.decorFadeSwap;
check('the faded trees are batched; the fader finds each by its stand-in, which carries the tag, and not by its leftovers', sc3.children.filter((o) => o.isInstancedMesh).length === 2 && tv.group.userData.camFade === true && !!swap && wood.every((e) => !e.group.userData.camFade));
const copyOf = (pt) => { const mm = new THREE.Matrix4(); pt.im.getMatrixAt(pt.index, mm); return mm; };
const sx = (mm) => { const q = new THREE.Vector3(); mm.decompose(new THREE.Vector3(), new THREE.Quaternion(), q); return q.x; };
const fray = new THREE.Raycaster(new THREE.Vector3(9000, 7, 8990), new THREE.Vector3(0, 0, 1));
check('the fader can test the whole copy while it is set aside (its place is already worked out)', fray.intersectObjects(swap.group.children, false).length > 0);
swap.show(true);
check('ghosting it: its batched copies are hidden, and a whole copy of the tree stands in its place', tv.batch.every((pt) => sx(copyOf(pt)) === 0) && swap.group.parent === sc3 && swap.group.children.filter((c) => c.isMesh).length === 2 && swap.group.position.x === 9000 && !swap.group.userData.camFade);
check('…and only that tree', sx(copyOf(wood[1].v.batch[1])) > 1);
B.setDecorBatchHarvested(tv, true);
check('harvested while ghosted: the whole copy takes the look, the batched copies stay hidden', Math.abs(swap.group.scale.x - 0.42) < 1e-9 && swap.group.children[1].material.color.getHex() === 0x6b5a45 && tv.batch.every((pt) => sx(copyOf(pt)) === 0));
swap.show(false);
check('faded back: the whole copy goes, and the batched copies return with the harvested look', !swap.group.parent && Math.abs(sx(copyOf(tv.batch[1])) - 0.42 * 2) < 1e-5);
B.setDecorBatchHarvested(tv, false);
swap.show(true);
check('…and ghosted again after growing back, it stands full size in its own colours', Math.abs(swap.group.scale.x - 1) < 1e-9 && swap.group.children[1].material.color.getHex() === 0x2f6b3a);
swap.show(false);
check('…then back to the batch, full size', Math.abs(sx(copyOf(tv.batch[1])) - 2) < 1e-5);

// The wiring in the client.
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
check('the nature decor batches what it can, and harvests through the batch', /const batchIt = DECOR_BATCHING && HARVESTABLE_DECOR_TYPES\.has\(d\.type\) && decorBatchable\(group\);/.test(main) && /batchDecorGroups\(scene, toBatch\)/.test(main) && /if \(v\.batch\) \{ setDecorBatchHarvested\(v, harvested\); return; \}/.test(main));
check('a plant already harvested when you arrive is shown harvested once batched', /for \(const \{ v, id \} of toBatch\) if \(decorAvailability\[id\] === false\)/.test(main));
check('the camera\'s fader swaps a batched tree\'s whole copy in to ghost it, and out once it has faded back', /const swap = root\.userData && root\.userData\.decorFadeSwap;/.test(main) && /setMeshesFade\(swap\.group, amount\)/.test(main) && /if \(amount <= 0\.001\) swap\.show\(false\)/.test(main) && /\(sw \? sw\.group : o\)\.traverse/.test(main));
check('?batch=0 draws it one by one, to compare', /\[\?&\]batch=0\\b/.test(main));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
