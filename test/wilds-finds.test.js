// Out in the Wilds (data/wildsFinds.js, lib/wildsFinds.js): caches under
// cairns, six balefires to light in a day. And the Old Ways in the world: the
// bee garth in the town, the besom under you when you land.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { WILDS_FINDS: F, WILDS_FIND_RULES: R, WILDS_FINDS_KEEP_OFF: K } = require('../data/wildsFinds');
const all = [...F.balefires, ...F.caches];
check('six balefires and fourteen caches', F.balefires.length === 6 && F.caches.length === 14);
check('none stands on the entry, a landmark, a camp, the village, a fire, a waymark or a graveyard', all.every((p) => K.every(([x, y, r]) => Math.hypot(p.x - x, p.y - y) > r)));
check('none within 900 of another, and all well inside the Wilds', all.every((p, i) => p.x > 500 && p.y > 500 && p.x < 9500 && p.y < 9500 && all.every((q, j) => i === j || Math.hypot(p.x - q.x, p.y - q.y) > 900)));
const sixth = (p) => Math.floor(p.x / (10000 / 3)) + 3 * Math.floor(p.y / 5000);
check('one balefire in each sixth of the Wilds, so the round is a walk round the whole of it', new Set(F.balefires.map(sixth)).size === 6);
const before = JSON.stringify(F); delete require.cache[require.resolve('../data/wildsFinds')];
check('they lie in the same places every time', JSON.stringify(require('../data/wildsFinds').WILDS_FINDS) === before);

let clock = 20 * 86400000 + 1000, roll = 0.5; const sent = [];
const p = { id: 'a', name: 'a', accountKey: 'a', room: 'wilds', x: 0, y: 0, ws: 'a', gold: 0, items: {}, xp: 0 };
const wf = require('../lib/wildsFinds')({ send: (ws, m) => sent.push(m), grantLoot: (pending, pl) => { for (const d of pending) { if (d.kind === 'gold') pl.gold += d.amount; else pl.items[d.itemId] = (pl.items[d.itemId] || 0) + d.qty; } return pending; }, grantXP: (pl, n) => { pl.xp += n; }, inventoryStatePayload: () => ({}), now: () => clock, random: () => roll });
const at = (t, dx) => { p.x = t.x + (dx || 0); p.y = t.y; };
const c = F.caches[0];
at(c, 300); wf.use(p, c.id);
check('a cairn is searched from close by', p.gold === 0);
at(c); wf.use(p, c.id); wf.use(p, c.id);
check('a cache gives a little gold and one of four common goods, once', p.gold >= R.cacheGold[0] && p.gold <= R.cacheGold[1] && Object.keys(p.items).length === 1 && R.cacheGoods.includes(Object.keys(p.items)[0]) && Object.values(p.items)[0] === 1);
check('…and shows as searched', wf.payloadFor(p).used.includes(c.id));
clock += R.cacheAgainMs + 1; const g0 = p.gold; wf.use(p, c.id);
check('six hours on it is worth searching again', p.gold > g0);
p.room = 'outside'; const g1 = p.gold; wf.use(p, F.caches[1].id); p.room = 'wilds';
check('nothing is found from outside the Wilds', p.gold === g1);
const x0 = p.xp, g2 = p.gold;
F.balefires.slice(0, 5).forEach((f) => { at(f); wf.use(p, f.id); wf.use(p, f.id); });
check('each balefire is lit once a day, for a little experience', wf.payloadFor(p).lit.length === 5 && p.xp === x0 + 5 * R.fireXp && p.gold === g2 && wf.payloadFor(p).complete === false);
at(F.balefires[5]); wf.use(p, F.balefires[5].id);
check('the sixth makes the round: a purse and experience', p.gold === g2 + R.roundGold && p.xp === x0 + 6 * R.fireXp + R.roundXp && wf.payloadFor(p).complete === true && sent.some((m) => m.type === 'toast' && /round is made/.test(m.message)));
clock += 86400000;
check('next day they are out, to be lit again', wf.payloadFor(p).lit.length === 0 && wf.payloadFor(p).complete === false);
const cat = read('data/itemCatalog.js');
check('only goods that already exist are given', R.cacheGoods.every((id) => new RegExp('^  ' + id + ':', 'm').test(cat)));

const server = read('server.js'), main = read('client/main.js'), scene = read('client/wilds-scene.js'), town = read('client/town-scene.js');
check('the Wilds are sent with their finds, and the server takes the use', /WORLD2\.finds = require\('\.\/data\/wildsFinds'\)\.WILDS_FINDS;/.test(server) && /if \(msg\.type === 'wilds_use'\) \{ wildsFinds\.use\(player, String\(msg\.id \|\| ''\)\); return; \}/.test(server) && /if \(msg\.type === 'wilds_finds_state'\) \{ wildsFinds\.sendTo\(player\); return; \}/.test(server));
check('a cairn over each cache and a brazier on a cairn for each balefire, on level ground, offered on the action button', /KK\.staticInstance\('dg_cache', 62, 'fit'\)/.test(scene) && /KK\.staticInstance\('dg_brazier', 78, 'height'\)/.test(scene) && /npc: 'wfind', findId: f\.id, findKind: 'balefire'/.test(scene) && /type: 'wilds_use', id: kiosk\.findId/.test(main) && /the cairns and balefires stand on level ground/.test(main));
check('a lit balefire burns for you, and the day\'s count stands at the top of the screen in the Wilds', /f\.flame\.visible = lit\.has\(id\)/.test(scene) && /function showWildsFindsHud\(msg\)/.test(main) && /🔥 Balefires/.test(main) && /type: 'wilds_finds_state'/.test(main));
check('the bee garth stands in the town and opens the Old Ways', /function buildBeeGarth\(scene\)/.test(town) && /altarModel\(one, 'tw_skep', 34, 'height'\)/.test(town) && /npc: 'oldways'/.test(town) && /kiosk\.npc === 'oldways'\) \{ if \(!Modals\.isOpen\('oldWaysOpen'\)\) _oldWays\.open\(\); return; \}/.test(main) && fs.existsSync(path.join(root, 'public/kk/home/bee_skep.glb')));
check('you land astride the besom, and it is put away after a few moments', /broom\.name = 'ridingBesom'/.test(main) && /setTimeout\(\(\) => \{ if \(broom\.parent\) broom\.parent\.remove\(broom\); \}, 3500\);/.test(main));
check('the Wilds map shows each balefire, ringed while it is still to light today', /for \(const f of world2\.finds\.balefires\)/.test(main) && /if \(!litToday\.has\(f\.id\)\)/.test(main) && /wildsFindsState = msg; applyWildsFinds\(msg\);/.test(main));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
