// The dungeons and the Delve are 2400 across (four times the floor): nine
// chambers joined by doorways, shaped in one place (data/dungeonLayouts.js)
// for the server and the client both, and drawn in modelled cave rock.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { DUNGEON_SIZE, DUNGEON_LAYOUTS: L } = require('../data/dungeonLayouts');
const { DUNGEON_SPAWN_POSITIONS_BY_TIER } = require('../data/dungeons');
const main = read('client/main.js'), scene = read('client/dungeon-scene.js'), server = read('server.js'), dung = read('lib/dungeons.js'), delve = read('lib/delve.js');

check('each is 2400 across, in nine chambers', DUNGEON_SIZE === 2400 && [1, 2, 3, 4, 5].every((n) => L[n].size === 2400 && L[n].chambers.length === 9));
// Everything that stands or lies in a dungeon can be walked to from where you arrive.
function reach(l) {
  const g = 20, N = l.size / g, blocked = new Uint8Array(N * N);
  for (const w of l.walls) for (let x = Math.floor((w.x - 14) / g); x <= Math.floor((w.x + w.w + 14) / g); x++) for (let y = Math.floor((w.y - 14) / g); y <= Math.floor((w.y + w.h + 14) / g); y++) if (x >= 0 && y >= 0 && x < N && y < N) blocked[y * N + x] = 1;
  const seen = new Uint8Array(N * N), q = [[Math.floor(l.entry.x / g), Math.floor(l.entry.y / g)]];
  seen[q[0][1] * N + q[0][0]] = 1;
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (a < 1 || b < 1 || a >= N - 1 || b >= N - 1) continue; const i = b * N + a; if (seen[i] || blocked[i]) continue; seen[i] = 1; q.push([a, b]); } }
  return (p) => seen[Math.floor(p.y / g) * N + Math.floor(p.x / g)] === 1;
}
const lost = [];
for (const n of [1, 2, 3, 4, 5]) { const l = L[n], ok = reach(l); for (const [k, pts] of Object.entries({ boss: [l.boss], portal: [l.portal], plaque: [l.plaque], chambers: l.chambers, lanes: l.lanes, chests: l.chests, caches: l.caches, nodes: l.nodes, traps: l.traps, braziers: l.braziers, seals: l.seals })) for (const p of pts) if (!ok(p)) lost.push(n + ':' + k); }
check('every chamber, creature post and thing to find can be walked to from the way in', lost.length === 0, lost);
const before = JSON.stringify(L);
delete require.cache[require.resolve('../data/dungeonLayouts')];
check('the shapes are worked out the same way every time', JSON.stringify(require('../data/dungeonLayouts').DUNGEON_LAYOUTS) === before);
check('no creature stands in the chamber you arrive in, and 32 posts hold four of each kind', [1, 2, 3, 4, 5].every((n) => L[n].lanes.length === 32 && L[n].lanes.every((p) => Math.hypot(p.x - L[n].entry.x, p.y - L[n].entry.y) > 380)) && DUNGEON_SPAWN_POSITIONS_BY_TIER[2] === L[2].lanes && /const DUNGEON_MOBS_PER_KIND = 4;/.test(dung) && /for \(let inst = 0; inst < DUNGEON_MOBS_PER_KIND; inst\+\+\)/.test(dung));
check('the server sizes the rooms, places bosses and arrivals, and the Delve, from the same shapes', /const \{ DUNGEON_SIZE, DUNGEON_LAYOUTS \} = require\('\.\/data\/dungeonLayouts'\);/.test(server) && /DUNGEON_BOSS_SPAWN_BY_TIER = \{ 1: DUNGEON_LAYOUTS\[1\]\.boss/.test(dung) && /DUNGEON_ENTRY_BY_TIER = \{ 1: DUNGEON_LAYOUTS\[1\]\.entry/.test(dung) && /const DELVE_SPAWN = DUNGEON_LAYOUTS\[5\]\.entry;/.test(delve) && /const DELVE_LANES = DUNGEON_LAYOUTS\[5\]\.lanes;/.test(delve));
check('a Delve floor starts at ten kills, not six', /const DELVE_BASE_KILLS = 10;/.test(delve) && /return DELVE_BASE_KILLS \+ Math\.min\(6, run\.floor - 1\)/.test(delve));
check('the client is sent the shapes on joining and keeps no copy of its own', /dungeonLayouts: DUNGEON_LAYOUTS,/.test(server) && /const DUNGEON_LAYOUTS = \{\};/.test(main) && /for \(const k of Object\.keys\(msg\.dungeonLayouts\)\) DUNGEON_LAYOUTS\[k\] = msg\.dungeonLayouts\[k\];/.test(main) && /DUNGEON_WORLD\.width = DUNGEON_WORLD\.height = one\.size;/.test(main));
const glb = (f) => fs.existsSync(path.join(root, 'public/kk/home', f + '.glb'));
const keys = { dg_wall: 'cave_wall', dg_stalag: 'stalagmites', dg_column: 'rock_column', dg_door: 'door_props', dg_chest: 'chest', dg_chest_open: 'chest_open', dg_cache: 'cache', dg_ore: 'ore_vein', dg_spikes: 'spike_plate', dg_vent: 'gas_vent', dg_rockfall: 'rockfall', dg_brazier: 'brazier', dg_seal: 'seal_stone' };
check('the cave is modelled: wall, stalagmites, column, propped doorway, and the things to find', Object.entries(keys).every(([k, f]) => main.includes(k + ": 'kk/home/" + f + ".glb'") && glb(f)) && /\/\^\(pl\|cr\|gv\|gd\|fl\|cave\|wl\|alt\|tw\|dg\)_\/\.test\(k\)/.test(main));
check('walls, the cave\'s own sides, doorways and columns are drawn in that rock, stained each dungeon\'s colour', /rock\('dg_wall', rx, rz, seg \* 1\.1, 'fit'/.test(scene) && /rock\('dg_door', d\.x, d\.y, d\.width \* 1\.32, 'fit'/.test(scene) && /rock\('dg_column'/.test(scene) && /c\.color\.setHex\(rockStain\)/.test(scene) && /c\.emissive\.setHex\(theme\.glow\)/.test(scene) && /if \(!caveRock\) for \(const w of layout\.walls\)/.test(scene));
check('rock the camera is pressed against is not drawn, and the floor is worn stone', /g\.visible = dx \* dx \+ dz \* dz > 200 \* 200;/.test(scene) && /map: floorTex/.test(scene) && /new THREE\.PlaneGeometry\(SIZE \+ 800, SIZE \+ 800\)/.test(scene));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
