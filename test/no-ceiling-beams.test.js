// Interiors have no ceiling cross-beams: the camera looks down from above the
// walls, and beams running across a room cut through the view of the player.
// Guard the cottage, the coven manor and every themed interior.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'client', f), 'utf8');
for (const f of ['cottage-scene.js', 'manor-scene.js', 'interior-scene.js']) {
  const src = read(f);
  check(`${f} builds no ceiling beams`, !/const beam\s*=/.test(src) && !/beamMat/.test(src));
}
check('no theme still carries a beamColor', !/beamColor/.test(read('main.js')) && !/beamColor/.test(read('interior-scene.js')));
const furn = read('furniture.js');
check('the drying herbs hang on twine that reaches the ceiling line', /CylinderGeometry\(0\.7, 0\.7, 24, 4\), twineMat/.test(furn) && /tie\.position\.set\(hx, INDOOR_WALL_HEIGHT - 12, hz\)/.test(furn));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
