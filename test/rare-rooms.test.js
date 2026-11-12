// Rare rooms (data/rareRooms.js, lib/dungeonFinds.js): now and then one chamber
// of a dungeon or a Delve floor is the Marked Chamber, the Walled-Up Hoard or
// the Pin Well. Driven with a fake clock and fake players against the real
// layouts; which room is rare is forced here, and the real roll is checked apart.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { DUNGEON_LAYOUTS: L } = require('../data/dungeonLayouts');
const { LOOT_TABLES } = require('../data/gameConstants');
const R = require('../data/rareRooms');
const realRareFor = R.rareFor;

// the data
check('three rare rooms, each with its tier, lore, source and where the game leaves the record', R.RARE_KINDS.length === 3 && R.RARE_KINDS.every((k) => { const r = R.RARE_ROOMS[k]; return r.id === k && ['record', 'folk'].includes(r.tier) && r.lore.length > 300 && r.source.length > 50 && /game/.test(r.note) && r.how.length > 60 && r.icon && r.name; }));
check('every dungeon and the Delve has chambers a rare room can be in, clear of everything else that stands there', [1, 2, 3, 4, 5].every((n) => L[n].rareSites.length >= 3 && L[n].rareSites.every((s) => [...L[n].lanes, ...L[n].traps, ...L[n].braziers, ...L[n].seals, ...L[n].nodes, ...L[n].chests, ...L[n].caches].every((p) => Math.hypot(p.x - s.x, p.y - s.y) > 120) && L[n].pillars.every((w) => s.x < w.x - 60 || s.x > w.x + w.w + 60 || s.y < w.y - 60 || s.y > w.y + w.h + 60) && Math.hypot(s.x - L[n].entry.x, s.y - L[n].entry.y) > 500 && Math.hypot(s.x - L[n].boss.x, s.y - L[n].boss.y) > 500)));
{
  let some = 0; const kinds = new Set(), sites = new Set();
  for (let i = 0; i < 4000; i++) { const r = realRareFor(i * 7919 + 13, L[1].rareSites, R.RARE.chance); if (r) { some++; kinds.add(r.kind); sites.add(r.site.id); } }
  const a = realRareFor(424242, L[1].rareSites, 1), b = realRareFor(424242, L[1].rareSites, 1);
  check('the roll: about four spells in ten have one, every kind and every site comes up, and the same spell gives everyone the same room', Math.abs(some / 4000 - R.RARE.chance) < 0.04 && kinds.size === 3 && sites.size === L[1].rareSites.length && a.kind === b.kind && a.site.id === b.site.id && realRareFor(1, [], 1) === null);
}

let forced = null;
R.rareFor = (seed, sites) => (forced ? { kind: forced, site: sites[0] } : null);
let clock = 1_000_000, roll = 0;
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
R.rareFor = realRareFor;
const said = (p, re) => sent.some((m) => m.to === p.ws && m.type === 'toast' && re.test(m.message));
const last = (p) => [...sent].reverse().find((m) => m.to === p.ws && m.type === 'dungeon_finds');
const site = L[2].rareSites[0];
const a = mk('a', 'dungeon_t2'), b = mk('b', 'dungeon_t2');

// none
finds.onEnter(a, { fresh: true });
check('most of the time there is none, and nothing is said of one', last(a).rare === null && !said(a, /Somewhere down here/) && finds.sheltered(a) === false);
a.x = site.x; a.y = site.y; sent.length = 0; finds.use(a, 'rare');
check('…and there is nothing there to use', sent.length === 0);

// the Marked Chamber
forced = 'marked'; sent.length = 0;
finds.onEnter(a, { fresh: true });
check('arriving, you are told one is down here, and where it is comes with the place', said(a, /The Marked Chamber/) && last(a).rare.kind === 'marked' && last(a).rare.x === site.x && last(a).rare.y === site.y && last(a).rare.until > clock);
a.x = site.x + R.RARE.radius - 5; a.y = site.y;
check('among the marks nothing of the dungeon comes at you; a step outside them it does', finds.sheltered(a) === true && (a.x += 10, finds.sheltered(a)) === false);
a.x = site.x; a.health = 40;
finds.tick(); const h0 = a.health;
clock += R.RARE.mendEveryMs; finds.tick(); const h1 = a.health;
clock += R.RARE.mendEveryMs; finds.tick(); const h2 = a.health;
check('resting there mends you a little at a time', h0 === 40 && h1 === 43 && h2 === 46);
a.health = 99; clock += R.RARE.mendEveryMs; finds.tick();
check('…and never past whole', a.health === 100);
a.x = site.x + 1000; a.health = 50; clock += R.RARE.mendEveryMs * 3; finds.tick();
check('away from the marks nothing mends', a.health === 50);
a.x = site.x; a.y = site.y + 60; sent.length = 0; finds.use(a, 'rare');
check('the marks can be read', said(a, /Doubled Vs/));
a.isDead = true;
check('the dead are not sheltered', finds.sheltered(a) === false);
a.isDead = false;

