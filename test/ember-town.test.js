// Ashminster: the town in the middle of the Ember Wastes, and its minster.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-embertown-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const root = path.join(__dirname, '..');
const { EMBER_TOWN: T } = require('../data/emberTown');
const scene = fs.readFileSync(path.join(root, 'client/ember-scene.js'), 'utf8'), main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
require('../server.js');

// the client's own copy of where and how big
const C = new Function('return ' + /const EMBER_TOWN = (\{[^}]*\});/.exec(scene)[1])();
check('the client draws the minster where the server says the town is, at the same size and turn', C.x === T.x && C.y === T.y && C.unit === T.unit && C.height === T.height && C.turn === T.turn && C.name === T.name);
check('it is the game\'s own place, and says so', /game's own invention/.test(fs.readFileSync(path.join(root, 'data/emberTown.js'), 'utf8')));

// what is solid, worked out the way the client does
const SOLID = new Function('return ' + /const MINSTER_SOLID = (\[[\s\S]*?\n\]);/.exec(scene)[1].replace(/\/\/[^\n]*/g, ''))();
const c = Math.cos(T.turn), s = Math.sin(T.turn);
const rects = SOLID.map(([x0, y0, x1, y1]) => { const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([mx, my]) => { const X = mx * T.unit, Z = -my * T.unit; return [T.x + X * c + Z * s, T.y - X * s + Z * c]; }); const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; });
const solid = (x, y) => rects.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
// model plan -> world (the minster is turned half round: its north side faces the world's south)
const W = (mx, my) => [T.x - mx * T.unit, T.y + my * T.unit];
check('the tower, the chancel and the south transept are solid', solid(...W(-4.2, 0)) && solid(...W(4.0, 0)) && solid(...W(2.6, -2.2)));
check('the nave is open inside, and the open ground south of the breach is open', !solid(...W(-1.5, 0)) && !solid(...W(1.0, 0)) && !solid(...W(1.0, 3.0)));
// walk in through the breach in a straight line, from outside to the middle of the nave
let blocked = 0; for (let k = 0; k <= 40; k++) if (solid(...W(1.1, 3.2 - 3.2 * k / 40))) blocked++;
check('the breach in the north wall can be walked straight through into the nave', blocked === 0, blocked);
let shut = 0; for (let k = 0; k <= 40; k++) if (solid(...W(-1.5, 3.2 - 3.2 * k / 40))) shut++;
check('and the whole wall beside it cannot', shut > 0);
check('the breach faces south, toward where people come from', W(1.1, 3.2)[1] > T.y);

setTimeout(() => {
  const h = global.__testHooks;
  const lms = h.emberLandmarksPublic();
  const town = lms.find((l) => l.id === T.id);
  check('the town is named to a traveller like a landmark, and marked as a town', town && town.town === true && town.name === 'Ashminster' && town.x === T.x && town.blurb.length > 60 && lms.length === h.EMBER_LANDMARKS.length + 1);
  check('it anchors no spawns and no veins: the four old landmarks are as they were', h.EMBER_LANDMARKS.length === 4 && !h.EMBER_LANDMARKS.some((l) => l.id === T.id));
  const near = [...h.emberMobs.values ? h.emberMobs.values() : h.emberMobs].filter((m) => !m.boss && Math.hypot(m.spawnX - T.x, m.spawnY - T.y) < T.clear - 1);
  check('nothing rises nearer the minster than its clear ground', near.length === 0, near.length);
  check('the town is well away from the arrival haven and inside the map', Math.hypot(T.x - 10000, T.y - 18600) > 5000 && T.x > 3000 && T.x < 17000 && T.y > 3000);
  check('the model is in the manifest and on disk, and the scene is solid where its walls are', /em_minster: 'kk\/home\/minster\.glb'/.test(main) && fs.existsSync(path.join(root, 'public/kk/home/minster.glb')) && /scene\.userData\.walls = minsterWalls\(\);/.test(scene) && /walls = \(emberScene\.userData && emberScene\.userData\.walls\) \|\| \[\];/.test(main));
  check('lava, geysers, crystals and dead trees are kept out of it', (scene.match(/inTown\(/g) || []).length >= 3 && /spots\.splice\(i, 1\)/.test(scene));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
