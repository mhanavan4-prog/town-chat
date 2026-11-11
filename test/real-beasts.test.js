// The gloom bat and the dungeon creatures KayKit has no body for are real
// animals now (tools/models/build_critters.py): a horseshoe bat, the brown rat,
// a rat king, a cave spider, a dor beetle, a great centipede, the leopard slug,
// the adder. And the KayKit bodies in the dungeon and the Wilds night keep the
// isKK flag their builder set, so they walk, run, strike and fall.
const THREE = global.THREE = require('../public/three.min.js');
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
const dm = fs.readFileSync(path.join(root, 'client/dungeon-mobs.js'), 'utf8');
const mw = fs.readFileSync(path.join(root, 'client/mobs-wilds.js'), 'utf8');
const mm = fs.readFileSync(path.join(root, 'client/mob-meshes.js'), 'utf8');
const script = fs.readFileSync(path.join(root, 'tools/models/build_critters.py'), 'utf8');
const rigSrc = fs.readFileSync(path.join(root, 'client/critter-rig.js'), 'utf8').replace(/^export /gm, '');
const { critterRigFind, critterRigPose } = new Function(rigSrc + '\nreturn { critterRigFind, critterRigPose };')();
function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67 || b.readUInt32LE(4) !== 2 || b.readUInt32LE(16) !== 0x4e4f534a) return null;
  return { json: JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')), bytes: b.length };
}
function nodeTree(json) {
  const make = (i) => { const n = json.nodes[i]; const o = new THREE.Object3D(); o.name = n.name || ''; if (n.translation) o.position.fromArray(n.translation); for (const c of n.children || []) o.add(make(c)); return o; };
  const sc = new THREE.Object3D(); for (const i of json.scenes[json.scene || 0].nodes) sc.add(make(i)); return sc;
}
const joints = { bat: ['head', 'wing_L', 'wing_R', 'tail'], rat: ['head', 'tail', 'leg_FL', 'leg_BR'], rat_king: [], spider: ['leg_L0', 'leg_L3', 'leg_R0', 'leg_R3'], beetle: ['head', 'leg_L0', 'leg_R2'], centipede: ['head', 'tail'], slug: ['head'], adder: ['head'] };
const bad = [];
let maxBytes = 0;
for (const [k, js] of Object.entries(joints)) {
  if (!main.includes('cr_' + k + ": 'kk/critters/" + k + ".glb'")) { bad.push('manifest ' + k); continue; }
  const g = readGlb(path.join(root, 'public/kk/critters', k + '.glb'));
  if (!g) { bad.push('glb ' + k); continue; }
  maxBytes = Math.max(maxBytes, g.bytes);
  const tree = nodeTree(g.json);
  for (const j of js) if (!tree.getObjectByName(j)) bad.push(k + ' lacks ' + j);
  if (js.length) {
    const rig = critterRigFind(tree, k);
    const snap = () => JSON.stringify([...rig.legs.map((l) => [l.o.rotation.x, l.o.rotation.y]), ...rig.wings.map((w) => w.o.rotation.z), rig.head && rig.head.o.rotation.toArray()]);
    const a = snap(); critterRigPose(rig, 1.1, 1, 0.4); const b = snap();
    if (a === b) bad.push('the rig does not move ' + k);
  }
  if (!new RegExp("'" + k + "':").test(script)) bad.push('not in the script ' + k);
}
check('all eight are in the manifest, on disk, carry their joints, and the rig moves them', !bad.length, bad);
check('each is small enough to stream (under 100 KB)', maxBytes > 0 && maxBytes < 100 * 1024, maxBytes);
const map = dm.slice(dm.indexOf('const DUNGEON_CRITTER_MODELS = {'), dm.indexOf('};', dm.indexOf('const DUNGEON_CRITTER_MODELS = {')));
const want = { cave_rat: 'rat', tunnel_rat: 'rat', boss_rat_king: 'rat_king', stone_bat: 'bat', blood_bat: 'bat', crypt_spider: 'spider', boss_crypt_weaver: 'spider', rock_beetle: 'beetle', venom_crawler: 'centipede', moss_crawler: 'slug', dark_adder: 'adder', void_serpent: 'adder' };
check('every dungeon creature KayKit had no body for gets its real animal, and the Chaos Dragon a dragon', Object.entries(want).every(([t, k]) => new RegExp(t + ": \\['" + k + "', \\d+\\]").test(map)) && /chaos_dragon: \['dragon', \d+\]/.test(map));
check('the real one takes the type\'s scale, health bar and boss markers, and the hand-built rig stands in till it lands', /const real = realDungeonCritter\(mobType, visual\);\s+if \(real\) \{\s+real\.add\(makeHealthBarSprite\(38\)\);\s+real\.scale\.setScalar\(visual\.scale\);\s+addBossMarkers\(real/.test(dm) && /const builder = MOB_ARCH_BUILDERS\[mobArchetype\(mobType\)\]/.test(dm));
check('dungeon creatures scurry: the rig is posed from their movement', /critterRigPose\(rig, v\.gait, speed > 4/.test(dm));
check('the gloom bat is a real bat with its wings beating, the hand-built one until it lands', /const bat = kkModel \? kkModel\('cr_bat', 44, 'fit'\) : null;/.test(mm) && /return withHealthBar\(makeGloomBat\(\), 24\);/.test(mm) && /if \(v\.mesh\.userData\.rig && v\.mesh\.visible\) critterRigPose\(v\.mesh\.userData\.rig/.test(mw));
// The KayKit bodies keep the isKK flag: the pools no longer wipe userData before reading it.
check('the dungeon and Wilds night pools keep isKK, so KayKit bodies walk, run, strike and fall', /mesh\.userData = \{ \.\.\.mesh\.userData, kind: 'dungeon', targetId: id \};/.test(dm) && /mesh\.userData = \{ \.\.\.mesh\.userData, kind: 'mob2', targetId: id \};/.test(mw) && !/mesh\.userData = \{ kind: '(dungeon|mob2)', targetId: id \};/.test(dm + mw));
{
  // and, run for real: a KayKit-marked group keeps its flag through the pool's relabel
  const g = new THREE.Group(); g.userData.isKK = true; g.userData.kk = { k: 1 };
  g.userData = { ...g.userData, kind: 'dungeon', targetId: 'm1' };
  check('…a marked body read after the relabel is still a KayKit body', g.userData.isKK === true && !!g.userData.kk);
}
const real = ['Rhinolophus', 'Rattus norvegicus', 'Rattenkönig', 'Meta menardi', 'Geotrupes', 'Limax maximus', 'Vipera berus'];
check('each names the real animal it is', real.every((w) => script.includes(w)), real.filter((w) => !script.includes(w)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
