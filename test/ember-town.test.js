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
function solidAt(x, y) { return solid(x, y); }
const solid = (x, y) => rects.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
{ const { ASH_PIECES, ASH_SPOTS } = require('../data/emberTown');
  const ev = (name, close) => new Function('TX', 'TY', 'return ' + new RegExp('const ' + name + ' = (' + close + ');').exec(scene)[1])(T.x, T.y);
  const cp = ev('ASH_PIECES', '\\[[\\s\\S]*?\\n\\]'), cs = ev('ASH_SPOTS', '\\{[\\s\\S]*?\\n\\}'), cg = ev('ASH_GROUND', '\\[[^\\n]*\\]');
  check('the client\'s copies of the town (its ground, what stands in it, what can be used) match the server\'s', JSON.stringify(cp) === JSON.stringify(ASH_PIECES) && JSON.stringify(cg) === JSON.stringify(T.ground) && Object.keys(cs).join() === Object.keys(ASH_SPOTS).join() && Object.keys(cs).every((k) => cs[k].x === ASH_SPOTS[k].x && cs[k].y === ASH_SPOTS[k].y && cs[k].hint === ASH_SPOTS[k].hint));
  const models = [...new Set(ASH_PIECES.map((p) => p[0]))];
  check('every piece of the town has a model in the manifest, and the new ones are on disk', models.every((k) => new RegExp('\\b' + k + ': +\'kk/').test(main)) && ['ash_house_a', 'ash_house_b', 'ash_house_c', 'ash_cross', 'ash_barricade', 'frith_cross'].every((f) => fs.existsSync(path.join(root, 'public/kk/home', f + '.glb'))));
  check('twelve houses, a cross, a well and three barricades, all on the town\'s ground', ASH_PIECES.filter((p) => /house/.test(p[0])).length === 12 && ASH_PIECES.filter((p) => p[0] === 'em_barricade').length === 3 && ASH_PIECES.filter((p) => p[0] !== 'em_frith_cross').every((p) => T.ground.some((g) => Math.hypot(p[1] - g.x, p[2] - g.y) < g.r + 60)));
  check('the frith crosses stand on the frith', ASH_PIECES.filter((p) => p[0] === 'em_frith_cross').length === 4 && ASH_PIECES.filter((p) => p[0] === 'em_frith_cross').every((p) => Math.abs(Math.hypot(p[1] - T.x, p[2] - T.y) - T.frith) < 1));
  check('no house stands inside the minster', ASH_PIECES.filter((p) => /house|cross$|well|barricade/.test(p[0]) && p[0] !== 'em_frith_cross').every((p) => !solidAt(p[1], p[2])));
}
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
  const near = [...h.emberMobs.values ? h.emberMobs.values() : h.emberMobs].filter((m) => !m.boss && T.ground.some((g) => Math.hypot(m.spawnX - g.x, m.spawnY - g.y) < g.r - 1));
  check('nothing rises anywhere on the town\'s ground', near.length === 0, near.length);
  check('the town is well away from the arrival haven and inside the map', Math.hypot(T.x - 10000, T.y - 18600) > 5000 && T.x > 3000 && T.x < 17000 && T.y > 3000);
  check('the model is in the manifest and on disk, and the scene is solid where its walls are', /em_minster: 'kk\/home\/minster\.glb'/.test(main) && fs.existsSync(path.join(root, 'public/kk/home/minster.glb')) && /scene\.userData\.walls = minsterWalls\(\);/.test(scene) && /walls = \(emberScene\.userData && emberScene\.userData\.walls\) \|\| \[\];/.test(main));
  check('lava, geysers, crystals and dead trees are kept out of it', (scene.match(/inTown\(/g) || []).length >= 3 && /spots\.splice\(i, 1\)/.test(scene));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
