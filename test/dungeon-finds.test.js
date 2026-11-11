// Things to do underground (lib/dungeonFinds.js): chests that want a bone key,
// caches, gathering, the two side goals, and traps. Driven here with a fake
// clock and fake players, against the real layouts.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const { DUNGEON_LAYOUTS: L } = require('../data/dungeonLayouts');
const { LOOT_TABLES } = require('../data/gameConstants');

let clock = 1_000_000, roll = 0.99;
const players = new Map(), sent = [];
const mk = (id, room, extra) => { const p = { id, name: id, accountKey: 'acct_' + id, room, x: 0, y: 0, health: 100, isDead: false, ws: id, gold: 0, items: {}, xp: 0, ...extra }; players.set(id, p); return p; };
const delveRunsByRoom = new Map();
const finds = require('../lib/dungeonFinds')({
  players, send: (ws, m) => sent.push({ to: ws, ...m }),
  grantLoot: (pending, p) => { const earned = []; for (const d of pending) { if (d.kind === 'gold') p.gold += d.amount; else p.items[d.itemId] = (p.items[d.itemId] || 0) + d.qty; earned.push(d); } return earned; },
  grantXP: (p, n) => { p.xp += n; }, rollPendingLoot: (t) => (t && t.length ? [{ kind: 'item', itemId: t[0].itemId, qty: 1 }] : []), LOOT_TABLES,
  inventoryStatePayload: () => ({}), absorbIncomingDamage: (_p, d) => d, noteAttacked: () => {},
  delveRunsByRoom, delveFloorTier: (run) => run.tier, playerMaxHealth: () => 100, now: () => clock, random: () => roll,
});
const at = (p, t) => { p.x = t.x; p.y = t.y; };
const said = (p, re) => sent.some((m) => m.to === p.ws && m.type === 'toast' && re.test(m.message));
const l1 = L[1];

const a = mk('a', 'dungeon_t1');
finds.onEnter(a, { fresh: true });
const first = sent.find((m) => m.type === 'dungeon_finds');
check('arriving tells you how the place stands: no keys, nothing lit, nothing broken, nothing used', first && first.keys === 0 && first.lit.length === 0 && first.broken.length === 0 && first.used.length === 0 && first.goals.braziers.total === l1.braziers.length && first.goals.seals.total === l1.seals.length);

// chests and keys
const chest = l1.chests.find((c) => !c.boss), bossChest = l1.chests.find((c) => c.boss);
at(a, { x: chest.x + 400, y: chest.y }); finds.use(a, chest.id);
check('a thing is used only from close by', a.gold === 0 && said(a, /closer/));
at(a, chest); finds.use(a, chest.id);
check('a chest is locked without a bone key', a.gold === 0 && said(a, /Locked/));
roll = 0.99; finds.onKill(a, { boss: false });
check('most creatures carry no key', (a.dungeonKeys || 0) === 0);
roll = 0.01; finds.onKill(a, { boss: false });
check('about one in seven does', a.dungeonKeys === 1 && finds.KEY_DROP_CHANCE === 0.15);
roll = 0.99; finds.onKill(a, { boss: true });
check('a boss always does', a.dungeonKeys === 2);
roll = 0.5; finds.use(a, chest.id);
check('a key opens a chest: gold and two rolls of the dungeon\'s loot, and the key is spent', a.gold >= 25 && a.gold <= 45 && a.items.bone_shard === 2 && a.dungeonKeys === 1);
const g1 = a.gold; finds.use(a, chest.id);
check('…once: the same chest gives nothing more until half an hour has passed', a.gold === g1 && a.dungeonKeys === 1);
at(a, bossChest); finds.use(a, bossChest.id);
check('the boss\'s chest pays more: three rolls', a.gold - g1 >= 60 && a.items.bone_shard === 5 && a.dungeonKeys === 0);
clock += finds.TAKE_AGAIN_MS + 1; a.dungeonKeys = 1; at(a, chest); finds.use(a, chest.id);
check('after half an hour it is worth opening again', a.items.bone_shard === 7);

// caches and gathering
const g2 = a.gold; at(a, l1.caches[0]); finds.use(a, l1.caches[0].id); finds.use(a, l1.caches[0].id);
check('a cache needs no key and is searched once', a.gold - g2 >= 10 && a.gold - g2 <= 20);
const ore = l1.nodes.find((n) => n.kind === 'ore'), shroom = l1.nodes.find((n) => n.kind === 'mushroom'), crystal = l1.nodes.find((n) => n.kind === 'crystal');
roll = 0.9; at(a, ore); finds.use(a, ore.id); finds.use(a, ore.id);
check('an ore seam gives iron ore, once until it has had ten minutes', a.items.iron_ore === 1 && finds.NODE_AGAIN_MS === 600000);
at(a, crystal); finds.use(a, crystal.id);
check('a crystal gives glimmerdust', a.items.glimmerdust === 1);
a.health = 50; at(a, shroom); finds.use(a, shroom.id);
check('cave mushrooms mend a fifth of your health where you stand', a.health === 70);
clock += finds.NODE_AGAIN_MS + 1; at(a, ore); finds.use(a, ore.id);
check('…and the seam can be worked again ten minutes on', a.items.iron_ore === 2);
check('only things that already exist are given', ['iron_ore', 'stone_block', 'glimmerdust', 'enchanted_gem', 'healing_potion'].every((id) => new RegExp('^  ' + id + ':', 'm').test(fs.readFileSync(path.join(root, 'data/itemCatalog.js'), 'utf8'))));

