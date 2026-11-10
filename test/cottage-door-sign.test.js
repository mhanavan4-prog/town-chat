// The cottage's "Leave Your Cottage" sign hangs across the door opening, below
// the lintel, so it never covers the daisy wheel ward cut into the lintel's
// inner face.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const src = fs.readFileSync(path.join(__dirname, '..', 'client', 'cottage-scene.js'), 'utf8');

const WALL_H = 150;
const lintelBottom = WALL_H - WALL_H * 0.26;            // the lintel segment is WALL_H*0.26 tall, flush with the wall top
const signM = src.match(/const sign = makeSignSprite\('🚪 Leave Your Cottage — Press F'\);\s*sign\.position\.set\(W \/ 2, (\d+(?:\.\d+)?), D - 18\);/);
check('the exit sign is placed at a fixed height', !!signM);
const signY = signM ? Number(signM[1]) : NaN;
// Sprite height: 64 px canvas at 110/256 world units per pixel.
const signHalfH = (64 * 110 / 256) / 2;
check('the sign sits wholly below the lintel', signY + signHalfH < lintelBottom, { signTop: signY + signHalfH, lintelBottom });
check('…and above the floor, in the door opening', signY - signHalfH > 0);

const hexM = src.match(/mark\.position\.set\(W \/ 2, WALL_H - WALL_H \* 0\.13, D - 7\.4\)/);
const hexSize = src.match(/new THREE\.PlaneGeometry\((\d+), \1\), mat\);\s*mark\.name = 'hexafoil'/);
check('the daisy wheel is still on the lintel\'s inner face', !!hexM && !!hexSize);
const hexBottom = WALL_H - WALL_H * 0.13 - (hexSize ? Number(hexSize[1]) : 0) / 2;
check('the sign and the daisy wheel do not overlap', signY + signHalfH < hexBottom, { signTop: signY + signHalfH, hexBottom });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
