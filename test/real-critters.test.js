// The harmless creatures are the real animals (tools/models/build_critters.py),
// jointed so the game can walk them: each model carries its legs, wings, head
// and tail as named nodes with their origins at the joints. Every one must be
// in the manifest, on disk, sound, posed by the rig, and stood in for by the
// hand-built one until it lands, then swapped.
const THREE = global.THREE = require('../public/three.min.js');
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
const creatures = fs.readFileSync(path.join(root, 'client/creatures.js'), 'utf8');
const meshes = fs.readFileSync(path.join(root, 'client/mob-meshes.js'), 'utf8');
const mobsWilds = fs.readFileSync(path.join(root, 'client/mobs-wilds.js'), 'utf8');
const script = fs.readFileSync(path.join(root, 'tools/models/build_critters.py'), 'utf8');
const rigSrc = fs.readFileSync(path.join(root, 'client/critter-rig.js'), 'utf8').replace(/^export /gm, '');
const { critterRigFind, critterRigPose } = new Function(rigSrc + '\nreturn { critterRigFind, critterRigPose };')();

function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67 || b.readUInt32LE(4) !== 2 || b.readUInt32LE(16) !== 0x4e4f534a) return null;
  return { json: JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')), bytes: b.length };
}
// The node tree, as three would build it (names and translations only).
function nodeTree(json) {
  const make = (i) => { const n = json.nodes[i]; const o = new THREE.Object3D(); o.name = n.name || ''; if (n.translation) o.position.fromArray(n.translation); for (const c of n.children || []) o.add(make(c)); return o; };
  const sc = new THREE.Object3D(); for (const i of json.scenes[json.scene || 0].nodes) sc.add(make(i)); return sc;
}

const want = {
  rabbit: ['head', 'ear_L', 'ear_R', 'leg_FL', 'leg_FR', 'leg_BL', 'leg_BR', 'tail'],
  embermoth: ['wing_L', 'wing_R', 'leg_L0', 'leg_R2'],
  thistlehog: ['head', 'leg_FL', 'leg_FR', 'leg_BL', 'leg_BR'],
  duskfawn: ['head', 'leg_FL', 'leg_FR', 'leg_BL', 'leg_BR', 'tail'],
  mirefowl: ['head', 'wing_L', 'wing_R', 'leg_L', 'leg_R', 'tail'],
  bramble_boar: ['head', 'leg_FL', 'leg_FR', 'leg_BL', 'leg_BR', 'tail'],
  mossback_tortoise: ['head', 'leg_FL', 'leg_FR', 'leg_BL', 'leg_BR', 'tail'],
  gravewing_crow: ['head', 'wing_L', 'wing_R', 'leg_L', 'leg_R', 'tail'],
};
const bad = [];
let maxBytes = 0;
for (const [k, joints] of Object.entries(want)) {
  if (!new RegExp('cr_' + k + ": 'kk/critters/" + k + "\\.glb'").test(main)) { bad.push('manifest ' + k); continue; }
  const f = path.join(root, 'public/kk/critters', k + '.glb');
  const g = fs.existsSync(f) && readGlb(f);
  if (!g) { bad.push('glb ' + k); continue; }
  maxBytes = Math.max(maxBytes, g.bytes);
  const prims = g.json.meshes.flatMap((m) => m.primitives);
  if (!prims.every((p) => p.attributes.COLOR_0 !== undefined && p.attributes.NORMAL !== undefined && g.json.accessors[p.attributes.POSITION].componentType === 5126) || (g.json.images || []).length) bad.push('unsound ' + k);
  const tree = nodeTree(g.json);
  const names = []; tree.traverse((o) => names.push(o.name));
  for (const j of joints) if (!names.includes(j)) bad.push(k + ' lacks ' + j);
  // forward is +Z: the head sits ahead of the body's middle (the moth has none; its legs do)
  const head = tree.getObjectByName('head');
  if (head && head.position.z <= 0) bad.push(k + ' faces backwards');
  const L = tree.getObjectByName('wing_L') || tree.getObjectByName('leg_FL') || tree.getObjectByName('leg_L');
  if (L && L.position.x <= 0) bad.push(k + ' has its left on the right');
  // the rig finds the joints and moves them
  const rig = critterRigFind(tree, k);
  if (!rig) { bad.push('no rig ' + k); continue; }
  const before = JSON.stringify(rig.legs.map((l) => l.o.rotation.x).concat(rig.wings.map((w) => w.o.rotation.z)));
  critterRigPose(rig, 1.3, 1, 0.2);
  const after = JSON.stringify(rig.legs.map((l) => l.o.rotation.x).concat(rig.wings.map((w) => w.o.rotation.z)));
  if (before === after) bad.push('the rig does not move ' + k);
  if (!new RegExp("'" + k + "':").test(script)) bad.push('not in the script ' + k);
}
check('all eight are in the manifest, on disk, sound, face forward, carry their joints, and the rig moves them', !bad.length, bad);
check('each is small enough to stream (under 100 KB)', maxBytes > 0 && maxBytes < 100 * 1024, maxBytes);
check('they stream in behind the town with the plants', /\.\.\.Object\.keys\(MANIFEST\)\.filter\(\(k\) => \/\^\(pl\|cr\)_\/\.test\(k\)\)/.test(main));
check('town rabbits and the Wilds five use the real animal, and the hand-built one stands in till it lands', /const mesh = critterOrStandIn\('rabbit', makeRabbit\);/.test(creatures) && /if \(CRITTER_MODELS\[type\]\) return critterOrStandIn\(type, \(\) => makeCritter2StandIn\(type\)\);/.test(creatures) && /g\.userData\.standInFor = type;/.test(creatures));
check('a stand-in is swapped for the real one when its model arrives, in town and the Wilds', (creatures.match(/if \(v\.mesh\.userData\.standInFor\) critterUpgrade\(v, get(Outdoor|Wilds)Scene\(\)\);/g) || []).length === 2 && /if \(standIn && hasKK && hasKK\('cr_' \+ standIn\)\)/.test(mobsWilds));
check('they walk: the rig is posed every frame from the gait and the speed', (creatures.match(/critterRigPose\(rig, v\.hopPhase/g) || []).length === 2 && /critterRigPose\(rig, v\.gait/.test(mobsWilds));
check('the boar, the tortoise and the crow are the real ones too, keeping their sizes', /const MOB3_MODELS = \{ bramble_boar: \[\d+, 'height', \d+\], mossback_tortoise: \[\d+, 'fit', \d+\], gravewing_crow: \[\d+, 'height', \d+\] \};/.test(meshes) && /if \(vis && vis\.scale\) g\.scale\.setScalar\(vis\.scale\);/.test(meshes));
const real = { rabbit: 'Oryctolagus cuniculus', embermoth: 'Arctia caja', thistlehog: 'Erinaceus europaeus', duskfawn: 'Capreolus capreolus', mirefowl: 'Gallinula chloropus', bramble_boar: 'Sus scrofa', gravewing_crow: 'Corvus corone' };
check('each names the real animal it is drawn from', Object.values(real).every((sp) => script.includes(sp)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
