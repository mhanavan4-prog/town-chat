// The town's night creature is the black dog, and the real animals do more
// than walk: they fidget when they stand, flinch when struck, and fall when
// they die (client/critter-rig.js).
const THREE = global.THREE = require('../public/three.min.js');
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const main = read('client/main.js'), town = read('client/mobs-town.js'), cre = read('client/creatures.js'), mw = read('client/mobs-wilds.js'), dm = read('client/dungeon-mobs.js');
const { critterRigFind, critterRigPose } = new Function(read('client/critter-rig.js').replace(/^export /gm, '') + '\nreturn { critterRigFind, critterRigPose };')();
function tree(file) {
  const b = fs.readFileSync(path.join(root, 'public/kk/critters', file + '.glb'));
  const json = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const make = (i) => { const n = json.nodes[i]; const o = new THREE.Object3D(); o.name = n.name || ''; if (n.translation) o.position.fromArray(n.translation); for (const c of n.children || []) o.add(make(c)); return o; };
  const sc = new THREE.Object3D(); for (const i of json.scenes[json.scene || 0].nodes) sc.add(make(i)); return sc;
}
const rigOf = (k) => { const r = critterRigFind(tree(k), k); r.seed = 0; return r; };

// The black dog.
const dog = tree('black_dog');
check('the black dog is in the manifest and jointed: head, four legs, tail', /cr_black_dog: 'kk\/critters\/black_dog\.glb'/.test(main) && ['head', 'leg_FL', 'leg_FR', 'leg_BL', 'leg_BR', 'tail'].every((n) => dog.getObjectByName(n)));
check('the town night creature is the dog, the dark shape standing in until the model lands and swapped then', /const g = kkModel \? kkModel\('cr_black_dog', 34, 'height'\) : null;/.test(town) && /blob\.userData\.standInFor = 'black_dog'/.test(town) && /if \(v\.mesh\.userData\.standInFor && hasKK && hasKK\('cr_black_dog'\)\)/.test(town));
check('the dog runs on his legs (no hop, waddle or squash) and is still seen only at night', /critterRigPose\(rig, v\.walkPhase/.test(town) && /v\.mesh\.visible = getLastWildlifeIsNight\(\) && \(!v\.dead \|\| nowMs - \(v\.deadAt \|\| 0\) < 1400\);/.test(town));

// Standing about.
{
  const r = rigOf('rabbit'); critterRigPose(r, 0, 0, 0.9);
  const up = r.root.o.rotation.x; critterRigPose(r, 0, 0, 5);
  check('a rabbit sits up to look about now and then, and comes down again', up < -0.3 && Math.abs(r.root.o.rotation.x) < 1e-9, up);
  critterRigPose(r, 1, 1, 0.9);
  check('…but not while it is running', Math.abs(r.root.o.rotation.x) < 1e-9);
}
{
  const r = rigOf('duskfawn'); critterRigPose(r, 0, 0, 5); const idle = r.head.o.rotation.x; critterRigPose(r, 0, 0, 1.2);
  check('a fawn puts its head down to graze', r.head.o.rotation.x > idle + 0.3, [idle, r.head.o.rotation.x]);
  const t = rigOf('mossback_tortoise'); const z0 = t.head.o.position.z; critterRigPose(t, 0, 0, 1.75);
  check('the tortoise draws its head in', t.head.o.position.z < z0 - 0.08);
}
// Struck, and dying.
{
  const r = rigOf('bramble_boar'); critterRigPose(r, 0, 0, 5); const x0 = r.root.o.rotation.x; critterRigPose(r, 0, 0, 5, { hit: 1 });
  check('a blow rocks it back, and it settles as the blow fades', r.root.o.rotation.x < x0 - 0.2 && (critterRigPose(r, 0, 0, 5, { hit: 0 }), Math.abs(r.root.o.rotation.x - x0) < 1e-9));
  critterRigPose(r, 0, 0, 5, { dead: 1 });
  check('dying, it goes over on its side', Math.abs(r.root.o.rotation.z) > 1.3);
  critterRigPose(r, 0, 0, 5, {});
  check('…and one that comes back stands up again', Math.abs(r.root.o.rotation.z) < 1e-9);
  const b = rigOf('bat'); critterRigPose(b, 0, 0, 5, { dead: 1 });
  check('a flyer folds its wings instead of rolling', Math.abs(b.root.o.rotation.z) < 1e-9 && b.wings.every((w) => Math.abs(w.o.rotation.z - w.rz) > 0.5));
}
check('town and Wilds animals are seen to flinch and fall before they are taken away', /function critterNoteBlows\(v, a\)/.test(cre) && (cre.match(/v\.mesh\.visible = critterShown\(v, rig\);/g) || []).length === 2 && (cre.match(/critterFx\(v\)\)/g) || []).length === 2);
check('one already dead when first seen is not shown falling', /if \(dead && !v\.dead\) v\.deadAt = v\.initialized \? now : 0;/.test(cre));
check('the neutral three and the dungeon creatures flinch and fall too', /dead: v\.dead \? \(nowMs - \(v\.deadAt \|\| 0\)\) \/ 900 : 0/.test(mw) && /if \(v\.dead && v\.mesh\.userData\.rig\) \{/.test(dm) && /hit: v\.hitAnimStartAt != null/.test(dm));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
