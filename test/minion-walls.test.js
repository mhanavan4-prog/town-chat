// A summoned minion and the rock (lib/minionStep.js): underground it cannot
// walk through a dungeon's walls; above ground nothing changes.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const S = require('../lib/minionStep');
const { DUNGEON_LAYOUTS: L } = require('../data/dungeonLayouts');

check('above ground there are no walls to mind, and a step is a step', S.wallsFor('wilds') === null && S.wallsFor('outside') === null && (() => { const m = { x: 10, y: 10 }; return S.step(m, 100, -50, 0.1, null) && m.x === 20 && m.y === 5; })());
check('each dungeon gives its own walls, and a Delve floor the Delve\'s', [1, 2, 3, 4].every((n) => S.wallsFor('dungeon_t' + n) === L[n].walls) && S.wallsFor('dungeon_delve_12') === L[5].walls);

// the wall on the east side of the Rootcellar's entry chamber (1,2): closed between (1,2) and... find a solid full wall
const walls = L[1].walls;
const solid = walls.find((w) => w.h === 800 && w.w < 60);   // a whole wall running north-south with no doorway
check('the Rootcellar has a whole wall to try', !!solid);
const midY = solid.y + 400, west = solid.x - 60;
{
  const m = { x: west, y: midY };
  let moved = true;
  for (let i = 0; i < 100; i++) moved = S.step(m, 200, 0, 0.05, walls);
  check('walking straight at a wall, it stops at the rock and does not come out the other side', m.x < solid.x && m.x > solid.x - S.MINION_R - 12 && moved === false && !S.blocked(walls, m.x, m.y));
}
{
  const m = { x: west, y: midY };
  for (let i = 0; i < 40; i++) S.step(m, 200, 120, 0.05, walls);
  check('walking at it aslant, it slides along the face', m.x < solid.x && m.y > midY + 200);
}
{
  // through a doorway: the gap in a wall with one
  const d = L[1].doors.find((x) => x.along === 'y');
  const m = { x: d.x - 120, y: d.y };
  for (let i = 0; i < 40; i++) S.step(m, 200, 0, 0.05, walls);
  check('a doorway lets it through', m.x > d.x + 100);
}
{
  const m = { x: solid.x + solid.w / 2, y: midY };
  check('one that is somehow in the rock already can walk out of it', S.blocked(walls, m.x, m.y) && S.step(m, 300, 0, 0.2, walls) && !S.blocked(walls, m.x, m.y));
}
{
  // nothing in any dungeon lets a straight walk across the whole floor pass through a closed wall
  let leaks = 0;
  for (const n of [1, 2, 3, 4, 5]) for (const w of L[n].walls) {
    if (Math.max(w.w, w.h) < 300) continue;
    const horiz = w.w >= w.h;
    const m = horiz ? { x: w.x + w.w / 2, y: w.y - 80 } : { x: w.x - 80, y: w.y + w.h / 2 };
    for (let i = 0; i < 80; i++) S.step(m, horiz ? 0 : 150, horiz ? 150 : 0, 0.05, L[n].walls);
    if (horiz ? m.y > w.y + w.h : m.x > w.x + w.w) leaks++;
  }
  check('no long wall in any dungeon or the Delve can be walked through at its middle', leaks === 0, leaks);
}
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
check('the server moves every minion this way, lets it give up a quarry it cannot reach, and brings a stranded one to its mistress', /const moved = minionStep\.step\(m, vx, vy, dt, minionStep\.wallsFor\(m\.room\)\);/.test(server) && /if \(found\) m\.shunUntil = now \+ 4000;/.test(server) && /const found = now < \(m\.shunUntil \|\| 0\) \? null : findMinionTarget\(m\);/.test(server) && /minionStep\.REJOIN_DIST\) \{\s+m\.x = owner\.x/.test(server));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
