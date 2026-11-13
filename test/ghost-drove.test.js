// The last drove (data/droveRoad.js HERD, lib/ghostDrove.js): by night, at the
// March gate, a pale herd goes west down the drove road to the crossroads.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const { HERD, GATE, ROAD } = require('../data/droveRoad');
const createGhostDrove = require('../lib/ghostDrove');

check('it goes from the gate west to the crossroads, down the road itself', JSON.stringify(HERD.path) === JSON.stringify([...ROAD.pts].reverse()) && Math.hypot(HERD.path[0][0] - GATE.wilds.x, HERD.path[0][1] - GATE.wilds.y) < 120);
check('told as folk tradition, with a source, and a note on where the game goes beyond it', HERD.tier === 'folk' && HERD.lore.length >= 2 && /Llyn y Fan Fach/.test(HERD.lore[0]) && /Rhys/.test(HERD.source) && /game/.test(HERD.note));

let t = 0, night = true;
const sent = [];
const send = (ws, m) => sent.push(m);
const xp = {}; const noted = [];
const dr = createGhostDrove({ send, grantXP: (p, n) => { xp[p.id] = (xp[p.id] || 0) + n; }, playerMaxHealth: () => 100, isNight: () => night, noteHerd: (p) => noted.push(p.id), now: () => t });
const P = (id, x, y) => ({ id, ws: {}, room: 'wilds', x, y, health: 100, isDead: false });

const far = P('far', GATE.wilds.x - 1000, GATE.wilds.y);
dr.tick([far]);
check('nothing comes for someone far from the gate', !far.drove);
night = false;
const day = P('day', GATE.wilds.x - 40, GATE.wilds.y);
dr.tick([day]);
check('nor by day', !day.drove);
night = true;

// one who keeps behind them all the way
const good = P('good', GATE.wilds.x - 40, GATE.wilds.y + 200);
dr.tick([good]);
check('by night at the gate, they come through, and she is told to get off the road', !!good.drove && sent.some((m) => m.type === 'drove_herd' && m.on) && sent.some((m) => m.type === 'toast' && /keep behind them/.test(m.message)));
const step = 250;
let guard = 0;
while (good.drove && guard++ < 2000) {
  t += step;
  const lead = Math.max(0, t - HERD.standMs) / 1000 * HERD.speed;
  const tail = dr.along(lead - dr.length - 160);   // keep a little behind the last of them, on the road
  good.x = tail.x; good.y = tail.y + 150;
  dr.tick([good]);
}
check('kept behind them to the crossroads: seen, and paid', !good.drove && xp.good === HERD.xp && noted.includes('good'));
const again = P('good', GATE.wilds.x - 40, GATE.wilds.y);
again.droveDay = Math.floor(t / 86400000);
dr.tick([again]);
check('once a night', !again.drove);

// one who stands in the road ahead of them
t = 1e9; const bad = P('bad', GATE.wilds.x - 40, GATE.wilds.y);
dr.tick([bad]);
const mid = dr.along(2000); bad.x = mid.x; bad.y = mid.y;
t += HERD.standMs + 1000; dr.tick([bad]);
check('stand in the road ahead of them and you are knocked down', !bad.drove && bad.health === 100 - Math.round(100 * HERD.struck));

// one who falls too far back
t = 2e9; const slow = P('slow', GATE.wilds.x - 40, GATE.wilds.y + 200);
dr.tick([slow]);
t += HERD.standMs + 30000; dr.tick([slow]); t += HERD.loseMs + 10; dr.tick([slow]);
check('fall too far back and they are lost', !slow.drove && !xp.slow);

const main = fs.readFileSync(path.join(__dirname, '..', 'client/main.js'), 'utf8'), server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
check('the server ticks it; the client draws the herd and its drover, pale', /ghostDrove\.tick\(players\.values\(\)\)/.test(server) && /msg\.type === 'drove_herd'\) \{ setDroveHerd\(msg\)/.test(main) && /stepDroveHerd\(\);/.test(main) && /wd_ghost_ox: 'kk\/home\/ghost_ox\.glb'/.test(main) && fs.existsSync(path.join(__dirname, '..', 'public/kk/home/ghost_ox.glb')));
check('a daybook line, and its sound has a prompt', /entry\('herd', '🐄'/.test(fs.readFileSync(path.join(__dirname, '..', 'lib/daybook.js'), 'utf8')) && JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools/audio/sfx.manifest.json'), 'utf8')).sfx.some((e) => e.id === 'drove_herd'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
