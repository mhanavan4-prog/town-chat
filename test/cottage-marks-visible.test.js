// The cottage's drawn marks are seen, not hidden: found in a real-render
// playtest (three.js r128 in Chromium) that the taper burn mark sat behind the
// "Leave Your Cottage" sign hung across the doorway, and that the hearth light
// washed the SATOR plate's letters out. The burn mark now stands well clear of
// the doorway (the sign reaches about 100 either side of the middle); the plate
// is unlit, darker, and larger; the VV is cut larger.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const src = fs.readFileSync(path.join(__dirname, '..', 'client', 'cottage-scene.js'), 'utf8');
const burn = src.match(/mark\.name = 'burnMark';[\s\S]*?mark\.position\.set\(W \/ 2 \+ (\d+), WALL_H \* 0\.5, D - 7\.4\)/);
check('the burn mark is beside the door, on the south wall', !!burn);
check('…and well clear of the sign across the doorway', burn && Number(burn[1]) >= 130, burn && burn[1]);
check('the SATOR plate is unlit, so the hearth light can\'t wash it out', /const mat = new THREE\.MeshBasicMaterial\(\{ map: makeSatorTexture\(\) \}\);/.test(src));
check('…and big enough to read', /new THREE\.CircleGeometry\(18, 28\)/.test(src));
check('the VV is cut large enough to see across the room', /new THREE\.PlaneGeometry\(44, 32\), mat\);\s*mark\.name = 'marianMark'/.test(src));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
