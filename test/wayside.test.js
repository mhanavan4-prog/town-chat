// The road north (data/wayside.js, lib/wayside.js): the gibbet, the coin tree
// and the coffin stone, between the Wilds' portal and the Wildlands Village.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { WAYSIDE, WAY } = require('../data/wayside');
const { WILDS_FINDS } = require('../data/wildsFinds');
const { VILLAGE_HOUSES } = require('../data/villageHouses');

check('three things by the wayside, each with its tier, its lore, its source and where the game leaves them', WAYSIDE.length === 3 && WAYSIDE.every((w) => ['record', 'folk'].includes(w.tier) && w.lore.join(' ').length > 350 && w.source.length > 60 && /game/.test(w.note) && w.hint && w.model));
check('they lie along the road from the portal (south) to the village (north), in that order, and clear of everything else that stands in the Wilds', WAYSIDE.every((w) => Math.abs(w.x - 5000) < 300 && w.y < 8300 && w.y > 3900) && WAYSIDE[0].y > WAYSIDE[1].y && WAYSIDE[1].y > WAYSIDE[2].y
  && WAYSIDE.every((w) => [...WILDS_FINDS.balefires, ...WILDS_FINDS.caches].every((p) => Math.hypot(p.x - w.x, p.y - w.y) > 300) && Object.values(VILLAGE_HOUSES).every((h) => Math.hypot(h.door.x - w.x, h.door.y - w.y) > 600)));

let clock = 200 * 86400000 + 5000, roll = 0.9, xp = 0;
const sent = [], purse = { balance: 10 }, acct = {}, noted = [];
const ws = require('../lib/wayside')({ send: (to, m) => sent.push(m), grantXP: (_p, n) => { xp += n; }, playerMaxHealth: () => 100,
  acctOf: (p) => (p.guest ? null : acct), bankOf: (p) => (p.guest ? null : purse), noteRoad: (p) => noted.push(p.id), now: () => clock, random: () => roll });
const at = (id) => { const w = WAYSIDE.find((x) => x.id === id); return { x: w.x + 40, y: w.y + 60 }; };
const p = { id: 'p', room: 'wilds', health: 40, isDead: false, ws: 'p', ...at('gibbet') };
const said = (re) => sent.some((m) => m.type === 'toast' && re.test(m.message));
const board = () => [...sent].reverse().find((m) => m.type === 'vh_board');

check('it must be reached, and it is out in the Wilds', (p.x += 400, ws.use(p, 'gibbet')) === false && said(/Go up to it/) && (Object.assign(p, at('gibbet')), p.room = 'outside', ws.use(p, 'gibbet')) === false && xp === 0);
p.room = 'wilds'; sent.length = 0;
check('a splinter from the gibbet mends you by a share', ws.use(p, 'gibbet') === true && p.health === 40 + 100 * WAY.splinterHeal && xp === WAY.eachXp && said(/cut a splinter/));
sent.length = 0;
check('the same day, pressing again reads you its history instead: tier, source, and where the game leaves it', ws.use(p, 'gibbet') === false && xp === WAY.eachXp && board() && board().epithet === 'In the record' && board().lines.some((l) => /10 August 1792/.test(l)) && board().lines.some((l) => /^Source: /.test(l)) && /the game's/.test(board().lines[board().lines.length - 1]));
Object.assign(p, at('cointree')); sent.length = 0;
check('a coin goes into the tree, and mostly nothing answers', ws.use(p, 'cointree') === true && purse.balance === 10 - WAY.coinGold && said(/Nothing answers/) && sent.some((m) => m.sfx === 'moon_silver'));
check('two done is not the road', acct.wayside.road === false && noted.length === 0);
Object.assign(p, at('coffinstone')); sent.length = 0; const x0 = xp, g0 = purse.balance;
check('the coffin stone makes three: the road is walked, paid, and written down', ws.use(p, 'coffinstone') === true && acct.wayside.road === true && purse.balance === g0 + WAY.roadGold && xp === x0 + WAY.eachXp + WAY.roadXp && said(/you have walked the road/) && noted.join() === 'p' && sent.some((m) => m.type === 'wayside_state' && m.done.length === 3 && m.road === true));
sent.length = 0;
check('…once a day', ws.use(p, 'coffinstone') === false && purse.balance === g0 + WAY.roadGold && board().epithet === 'Folk tradition');
clock += 86400000; roll = 0.05; Object.assign(p, at('cointree')); sent.length = 0; const g1 = purse.balance;
check('next day it can all be done again, and now and then a wish is heard', ws.use(p, 'cointree') === true && purse.balance === g1 - WAY.coinGold + WAY.wishGold && said(/a purse in the grass/) && acct.wayside.done.join() === 'cointree');
purse.balance = 0; clock += 86400000; sent.length = 0;
check('with no coin there is nothing to give the tree, and it is not counted', ws.use(p, 'cointree') === false && said(/no coin to give it/) && !acct.wayside.done.includes('cointree'));
const g = { id: 'g', guest: true, room: 'wilds', health: 10, isDead: false, ws: 'g', ...at('gibbet') };
check('a guest may use what costs nothing, kept for her visit', ws.use(g, 'gibbet') === true && g.wayside.done.join() === 'gibbet' && (Object.assign(g, at('cointree')), ws.use(g, 'cointree')) === false);
check('the dead do not', (p.isDead = true, Object.assign(p, at('gibbet')), ws.use(p, 'gibbet')) === false);

const server = read('server.js'), main = read('client/main.js'), wilds = read('client/wilds-scene.js');
check('the server sends the three to be drawn, keeps the scatter off them, answers their use and saves what was earned', /WORLD2\.wayside = require\('\.\/data\/wayside'\)\.WAYSIDE\.map/.test(server) && /\.\.\.WORLD2\.wayside\.map\(\(w\) => \(\{ x: w\.x, y: w\.y, r: 230 \}\)\)/.test(server) && /if \(msg\.type === 'wayside_use'\) \{ if \(wayside\.use\(player, String\(msg\.id \|\| ''\)\)\) \{ saveAccounts\(\); saveBankAccounts\(\); \} return; \}/.test(server) && /daybook\.note\(p, 'road'\)/.test(server));
check('the client stands each by the road with its name, and lets it be used', /for \(const w of \(w2\.wayside \|\| \[\]\)\)/.test(wilds) && /npc: 'wayside', waysideId: w\.id/.test(wilds) && /type: 'wayside_use', id: kiosk\.waysideId/.test(main) && /waysideDone\.has\(kiosk\.waysideId\) \? 'read what this is' : kiosk\.hint/.test(main));
check('each has a model in the manifest and on disk', WAYSIDE.every((w) => { const m = new RegExp(w.model + ": 'kk/home/([a-z_]+\\.glb)'").exec(main); return m && fs.existsSync(path.join(root, 'public/kk/home', m[1])); }));
const db = require('../lib/daybook')({ accounts: { a: { daybook: { road: { first: 5, times: 2 } } } } });
check('the road walked has a line in the daybook', (() => { const e = db.body({ accountKey: 'a' }).leaves.find((l) => l.id === 'wilds').entries.find((x) => x.id === 'road'); return e && e.done && e.times === 2; })());
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
