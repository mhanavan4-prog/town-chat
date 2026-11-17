// client/float-audit.js: the sweep's check that nothing solid hangs in the air.
// The cases are the ones it exists for: a building seated too high is reported
// whole, a lantern on a post is not, and things meant to float are left alone.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const THREE = require('../public/three.min.js');
const src = fs.readFileSync(path.join(__dirname, '..', 'client/float-audit.js'), 'utf8').replace(/^export .*$/gm, '');
const { findFloaters } = new Function(src + '\nreturn { findFloaters };')();

const mat = () => new THREE.MeshLambertMaterial({ color: 0x888888 });
function box(w, h, d, x, y, z, name) {   // y is the bottom of the box
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat());
  m.position.set(x, y + h / 2, z); if (name) m.name = name;
  return m;
}
const flat = () => 0;

{
  const scene = new THREE.Scene();
  scene.add(box(6000, 2, 6000, 0, -2, 0, 'ground'));
  scene.add(box(10, 80, 10, 100, 0, 100, 'post'));
  scene.add(box(14, 14, 14, 100, 82, 100, 'lantern'));            // rests on the post
  const house = new THREE.Group(); house.name = 'house';
  house.add(box(200, 120, 200, 0, 0, 0)); house.add(box(220, 60, 220, 0, 120, 0));   // walls, roof
  house.position.set(1000, 40, 1000);                             // seated forty units too high
  scene.add(house);
  const r = findFloaters(THREE, scene, flat);
  check('a lantern on a post on the ground is held up', !r.list.some((f) => /lantern|post/.test(f.name)), r.list);
  check('a building seated too high is reported once, whole', r.floating === 1 && r.list[0].name === 'house' && r.list[0].parts === 2, r.list);
  check('with how far up it is and where', r.list[0].gap === 40 && r.list[0].x === 1000 && r.list[0].z === 1000, r.list[0]);
  house.position.y = 0;
  check('seated on the ground, nothing floats', findFloaters(THREE, scene, flat).floating === 0);
}

{
  // Hills: the ground is where floorAt says it is, not y = 0.
  const scene = new THREE.Scene();
  const hill = (x) => (x > 500 ? 60 : 0);
  scene.add(box(40, 40, 40, 800, 60, 0, 'on the hill'));
  scene.add(box(40, 40, 40, 100, 60, 0, 'over the dale'));
  const r = findFloaters(THREE, scene, hill);
  check('a thing on a hill stands on the hill', r.floating === 1 && r.list[0].name === 'over the dale', r.list);
}

{
  // What is meant to be in the air, or is not solid, is not reported.
  const scene = new THREE.Scene();
  const marked = box(30, 30, 30, 0, 90, 0, 'book'); marked.userData.floats = true; scene.add(marked);
  const glow = box(30, 30, 30, 100, 90, 0, 'thing'); glow.material.transparent = true; scene.add(glow);
  scene.add(box(30, 30, 30, 200, 90, 0, 'a cloud'));
  const hidden = box(30, 30, 30, 300, 90, 0, 'thing'); hidden.visible = false; scene.add(hidden);
  const bone = new THREE.Bone(); bone.add(box(30, 30, 30, 0, 90, 0, 'hat')); bone.position.x = 400; scene.add(bone);
  scene.add(box(4, 4, 4, 500, 90, 0, 'speck'));
  const r = findFloaters(THREE, scene, flat);
  check('marked, see-through, sky, hidden, worn and speck-sized things are left alone', r.floating === 0, r.list);
}

{
  // Indoors the walls and ceiling are cut away.
  const scene = new THREE.Scene();
  scene.add(box(600, 2, 400, 300, -2, 200, 'floor'));
  scene.add(box(60, 80, 2, 300, 50, 2, 'window'));        // on the back wall
  scene.add(box(30, 30, 30, 300, 110, 200, 'chandelier')); // from the ceiling
  scene.add(box(30, 20, 30, 300, 40, 200, 'stray'));       // in the middle of the room, in mid-air
  const r = findFloaters(THREE, scene, flat, { room: true });
  check('indoors, a window on the wall and a lamp from the ceiling are held', r.floating === 1 && r.list[0].name === 'stray', r.list);
}

{
  // Instanced things are looked at one by one.
  const scene = new THREE.Scene();
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(20, 20, 20), mat(), 3); inst.name = 'crates';
  const m = new THREE.Matrix4();
  inst.setMatrixAt(0, m.makeTranslation(0, 10, 0));
  inst.setMatrixAt(1, m.makeTranslation(200, 70, 0));
  inst.setMatrixAt(2, m.makeScale(0, 0, 0));
  scene.add(inst);
  const r = findFloaters(THREE, scene, flat);
  check('one instance in the air out of three', r.checked >= 2 && r.floating === 1 && r.list[0].x === 200 && r.list[0].gap === 60, r);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
