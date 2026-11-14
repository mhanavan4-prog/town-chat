// Four things put right in the Wildlands Village and the chat panel: the Tithe Barn is entered at its own door; the
// hearths have a fire worth the name, and nothing stands in front of the Moot Hall's; stools and tables are the
// height of stools and tables; and the Log tab is the size of the chat it replaces.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const { VILLAGE_HOUSES: H, VILLAGE, VH } = require('../data/villageHouses');
const scene = read('client/village-house.js'), wilds = read('client/wilds-scene.js'), fire = read('client/hearth-fire.js'), html = read('public/index.html'), main = read('client/main.js');

// the barn's model stands at (VX - 720, VZ - 40), turned a quarter so its door and steps are in its east end
const m = /placeSolid\('vil_home', VX - (\d+), VZ - (\d+), (\d+), Math\.PI \/ 2, 'fit'\);\s*\/\/ Barn/.exec(wilds);
check('the barn is where it was, end-on', m && +m[1] === 720 && +m[2] === 40);
const bx = VILLAGE.x - +m[1], by = VILLAGE.y - +m[2], half = +m[3] / 2;
check('the way into the Tithe Barn is at its own door: just off its east end, level with its middle', H.barn.door.x > bx + half && H.barn.door.x - (bx + half) < VH.doorRange && Math.abs(H.barn.door.y - by) < 40, H.barn.door);
check('and where you come out is clear of the building', H.barn.door.x - (bx + half) > 30);
check('the sign and the door-spot are both drawn at the door', /WILDS_KIOSKS\.push\(\{ x: h\.door\.x, z: h\.door\.y, portal: 'vh_enter'/.test(wilds) && /s\.position\.set\(h\.door\.x, 96, h\.door\.y\)/.test(wilds));
check('no two houses share a door', Object.values(H).every((a) => Object.values(H).every((b) => a === b || Math.hypot(a.door.x - b.door.x, a.door.y - b.door.y) > 2 * VH.doorRange)));

check('the fire is made of an ember bed, five tongues of flame out of step, sparks, and a light that flickers', /const TONGUES = \[/.test(fire) && (fire.match(/0x[0-9a-f]{6}, 0\.\d+, \d\.\d, \d\.\d\]/g) || []).length === 5 && /OctahedronGeometry/.test(fire) && /l\.intensity = l\.userData\.base \*/.test(fire) && /AdditiveBlending/.test(fire));
check('all three of the village\'s hearths are lit with it, and so is the one at home', (scene.match(/      hearth\(/g) || []).length === 3 && /const hearth = \(x, z, size, power\) => \{ kkPlace\(scene, 'furn_hearth'/.test(scene) && /makeHearthFire\(THREE, 200 \/ 190, \{ light: false \}\)/.test(main));
check('the old glow painted over the hearths is gone', !/glow\([^)]*0xff8a30\)/.test(scene));
check('the Moot Hall\'s high seat stands beside the hearth, not in front of it', /kkPlace\(scene, 'furn_highseat', h\.x \+ 200, 64, 90, 0, 'height'\)/.test(scene));

const stools = [...scene.matchAll(/kkPlace\(scene, 'furn_stool', [^)]*?, (\d+), 0, '(\w+)'\)/g)];
check('a stool is knee-high (set by its height: the kit\'s is a bar stool)', stools.length === 2 && stools.every((s) => s[2] === 'height' && +s[1] <= 26), stools.map((s) => s[1] + s[2]));
const tables = [...scene.matchAll(/kkPlace\(scene, 'furn_sidetable', [^)]*?, (\d+), 0, '(\w+)'\)/g)];
check('and a side table is table-high, in every house', tables.length === 5 && tables.every((t) => t[2] === 'height' && +t[1] <= 46), tables.map((t) => t[1] + t[2]));

const rule = html.slice(html.indexOf('  #chatMsgLog {'), html.indexOf('}', html.indexOf('  #chatMsgLog {')));
check('the Log tab is one fixed height, the chat\'s log and its composer together, so the panel does not jump', /height:min\(131px, calc\(20vh \+ 59px\)\)/.test(rule) && !/max-height:190px/.test(rule) && !/min-height/.test(rule));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
