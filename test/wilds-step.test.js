// Creatures of the Wilds go round what stands solid (data/wildsSolids.js,
// lib/wildsStep.js) instead of walking through houses and stones.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const { WILDS_SOLIDS } = require('../data/wildsSolids');
const { step, blocked, SOLIDS, R } = require('../lib/wildsStep');
const { VILLAGE } = require('../data/villageHouses');

check('the copy of what is solid holds the village\'s houses and the larger stones, and nothing slight', WILDS_SOLIDS.length >= 20 && WILDS_SOLIDS.every((s) => s.length === 4 && Math.max(s[2], s[3]) >= 44 && s.every(Number.isFinite)) && WILDS_SOLIDS.filter(([x, y, w, h]) => w * h > 60000 && Math.hypot(x + w / 2 - VILLAGE.x, y + h / 2 - VILLAGE.y) < 1100).length >= 5);
check('the middle of the village hall is solid, the open ground before it is not', blocked(VILLAGE.x, VILLAGE.y) && !blocked(VILLAGE.x, VILLAGE.y + 700));
check('stones huddled close enough to make a pocket are taken as one', SOLIDS.length > WILDS_SOLIDS.length);

const inAny = (x, y) => WILDS_SOLIDS.some(([sx, sy, w, h]) => x > sx && x < sx + w && y > sy && y < sy + h);
let crossings = 0, inside = 0, worst = 0; const lost = [];
for (const [sx, sy, w, h] of WILDS_SOLIDS) for (let k = 0; k < 12; k++) {
  // from one side of each solid to the point straight through it on the other, as a creature after a player would go
  const a = k / 12 * Math.PI * 2, cx = sx + w / 2, cy = sy + h / 2, r = Math.max(w, h) * 0.75 + 140;
  const m = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }, T = { x: cx - Math.cos(a) * r, y: cy - Math.sin(a) * r };
  if (blocked(m.x, m.y) || blocked(T.x, T.y)) continue;
  crossings++;
  let t = 0;
  for (let i = 0; i < 3000; i++) { const d = Math.hypot(T.x - m.x, T.y - m.y); if (d < 25) break; step(m, (T.x - m.x) / d * 90, (T.y - m.y) / d * 90, 0.05, t); t += 50; if (inAny(m.x, m.y)) inside++; }
  if (Math.hypot(T.x - m.x, T.y - m.y) >= 25) lost.push([sx, sy, k]); else worst = Math.max(worst, (t / 1000) / (2 * r / 90));
}
check('sent straight at every solid from twelve sides, a creature never sets foot inside one', crossings > 300 && inside === 0, { crossings, inside });
check('…and always comes out on the far side', lost.length === 0, lost.slice(0, 6));
check('…in no more than three times what the straight walk would take', worst > 1 && worst < 3, worst);

const free = { x: 800, y: 800 }; step(free, 60, -40, 0.1, 0);
check('in the open it goes exactly where it meant to', !blocked(800, 800) && Math.abs(free.x - 806) < 1e-9 && Math.abs(free.y - 796) < 1e-9);
const still = { x: 800, y: 800 }; step(still, 0, 0, 0.1, 0);
check('one that is not moving is not moved', still.x === 800 && still.y === 800);
const stuck = { x: VILLAGE.x, y: VILLAGE.y }; step(stuck, 50, 0, 0.1, 0);
check('one that finds itself inside a wall is let walk out', stuck.x === VILLAGE.x + 5);

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
check('the night creatures and the neutral ones both walk this way, kept inside the map, and face the way they went', (server.match(/wildsWalk\(m, vx, vy, dt, now, margin\);/g) || []).length === 2 && /wildsStep\.step\(m, vx, vy, dt, now\);/.test(server) && /m\.facing = \(mx !== 0 \|\| my !== 0\) \? Math\.atan2\(mx, my\) : Math\.atan2\(vx, vy\);/.test(server));
check('the copy can be taken again from the running client', /walls\(\) \{ return walls\.map/.test(fs.readFileSync(path.join(__dirname, '..', 'client/main.js'), 'utf8')) && R > 0);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
