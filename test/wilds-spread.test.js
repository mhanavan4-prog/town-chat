// The way into the Wilds is left open: the four old places (the clootie well,
// the Crick-stone, the Shepherd's Race, the Nine-and-Twenty) stand far apart
// in different quarters, the graveyard is moved off the entry, and nothing
// that grows or lies about is left standing on any of them.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { CLOOTIE_WELL } = require('../data/clootie');
const { COUNTLESS } = require('../data/countlessStones');
const { MEN_AN_TOL } = require('../data/menAnTol');
const TT = require('../data/troyTown');
const D = require('../data/oldWays');
const geo = TT.troyTownGeometry();
const SPAWN = { x: 5000, y: 8800 };
const places = { well: CLOOTIE_WELL, stones: COUNTLESS, crick: MEN_AN_TOL, race: { x: geo.hub[0], y: geo.hub[1] } };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const names = Object.keys(places);
check('each stands at least 1800 from where you arrive', names.every((n) => dist(places[n], SPAWN) > 1800), names.map((n) => Math.round(dist(places[n], SPAWN))));
const pairs = []; for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) pairs.push(Math.round(dist(places[names[i]], places[names[j]])));
check('…and at least 2000 from each other', pairs.every((d) => d > 2000), pairs);
check('two lie west of the portal and two east', names.filter((n) => places[n].x < SPAWN.x).length === 2);
const taken = [[2200, 5000, 540], [7800, 5000, 540], [6500, 6200, 330], [5000, 3000, 780], [2000, 2000, 470], [3000, 3000, 340], [3400, 4300, 150], [6300, 5300, 150], [2650, 2650, 150], [5000, 1600, 150], [3800, 7300, 150], [5900, 4300, 150], [2900, 5200, 150], [2350, 2350, 150], [7300, 3300, 150]];
const reach = { well: 310, stones: COUNTLESS.radius + 140, crick: 330, race: geo.radius + 90 };
check('none is set down on a camp, the village, the great tree, a fire or a waymark', names.every((n) => taken.every(([x, y, r]) => Math.hypot(places[n].x - x, places[n].y - y) > r + reach[n] + 100)));
check('all are inside the Wilds with room round them', names.every((n) => places[n].x - reach[n] > 400 && places[n].x + reach[n] < 9600 && places[n].y - reach[n] > 400 && places[n].y + reach[n] < 9600));
const main = read('client/main.js'), server = read('server.js'), callers = read('lib/callers.js');
check('the graveyard that crowded the entry is moved to the south-east', !/\[5000,8500\]/.test(main) && /\[6300,9150\]/.test(main) && Math.hypot(6300 - 5000, 9150 - 8800) > 1200);
check('whatever the scatter set down on one of them is moved out to its edge, and nothing else moves', /for \(const d of WORLD2\.natureDecor\) \{\s+for \(const z of keepOff\) \{/.test(server) && /d\.x = Math\.round\(z\.x \+ ux \* \(z\.r \+ 30\)\);/.test(server) && /const spawnKeepOut = 130;/.test(server));
check('no boulder or bush is strewn on them either', /no boulder or bush on the four old places/.test(main) && /w2\.troyTown \? \[\{ x: w2\.troyTown\.hub\[0\], y: w2\.troyTown\.hub\[1\], r: w2\.troyTown\.radius \+ 80 \}\]/.test(main));
check('where each is said to be is where it is', /a good way east of the portal/.test(callers) && /far to the west of the portal, in the south-west/.test(callers) && /north-west of the portal, out on the western moor/.test(callers) && /north-east of the portal, in the east of the Wilds/.test(callers) && /south-west of the Wilds, a long walk west of the portal/.test(read('data/clootie.js')));
const land = (id) => D.BESOM_LANDINGS.find((l) => l.id === id);
check('the besom will carry you to each, setting you down just outside it', ['clootie', 'crick', 'troy', 'countless'].every((id) => land(id) && land(id).room === 'wilds') && dist(land('clootie'), CLOOTIE_WELL) > 260 && dist(land('clootie'), CLOOTIE_WELL) < 500 && dist(land('troy'), places.race) > geo.radius && dist(land('countless'), COUNTLESS) > COUNTLESS.radius + 60 && dist(land('crick'), MEN_AN_TOL) > 200);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
