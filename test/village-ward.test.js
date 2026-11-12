// The bound fires of the Wildlands Village (data/villageWard.js, lib/villageWard.js).
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { WARD } = require('../data/villageWard');
const { VILLAGE_HOUSES } = require('../data/villageHouses');
const { WAYSIDE, CANDLE } = require('../data/wayside');

check('it names its tier, its sources, and where the game goes beyond the record', WARD.tier === 'record' && WARD.lore.join(' ').length > 600 && /Martin Martin/.test(WARD.source) && /are the game's/.test(WARD.note));
const C = WARD.centre;
check('four stones, in the sun\'s order: east, south, west, north (north is up the map)', WARD.stones.map((s) => s.id).join() === 'east,south,west,north' && WARD.stones[0].x > C.x && WARD.stones[1].y > C.y && WARD.stones[2].x < C.x && WARD.stones[3].y < C.y && WARD.stones.every((s) => Math.abs(Math.hypot(s.x - C.x, s.y - C.y) - WARD.radius) < 1));
check('the round takes in every house of the village, with room to spare, and leaves the road\'s own things outside it', Object.values(VILLAGE_HOUSES).every((h) => Math.hypot(h.door.x - C.x, h.door.y - C.y) + Math.max(h.width, h.height) * 0.35 < WARD.radius)
  && WAYSIDE.every((w) => Math.hypot(w.x - C.x, w.y - C.y) > WARD.radius + 100) && CANDLE.path.every(([x, y]) => Math.hypot(x - C.x, y - C.y) > WARD.radius) && WARD.stones.every((s) => WAYSIDE.every((w) => Math.hypot(w.x - s.x, w.y - s.y) > 180)));

let night = true, cycle = 7; const xp = {}, sent = [], wilds = [], noted = []; let closed = 0;
const people = {};
const ward = require('../lib/villageWard')({ send: (to, m) => sent.push([to, m]), tellWilds: (m) => wilds.push(m), grantXP: (p, n) => { xp[p.id] = (xp[p.id] || 0) + n; }, isNight: () => night, cycleId: () => cycle, playerById: (id) => people[id] || null, noteWard: (p) => noted.push(p.id), onClosed: () => { closed++; } });
const mk = (id) => (people[id] = { id, ws: id, room: 'wilds', isDead: false, x: 0, y: 0 });
const a = mk('a'), b = mk('b');
const at = (p, id) => { const s = WARD.stones.find((x) => x.id === id); p.x = s.x + 30; p.y = s.y + 50; };
const light = (p, id) => { at(p, id); sent.length = 0; wilds.length = 0; return ward.use(p, id); };
const told = (re) => sent.some(([, m]) => m.type === 'toast' && re.test(m.message));
const cried = (re) => wilds.some((m) => m.type === 'toast' && re.test(m.message));
const state = () => [...wilds].reverse().find((m) => m.type === 'ward_state');

night = false;
check('by day the basket is cold, and you are read the history instead', light(a, 'east') === false && told(/cold/) && sent.some(([, m]) => m.type === 'vh_board' && m.epithet === 'In the record' && m.lines.some((l) => /^Source: /.test(l))) && !ward.isWarded());
night = true;
check('it must be reached, out in the Wilds, by the living', (at(a, 'east'), a.x += 400, ward.use(a, 'east')) === false && (at(a, 'east'), a.room = 'outside', ward.use(a, 'east')) === false && (a.room = 'wilds', a.isDead = true, ward.use(a, 'east')) === false);
a.isDead = false;
check('the round may be begun at any stone', light(a, 'south') === true && state().lit.join() === 'south' && told(/Carry it on sunways to the west bound stone/) && xp.a === WARD.eachXp && sent.some(([, m]) => m.sfx === 'balefire_light'));
check('a stone that is burning is not lit twice', light(b, 'south') === false && told(/This one is burning/) && !xp.b);
check('another may carry it on from where the first left it', light(b, 'west') === true && state().lit.join() === 'south,west' && light(a, 'north') === true && !ward.isWarded());
check('nothing is kept out until the round is closed', ward.keepOut(C.x + 100, C.y) === null);
check('the fourth closes it: everyone in the Wilds is told, and all who carried fire are rewarded and have it written down', light(b, 'east') === true && ward.isWarded() && state().warded === true && cried(/round is closed/) && wilds.some((m) => m.sfx === 'ward') && xp.a === 2 * WARD.eachXp + WARD.roundXp && xp.b === 2 * WARD.eachXp + WARD.roundXp && noted.sort().join() === 'a,b' && closed === 1);
const out = ward.keepOut(C.x + 300, C.y + 400);
check('a night creature inside is put out to the edge of the round, on its own bearing, and one outside is left be', out && Math.abs(Math.hypot(out.x - C.x, out.y - C.y) - WARD.radius) < 0.01 && Math.abs((out.x - C.x) / (out.y - C.y) - 0.75) < 1e-6 && ward.keepOut(C.x + WARD.radius + 5, C.y) === null && ward.keepOut(C.x, C.y).x === C.x + WARD.radius);
check('once closed there is nothing more to light', light(a, 'east') === false && told(/round is closed/) && xp.a === 2 * WARD.eachXp + WARD.roundXp);
night = false; wilds.length = 0; ward.tick();
check('at dawn the fires are out, the Wilds are told, and the village is open again', !ward.isWarded() && state() && state().lit.length === 0 && state().warded === false && ward.keepOut(C.x, C.y) === null);
night = true; cycle = 8;
check('the next night it is all to do again', light(a, 'east') === true && light(a, 'south') === true && state().lit.join() === 'east,south');
check('carried against the sun, or with a stone passed over, the round is broken and every fire goes out', light(b, 'north') === false && state().lit.length === 0 && cried(/against the sun/) && cried(/after the south bound stone, the west bound stone/) && !ward.isWarded() && light(b, 'north') === true && light(b, 'west') === false && state().lit.length === 0);
check('one person can carry the whole round alone', ['west', 'north', 'east', 'south'].every((id) => light(a, id) === true) && ward.isWarded());

const server = read('server.js'), main = read('client/main.js'), ws = read('client/wilds-scene.js');
check('the server draws the stones for the client, keeps the scatter off them, answers their use and tells a newcomer how the round stands', /WORLD2\.ward = \{ centre: WARD\.centre, radius: WARD\.radius/.test(server) && /\.\.\.WORLD2\.ward\.stones\.map\(\(s\) => \(\{ x: s\.x, y: s\.y, r: 150 \}\)\)/.test(server) && /if \(msg\.type === 'ward_use'\) \{ villageWard\.use\(player, String\(msg\.id \|\| ''\)\); return; \}/.test(server) && /wildsFinds\.sendTo\(player\); send\(ws, villageWard\.payload\(\)\);/.test(server));
check('the night creatures of the Wilds are held at the round each step, and put out of it when it closes; it ends on the tick at dawn', /wildsWalk\(m, vx, vy, dt, now, margin\);\n[^\n]*\n {4}\{ const out = villageWard\.keepOut\(m\.x, m\.y\); if \(out\) \{ m\.x = out\.x; m\.y = out\.y; \} \}/.test(server) && /onClosed: \(\) => \{ for \(const m of mobs2\)/.test(server) && /villageWard\.tick\(\);/.test(server));
check('the client stands a stone at each, shows its flame when lit, and lets fire be put to it', /for \(const s of w2\.ward\.stones\)/.test(ws) && /wardFlames\[id\]\.visible = lit\.has\(id\)/.test(ws) && /type: 'ward_use', id: kiosk\.wardId/.test(main) && /if \(msg\.type === 'ward_state'\) \{ wardState = msg; applyVillageWard\(msg\); return; \}/.test(main));
check('the stone has a model in the manifest and on disk', /wd_boundstone: 'kk\/home\/boundstone\.glb'/.test(main) && fs.existsSync(path.join(root, 'public/kk/home/boundstone.glb')));
const db = require('../lib/daybook')({ accounts: { z: { daybook: { ward: { first: 3, times: 2 } } } } });
check('and the round has a line in the daybook', db.body({ accountKey: 'z' }).leaves.find((l) => l.id === 'wilds').entries.find((x) => x.id === 'ward').times === 2);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
