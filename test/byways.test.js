// By-ways of the Wilds (data/byways.js, lib/byways.js): the shoe in the chimney, the Devil's stone, Hob's hole.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const { BYWAYS, BYWAY } = require('../data/byways');
const { ROAD, STOPS } = require('../data/droveRoad');
const { WAYSIDE } = require('../data/wayside');
const createByways = require('../lib/byways');

check('three places, each named for the record or for folk tradition, with a source and a note on where the game goes beyond it', BYWAYS.length === 3 && BYWAYS.every((b) => (b.tier === 'record' || b.tier === 'folk') && b.lore.length >= 2 && b.source && /game/.test(b.note) && b.says && b.hint));
const by = Object.fromEntries(BYWAYS.map((b) => [b.id, b]));
check('the hidden shoes are record, and say that the reason is a reading, not a record', by.shoe.tier === 'record' && /Nobody who hid one wrote down why/.test(by.shoe.lore[1]) && /Winchester Cathedral/.test(by.shoe.lore[0]) && /Swann/.test(by.shoe.source));
check('the Devil\'s stone is folk, and says nobody can show it is old', by.stone.tier === 'folk' && /Shebbear/.test(by.stone.lore[0]) && /no record of it before the twentieth century/.test(by.stone.lore[1]) && /Roud/.test(by.stone.source));
check('Hob\'s hole is folk, with when it was written down', by.hob.tier === 'folk' && /Runswick Bay/.test(by.hob.lore[0]) && /1889/.test(by.hob.lore[1]) && /1889/.test(by.hob.source));
const others = [[require('../data/troyTown').TROY_TOWN.x, require('../data/troyTown').TROY_TOWN.y], [8600, 6600], [3700, 6000], [2900, 8300], [5000, 3000], [5000, 8800], ...[[3000, 5000], [7000, 7000], [1500, 4000], [8500, 2000], [4200, 6600], [8600, 5200]], ...WAYSIDE.map((w) => [w.x, w.y]), ...STOPS.map((s) => [s.x, s.y]), ...ROAD.pts];
check('they stand clear of the Wilds\' other places, the tombs, the roads and each other', BYWAYS.every((b) => others.every(([x, y]) => Math.hypot(b.x - x, b.y - y) > 600) && BYWAYS.every((c) => c === b || Math.hypot(b.x - c.x, b.y - c.y) > 1500)), BYWAYS.map((b) => Math.round(Math.min(...others.map(([x, y]) => Math.hypot(b.x - x, b.y - y))))));

let t = 86400000 * 400;
const sent = []; const xp = {}; const bank = { balance: 0 };
const bw = createByways({ send: (ws, m) => sent.push(m), grantXP: (p, n) => { xp[p.id] = (xp[p.id] || 0) + n; }, playerMaxHealth: () => 100, bankOf: () => bank, now: () => t });
const p = { id: 'a', ws: {}, room: 'wilds', x: 0, y: 0, health: 20, isDead: false };
check('from too far off: go up to it', bw.use(p, 'hob') === false && sent.some((m) => /Go up to it/.test(m.message || '')));
Object.assign(p, { x: by.hob.x + 50, y: by.hob.y });
check('Hob\'s hole mends you', bw.use(p, 'hob') === true && p.health === 20 + 100 * BYWAY.hobHeal && xp.a === BYWAY.eachXp);
sent.length = 0;
check('again that day reads you its history and pays nothing more', bw.use(p, 'hob') === false && sent.some((m) => m.type === 'vh_board' && /Folk tradition/.test(m.epithet)) && xp.a === BYWAY.eachXp);
Object.assign(p, { x: by.shoe.x, y: by.shoe.y + 60 }); sent.length = 0;
check('the shoe: you look, and are told what it is', bw.use(p, 'shoe') === true && sent.some((m) => m.type === 'vh_board' && /In the record/.test(m.epithet)));
Object.assign(p, { x: by.stone.x, y: by.stone.y + 60 }); sent.length = 0;
check('all three in a day: the by-ways walked, and paid once', bw.use(p, 'stone') === true && sent.some((m) => /walked the by-ways/.test(m.message || '')) && bank.balance === BYWAY.walkedGold && bw.stateOf(p).walked === true);
t += 86400000;
check('and each again tomorrow', bw.stateOf(p).done.length === 0);
Object.assign(p, { room: 'outside' });
check('only in the Wilds', bw.use(p, 'stone') === false);

const server = read('server.js'), main = read('client/main.js'), wilds = read('client/wilds-scene.js');
check('the server sends them with the Wilds, keeps the scatter off them, and answers', /WORLD2\.byways = require\('\.\/data\/byways'\)/.test(server) && /\.\.\.WORLD2\.byways\.map\(\(w\) => \(\{ x: w\.x, y: w\.y, r: 260 \}\)\)/.test(server) && /if \(msg\.type === 'byway_use'\) \{ if \(byways\.use\(player, String\(msg\.id \|\| ''\)\)\)/.test(server));
check('the client stands them in the Wilds and lets each be used', /for \(const b of \(w2\.byways \|\| \[\]\)\)/.test(wilds) && /npc: 'byway', bywayId: b\.id/.test(wilds) && /type: 'byway_use', id: kiosk\.bywayId/.test(main) && /bywayDone\.has\(kiosk\.bywayId\)/.test(main));
check('each has its model in the kit, and its sound a prompt and a stand-in', ['ruin_hearth', 'devil_stone', 'hob_hole'].every((k) => fs.existsSync(path.join(__dirname, '..', 'public/kk/home', k + '.glb')) && new RegExp(`wd_${k}: 'kk/home/${k}\\.glb'`).test(main)) && ['byway_shoe', 'byway_stone', 'byway_hob'].every((id) => new RegExp(`${id}: '`).test(main) && JSON.parse(read('tools/audio/sfx.manifest.json')).sfx.some((e) => e.id === id)));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