// side goals, shared by everyone in the room
const b = mk('b', 'dungeon_t1'); finds.onEnter(b, { fresh: true });
const gA = a.gold, gB = b.gold;
l1.braziers.forEach((br, i) => { const p = i % 2 ? a : b; at(p, br); finds.use(p, br.id); });
check('lighting every brazier pays everyone in the room, gold and experience', a.gold - gA >= 30 && b.gold - gB >= 30 && a.xp === 20 && b.xp === 20 && said(b, /Every brazier burns/));
const st = finds.payloadFor(a);
check('…and the room shows them all burning, the goal complete', st.lit.length === l1.braziers.length && st.goals.braziers.complete === true);
const xa = a.xp; at(a, l1.seals[0]);
finds.use(a, l1.seals[0].id); finds.use(a, l1.seals[0].id);
check('a seal takes three blows, and not all at once', finds.payloadFor(a).blows[l1.seals[0].id] === 1 && finds.SEAL_BLOWS === 3);
for (const sl of l1.seals) { at(a, sl); for (let i = 0; i < 4; i++) { clock += 800; finds.use(a, sl.id); } }
check('breaking every seal pays too', finds.payloadFor(a).goals.seals.complete === true && a.xp === xa + 30 && said(a, /last seal breaks/));
clock += 10 * 60 * 1000 + 1;
check('ten minutes on, the braziers have guttered and the seals knit, for whoever comes next', finds.payloadFor(a).lit.length === 0 && finds.payloadFor(a).broken.length === 0);
const gA2 = a.gold; l1.braziers.forEach((br) => { at(a, br); finds.use(a, br.id); });
check('…but the same delver is not paid for the same goal twice in half an hour', a.gold === gA2);
finds.resetRoom('dungeon_t1');
check('an emptied room is made new', finds.payloadFor(a).lit.length === 0);

// traps
const hits = () => sent.filter((m) => m.to === 'a' && m.type === 'struck');
const spikes = l1.traps.find((t) => t.kind === 'spikes'), vent = l1.traps.find((t) => t.kind === 'vent'), fall = l1.traps.find((t) => t.kind === 'rockfall');
a.health = 100; at(a, spikes); const h0 = hits().length; finds.tick(); finds.tick();
check('a spike plate bites once and takes time to re-arm', hits().length === h0 + 1 && a.health === 90 && hits().pop().byName === 'a spike plate');
clock += 2600; finds.tick();
check('…then bites again if you are still on it', a.health === 80);
at(a, { x: spikes.x + 300, y: spikes.y }); clock += 5000; finds.tick();
check('off the plate, nothing', a.health === 80);
while (finds.ventOpen(vent, clock)) clock += 100;
at(a, vent); finds.tick();
check('a vent does nothing between breaths', a.health === 80);
while (!finds.ventOpen(vent, clock)) clock += 100;
finds.tick();
check('…and burns while it breathes', a.health === 75);
at(a, fall); clock += 20000; const w0 = sent.filter((m) => m.type === 'trap_warn').length; finds.tick();
check('a rockfall warns first and does not hurt yet', sent.filter((m) => m.type === 'trap_warn').length === w0 + 1 && a.health === 75);
at(a, { x: fall.x + 300, y: fall.y }); clock += 1500; finds.tick();
check('step out from under it and it misses', a.health === 75);
at(a, fall); clock += 100; finds.tick(); clock += 1400; finds.tick();
check('stay under it and it lands', a.health === 59);
a.health = 3; at(a, spikes); clock += 9000; finds.tick();
check('a trap never takes your last point of health', a.health === 1 && a.isDead === false);

// the Delve: every floor is fresh, and pays by the tier you have reached
const run = { floor: 1, tier: 2 }; delveRunsByRoom.set('dungeon_delve_9', run);
const d = mk('d', 'dungeon_delve_9'); finds.onEnter(d, { fresh: true });
const l5 = L[5]; d.dungeonKeys = 2; at(d, l5.caches[0]); finds.use(d, l5.caches[0].id);
check('in the Delve a cache pays by the floor\'s tier', d.gold >= 20 && d.gold <= 40 && d.items.leather_hide === 1);
run.floor = 2; finds.onEnter(d, { fresh: false });
const gd = d.gold; finds.use(d, l5.caches[0].id);
check('a new floor is all fresh, and the keys you hold come down with you', d.gold > gd && d.dungeonKeys === 2);
finds.onLeave(d);
check('leaving, the keys are gone', d.dungeonKeys === 0);

// wiring
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8'), main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8'), scene = fs.readFileSync(path.join(root, 'client/dungeon-scene.js'), 'utf8');
check('the server ticks the traps, takes the use, drops keys on kills, and tells arrivals how things stand', /dungeonFinds\.tick\(\);/.test(server) && /if \(msg\.type === 'dungeon_use'\) \{ dungeonFinds\.use\(player, msg\.id\); return; \}/.test(server) && /dungeonFinds\.onKill\(player, t\);/.test(server) && (server.match(/dungeonFinds\.onEnter\(/g) || []).length >= 3 && /dungeonFinds\.resetRoom\(room\);/.test(server));
check('the client draws each thing, offers it on the action button, and shows what the server says of it', /npc: 'dfind', findId: t\.id, findKind: kind/.test(scene) && /ws\.send\(JSON\.stringify\(\{ type: 'dungeon_use', id: kiosk\.findId \}\)\)/.test(main) && /if \(msg\.type === 'dungeon_finds'\) \{ applyDungeonFinds\(msg\); return; \}/.test(main) && /FIND_VERBS\[kiosk\.findKind\]/.test(main) && /dungeonTrapWarn\(msg\.trap, msg\.ms\)/.test(main));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