// the Walled-Up Hoard
forced = 'hoard'; sent.length = 0; clock += R.RARE.spellMs; finds.tick();
check('when the spell turns the room is told what is there now', said(a, /The Walled-Up Hoard/) && said(b, /The Walled-Up Hoard/) && last(b).rare.kind === 'hoard' && last(b).rare.open === false);
a.x = site.x + 400; sent.length = 0; finds.use(a, 'rare');
check('it must be reached', said(a, /Get closer/) && a.gold === 0);
a.x = site.x; a.y = site.y + 60; b.x = site.x + 60; b.y = site.y;
finds.use(a, 'rare'); clock += 800; finds.use(b, 'rare'); clock += 100; finds.use(b, 'rare');
check('two blows, from anyone, and a blow struck too soon after your last does not count', last(a).rare.blows === 2 && last(a).rare.open === false && said(b, /1 more blow\./));
clock += 800; sent.length = 0; finds.use(a, 'rare');
check('the third brings the stones down for the whole room', last(a).rare.open === true && last(b).rare.open === true && said(b, /The stones come down/) && a.gold === 0);
clock += 800; finds.use(a, 'rare');
const coin = finds.TIER_COIN[2], [lo, hi] = R.RARE.hoardPurse;
check('reaching in pays a purse in the dungeon\'s coin and two rolls of its loot', a.gold === Math.round(lo * coin) && Object.values(a.items).reduce((x, y) => x + y, 0) === R.RARE.hoardRolls && last(a).rare.used === true);
const g1 = a.gold; finds.use(a, 'rare');
check('…once', a.gold === g1 && said(a, /had your share/));
finds.use(b, 'rare');
check('everyone there has a share of their own', b.gold === Math.round(lo * coin) && last(b).rare.used === true);
roll = 0.999; const c = mk('c', 'dungeon_t2'); c.x = site.x; c.y = site.y + 60; finds.use(c, 'rare');
check('the purse runs between its two ends, and is worth less than the boss\'s chest', c.gold === Math.round(hi * coin) && hi < finds.PURSES.bossChest[1] && lo > finds.PURSES.chest[0]);
roll = 0;

// the Pin Well
forced = 'well'; clock += R.RARE.spellMs; finds.tick(); sent.length = 0;
a.health = 12; a.dungeonKeys = 0; const xp0 = a.xp;
finds.use(a, 'rare');
check('a bent pin in the well: you are whole, and there is a bone key', a.health === 100 && a.dungeonKeys === 1 && a.xp === xp0 + R.RARE.wellXp && said(a, /bend a pin/) && last(a).keys === 1 && last(a).rare.used === true);
a.health = 30; finds.use(a, 'rare');
check('…one pin each', a.health === 30 && a.dungeonKeys === 1 && said(a, /One is enough/));
b.x = site.x; b.y = site.y + 60; b.health = 5; finds.use(b, 'rare');
check('the next comer has her own', b.health === 100 && b.dungeonKeys === 1);

// gone again
forced = null; clock += R.RARE.spellMs; sent.length = 0; finds.tick();
check('when it is gone the room is told so by its absence', last(a).rare === null && !said(a, /Somewhere down here/));

// the Delve
forced = 'well';
delveRunsByRoom.set('dungeon_delve_9', { tier: 3, floor: 2 });
const d = mk('d', 'dungeon_delve_9'); sent.length = 0;
finds.onEnter(d, {});
const ds = L[5].rareSites[0];
check('a Delve floor can have one, for as long as the floor lasts', said(d, /The Pin Well/) && last(d).rare.x === ds.x && last(d).rare.until === 0);
d.x = ds.x; d.y = ds.y + 50; d.health = 1; finds.use(d, 'rare');
delveRunsByRoom.get('dungeon_delve_9').floor = 3; d.health = 1; finds.use(d, 'rare');
check('…and the next floor\'s is a new one', d.dungeonKeys === 2 && d.health === 100);
check('a dungeon\'s rare room turns with the spell of the hour, a Delve floor\'s with the floor', finds.rareOf({ n: 1, tier: 1, key: 'dungeon_t1', base: 'dungeon_t1', delve: false }).token === 'dungeon_t1@' + Math.floor(clock / R.RARE.spellMs) && finds.rareOf({ n: 5, tier: 3, key: 'dungeon_delve_9#3', base: 'dungeon_delve_9#3', delve: true }).token === 'dungeon_delve_9#3');

// wiring
const server = read('server.js'), main = read('client/main.js'), scene = read('client/dungeon-scene.js');
check('to a dungeon\'s creatures, and the Delve\'s, a witch among the marks is not there', /const dungeonUnseen = \(p\) => isEvading\(p\) \|\| dungeonFinds\.sheltered\(p\);/.test(server) && /require\('\.\/lib\/dungeons'\)\(\{ players, send, isEvading: dungeonUnseen/.test(server) && /PARTY_BOSS_HP_PER_ALLY, isEvading: dungeonUnseen/.test(server));
check('the client is sent what the rare rooms are, draws the one that is there, and lets you use it', /rareRooms: require\('\.\/data\/rareRooms'\)\.RARE_ROOMS/.test(server) && /if \(msg\.rareRooms\) rareRoomCatalog = msg\.rareRooms;/.test(main) && /findId: 'rare'/.test(scene) && /f\.holder\.position\.set\(r\.x, 0, r\.y\);/.test(scene) && /f\.kiosk\.x = r \? r\.x : -99999/.test(scene) && /rare_hoard_open: 'reach into the hoard'/.test(scene));
check('each piece has a model in the manifest and on disk', ['dg_rare_marks', 'dg_rare_vault', 'dg_rare_vault_open', 'dg_rare_well'].every((k) => { const m = new RegExp(k + ": 'kk/home/([a-z_]+\\.glb)'").exec(main); return m && fs.existsSync(path.join(root, 'public/kk/home', m[1])) && new RegExp("'" + k + "'").test(scene); }));
check('the plaque tells what the rare room is, with its tier, source and note, in a dungeon and in the Delve', /function plaqueRareRoom\(\)/.test(main) && (main.match(/plaqueRareRoom\(\);/g) || []).length === 2 && /r\.tier === 'record' \? 'In the record' : 'Folk tradition'/.test(main) && /add\(r\.note/.test(main) && /rr\.icon\} \$\{rr\.name\}/.test(main));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
