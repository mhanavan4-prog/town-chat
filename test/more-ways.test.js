// Three more of the Old Ways (the hare, the Hand of Glory, the new moon's
// silver), the besom's ride, and the wanderers: a second, rarer boss in each
// dungeon. Driven with a fake clock where the module takes one, and against
// the real dungeon tick where it does not.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const D = require('../data/oldWays');
const { DUNGEON_LORE, DUNGEON_MOB_TYPES, DUNGEON_MOB_KEYS_BY_TIER } = require('../data/dungeons');
const { DUNGEON_LAYOUTS } = require('../data/dungeonLayouts');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const server = read('server.js'), main = read('client/main.js'), dung = read('lib/dungeons.js'), delve = read('lib/delve.js');

let clock = 50 * 86400000, night = false, phase = { key: 'full', startsAt: 111 }, held = [];
const accounts = { ann: {} }, bank = { ann: { balance: 100 } }, xp = { ann: 0 };
const players = new Map();
const ann = { id: 'ann', name: 'ann', accountKey: 'ann', room: 'outside', x: 1600, y: 1100, health: 60, isDead: false };
players.set('ann', ann);
const ow = require('../lib/oldWays')({
  accounts, players, getInventory: () => ({}), countItemQty: () => 0, removeItemFromAccount: () => false, addItemToAccount: () => true,
  ensureBankAccount: (k) => bank[k], grantXP: (p, n) => { xp[p.accountKey] += n; }, isNightNow: () => night,
  playerParty: new Map(), parties: new Map(), playerMaxHealth: () => 100, WORLD2: { spawn: { x: 5000, y: 9000 } }, now: () => clock,
  moonPhase: () => phase, holdCreatures: (p, range, ms) => { held.push({ room: p.room, range, ms }); return 3; },
});
const card = (id) => ow.body(ann).ways.find((w) => w.id === id);
const can = (id, action) => { const a = (card(id).actions || []).find((x) => x.id === action); return !!(a && a.enabled); };
const why = (id, action) => (card(id).actions.find((x) => x.id === action) || {}).why;

check('the three new ways say where the game leaves the record', ['hare', 'glory', 'moon'].every((id) => { const w = D.OLD_WAYS.find((x) => x.id === id); return w && /In the game/.test(w.lore) && w.source.length > 60; }));

// the hare
ann.room = 'cottage';
check('the charm is said out of doors', !can('hare', 'go') && /out of doors/.test(why('hare', 'go')));
ann.room = 'wilds';
const h1 = ow.act(ann, 'hare', 'go');
check('she goes into a hare for a minute and a half, in Gowdie\'s words', /I shall go into a hare/.test(h1.toast) && ann.activeStatus.type === 'hare' && ann.activeStatus.expiresAt === clock + D.HARE.ms && ow.isHare(ann));
check('as a hare the card offers only the way out', card('hare').actions.length === 1 && can('hare', 'back') && /You are a hare/.test(card('hare').status));
check('a blow given or taken ends it, once', ow.endHare(ann) === true && ann.activeStatus === null && ow.endHare(ann) === false && !ow.isHare(ann));
check('…and the charm will not take again for ten minutes', !can('hare', 'go') && /Not yet/.test(why('hare', 'go')));
clock += D.HARE.restMs + 1;
ow.act(ann, 'hare', 'go');
const h2 = ow.act(ann, 'hare', 'back');
check('the other verse brings her out when she chooses', /two feet/.test(h2.toast) && !ow.isHare(ann));
clock += D.HARE.restMs + 1; ow.act(ann, 'hare', 'go'); clock += D.HARE.ms + 1;
check('left alone it wears off', !ow.isHare(ann) && card('hare').actions[0].id === 'go');
check('the server ends it on a blow either way, and the client gives the hare its pace and its shape', /oldWays\.endHare\(player\)\) send\(player\.ws/.test(server) && /dmg > 0 && oldWays\.endHare\(target\)/.test(server)
  && /type === 'hare'\) speed \*= 1\.8/.test(main) && D.HARE.speed === 1.8 && /newType === 'hare'/.test(read('client/equip-visuals.js')) && /staticModel\('cr_hare'/.test(read('client/equip-visuals.js')));

check('the hare has its own mark among the things on you, and a hare does not ride the besom', /hare: \{ icon: '🐇', label: 'A hare'/.test(main) && /endHare\(player\); \/\/ a hare does not ride/.test(read('lib/oldWays.js')));

// the Hand of Glory
ann.room = 'wilds';
check('the hand is sold in the town', !can('glory', 'buy') && /in the town/.test(why('glory', 'buy')));
ann.room = 'outside'; bank.ann.balance = D.GLORY.gold - 1;
check('…for more than she has', !can('glory', 'buy') && new RegExp(D.GLORY.gold + ' gold').test(why('glory', 'buy')));
bank.ann.balance = 100;
const g1 = ow.act(ann, 'glory', 'buy');
check('she pays and has it', /do not ask/.test(g1.toast) && bank.ann.balance === 100 - D.GLORY.gold && accounts.ann.oldWays.glory.has === true);
check('it is lit underground, not in the street', !can('glory', 'light') && /underground/.test(why('glory', 'light')));
ann.room = 'dungeon_t2';
const g2 = ow.act(ann, 'glory', 'light');
check('lit, it holds what is within reach for as long as it burns', /3 creatures near you stand as if asleep/.test(g2.toast) && held.length === 1 && held[0].room === 'dungeon_t2' && held[0].range === D.GLORY.range && held[0].ms === D.GLORY.holdMs);
check('…and then wants twenty minutes', !can('glory', 'light') && /Not yet/.test(why('glory', 'light')));
clock += D.GLORY.restMs + 1; ann.room = 'dungeon_delve_7';
check('it lights on a Delve floor too', can('glory', 'light'));
check('the server holds every creature of her room within reach but never a boss', /holdCreatures: \(p, range, ms\) => \{ let n = 0; for \(const m of \[\.\.\.dungeonMobs, \.\.\.allDelveMobs\(\)\]\) if \(!m\.boss && !m\.dead && m\.room === p\.room/.test(server));

// the new moon
ann.room = 'outside'; night = true;
check('when she is not new there is nothing to turn', !can('moon', 'turn') && /Only when the moon is new/.test(why('moon', 'turn')));
phase = { key: D.MOON.phase, startsAt: 222 }; night = false;
check('the young crescent is seen after dark', !can('moon', 'turn') && /After dark/.test(why('moon', 'turn')));
night = true; ann.room = 'cottage';
check('…and never first through glass', !can('moon', 'turn') && /Never first through glass/.test(why('moon', 'turn')));
ann.room = 'outside'; bank.ann.balance = 400; const before = xp.ann;
const m1 = ow.act(ann, 'moon', 'turn');
check('she bows and turns her silver: a twentieth of what is banked', /bow to her three times/.test(m1.toast) && bank.ann.balance === 420 && xp.ann === before + D.MOON.xp);
check('once each moon', !can('moon', 'turn') && /Once each moon/.test(why('moon', 'turn')) && ow.act(ann, 'moon', 'turn').error);
phase = { key: D.MOON.phase, startsAt: 333 }; bank.ann.balance = 10;
ow.act(ann, 'moon', 'turn');
check('the next moon she may again, and a thin purse still gets the least', bank.ann.balance === 10 + D.MOON.min);
phase = { key: D.MOON.phase, startsAt: 444 }; bank.ann.balance = 100000; ow.act(ann, 'moon', 'turn');
check('a fat one gets no more than the most', bank.ann.balance === 100000 + D.MOON.max);
check('the server gives the module the real moon', /moonPhase: \(\) => moonPhaseWindow\(Date\.now\(\)\)/.test(server));

// the besom's ride
ann.flyingUntil = clock + 5000;
check('up on the besom nothing in the Wilds can reach her', ow.isCalmed(ann) === true);
ann.flyingUntil = clock - 1;
check('…and down again she is fair game', ow.isCalmed(ann) === false);
check('the server times the ride and tells her client how long it is', /player\.flyingUntil = Date\.now\(\) \+ oldWays\.D\.BESOM_RIDE_MS/.test(server) && /rideMs: oldWays\.D\.BESOM_RIDE_MS/.test(server) && D.BESOM_RIDE_MS >= 4000 && D.BESOM_RIDE_MS <= 10000);
check('her client flies the last stretch: aloft, astride, nothing sent till she is down, and no walking or reaching for things in the air',
  /function startBroomRide\(tx, ty, ms\)/.test(main) && /v\.flightY = Math\.max\(0\.01, BROOM_RIDE_ALT/.test(main) && /else if \(v\.flightY\) want = 'Sit_Chair_Idle'/.test(main)
  && /ws\.readyState === WebSocket\.OPEN && !broomRide\)/.test(main) && /const riding = stepBroomRide\(\)/.test(main) && /if \(!me \|\| broomRide\) return;/.test(main)
  && /\(v\.flightY \|\| 0\), rp\.z\); \/\/ flightY/.test(read('client/player-visuals.js')));

// the wanderers
check('each dungeon has a wanderer with its tier, its lore, its source and where the game leaves the tale', [1, 2, 3, 4].every((t) => { const w = DUNGEON_LORE[t].wanderer; return w && DUNGEON_MOB_TYPES[w.key] && DUNGEON_MOB_TYPES[w.key].name === w.name && ['record', 'folk'].includes(w.tier) && w.lore.length > 250 && w.source.length > 40 && /game/.test(w.note); }));
check('a wanderer is a boss of its dungeon\'s tier, lighter than the keeper, and not one of the rank and file', [1, 2, 3, 4].every((t) => { const w = DUNGEON_MOB_TYPES[DUNGEON_LORE[t].wanderer.key], k = DUNGEON_MOB_TYPES[DUNGEON_LORE[t].bossKey]; return w.boss && w.wanderer && w.tier === t && w.maxHealth < k.maxHealth && w.maxHealth > k.maxHealth * 0.5 && w.xp < k.xp && !DUNGEON_MOB_KEYS_BY_TIER[t].includes(DUNGEON_LORE[t].wanderer.key); }));
{
  const ps = new Map(), sent = [];
  const rooms = { 1: 'dungeon_t1', 2: 'dungeon_t2', 3: 'dungeon_t3', 4: 'dungeon_t4' };
  const dmod = require('../lib/dungeons')({ players: ps, send: (ws, m) => sent.push({ to: ws, ...m }), isEvading: () => false, absorbIncomingDamage: (_p, d) => d, noteAttacked: () => {}, DUNGEON_ROOMS: rooms, DUNGEON_SIZE: 2400, dungeonAffix: null });
  const ws = dmod.dungeonMobs.filter((m) => m.wanderer);
  check('one wanderer to a dungeon, and none of them there when the server starts', ws.length === 4 && ws.every((m) => m.dead && m.away && m.boss && dmod.wandererOf(m.room) === m));
  const w = dmod.wandererOf('dungeon_t1'), L = DUNGEON_LAYOUTS[1];
  const z = { id: 'z', room: 'dungeon_t1', x: L.entry.x, y: L.entry.y, health: 1e6, isDead: false, ws: 'z' };
  ps.set('z', z);
  w.respawnAt = Date.now() - 1; dmod.tickDungeon(0.05);
  const far = (p) => Math.hypot(w.spawnX - p.x, w.spawnY - p.y) > 500;
  check('its hour comes and it is abroad: whole, in a chamber that is neither the way in nor the keeper\'s', !w.dead && !w.away && w.health === DUNGEON_MOB_TYPES[w.mobType].maxHealth && far(L.entry) && far(L.boss) && L.chambers.some((c) => c.x === w.spawnX && c.y === w.spawnY));
  check('whoever is down there is told, by name', sent.some((m) => m.to === 'z' && m.type === 'toast' && /Rawhead-and-Bloody-Bones/.test(m.message) && /plaque/.test(m.message)));
  const home = { x: w.spawnX, y: w.spawnY };
  w.moveAt = Date.now() - 1; let moved = false;
  for (let i = 0; i < 40 && !moved; i++) { w.moveAt = Date.now() - 1; dmod.tickDungeon(0.05); moved = w.spawnX !== home.x || w.spawnY !== home.y; }
  check('left alone it goes on to another chamber', moved && !w.dead);
  z.x = w.x + 100; z.y = w.y; const here = { x: w.spawnX, y: w.spawnY };
  w.moveAt = Date.now() - 1; w.goneAt = Date.now() - 1; dmod.tickDungeon(0.05);
  check('with someone on it, it neither moves on nor slips away', !w.dead && w.spawnX === here.x && w.spawnY === here.y && w.engaged === true);
  dmod.resetDungeonRoom('dungeon_t1');
  check('emptying the dungeon does not call it back or send it off', !w.dead && w.engaged === true);
  z.x = L.entry.x; z.y = L.entry.y; w.x = w.spawnX; w.y = w.spawnY;
  w.goneAt = Date.now() - 1; dmod.tickDungeon(0.05);
  check('nobody near and its time up, it is gone for the better part of an hour', w.dead && w.away && w.respawnAt - Date.now() >= dmod.WANDERER_AWAY_MS[0] - 1000 && w.respawnAt - Date.now() <= dmod.WANDERER_AWAY_MS[1] + 1000);
  dmod.wandererAppear(w); w.dead = true; w.pendingLoot = [{ kind: 'gold', amount: 5 }]; dmod.wandererSlain(w);
  dmod.tickDungeon(0.05);
  check('killed, the body lies with its loot a while', w.dead && !w.away && w.pendingLoot.length === 1 && w.respawnAt - Date.now() >= dmod.WANDERER_AWAY_MS[0] - 1000);
  w.corpseUntil = Date.now() - 1; dmod.tickDungeon(0.05);
  check('…and then is gone from the floor', w.away && w.pendingLoot === null);
  // the Hand of Glory, in the real tick
  const rat = dmod.dungeonMobs.find((m) => !m.boss && m.room === 'dungeon_t1');
  z.x = rat.spawnX + 60; z.y = rat.spawnY; rat.x = rat.spawnX; rat.y = rat.spawnY; rat.lastHitAt = 0; z.health = 1e6;
  rat.heldUntil = Date.now() + 20000; dmod.tickDungeon(1);
  const stillHeld = rat.x === rat.spawnX && rat.y === rat.spawnY && z.health === 1e6;
  rat.heldUntil = 0; dmod.tickDungeon(1);
  check('a held creature neither moves nor strikes, and does both again when the candle is out', stillHeld && (rat.x !== rat.spawnX || z.health < 1e6));
}
check('a held creature stands on a Delve floor too', /if \(m\.heldUntil > now\) continue;/.test(delve) && /if \(m\.heldUntil > now\) continue;/.test(dung));
check('on a Delve floor with no keeper a wanderer is abroad one time in six, as a bonus boss sized to the party', /else if \(DUNGEON_LORE\[tier\]\.wanderer && Math\.random\(\) < DELVE_WANDERER_CHANCE\)/.test(delve) && /const DELVE_WANDERER_CHANCE = 1 \/ 6;/.test(delve) && /_wander`,\s+mobType: key, tier, room: run\.room, delve: run\.id, boss: true, wanderer: true, engaged: true/.test(delve) && /run\.killsNeeded = count;/.test(delve));
check('an absent wanderer is not sent to anyone, a slain one is gone a long while, and arriving while one is abroad you are told', /\.filter\(m => !m\.away\)\.map\(/.test(server) && /if \(t\.wanderer\) wandererSlain\(t\)/.test(server) && /const w = wandererOf\(room\); if \(w && !w\.dead\)/.test(server));
check('the plaque tells the wanderer\'s tale, its tier and source, and whether it is abroad', /id = 'plaqueWanderer'/.test(main) && /w\.tier === 'record' \? 'In the record' : 'Folk tradition'/.test(main) && /It is abroad down here now\./.test(main) && /add\('div', w\.note/.test(main));
check('each wanderer has a body and a name-plate', ['wander_rawhead', 'wander_church_grim', 'wander_mine_demon', 'wander_black_annis'].every((k) => new RegExp(k + ':\\s+\\{ color').test(main) && new RegExp(k + ": '").test(main)) && /wander_church_grim: \['black_dog'/.test(read('client/dungeon-mobs.js')));

// what is brought up, what the rest of us see
const cottage = read('client/cottage-scene.js'), dmobs = read('client/dungeon-mobs.js');
check('each wanderer has a keepsake of its own, with a model that is in the manifest and on disk', [1, 2, 3, 4].every((t) => { const k = DUNGEON_LORE[t].wanderer.keepsake; const m = k && new RegExp(k.model + ": 'kk/home/([a-z_]+\\.glb)'").exec(main); return k && k.name && k.text.length > 20 && m && fs.existsSync(path.join(root, 'public/kk/home', m[1])); }) && new Set([1, 2, 3, 4].map((t) => DUNGEON_LORE[t].wanderer.keepsake.model)).size === 4);
check('laying one puts it on the record of everyone alive in the room, and the first time brings up the keepsake', /if \(t\.wanderer\) noteWandererSlain\(player, t\);/.test(server) && /if \(p\.room !== killer\.room \|\| \(p\.isDead && p\.id !== killer\.id\)\) continue;/.test(server) && /rec\.slain\+\+;/.test(server) && /rec\.slain === 1\s+\? `🕯️ \$\{lore\.name\} is laid, for a while\. You bring up \$\{lore\.keepsake\.name\}/.test(server) && /sendWandererRecord\(p\);\s+\}\s+saveAccounts\(\);/.test(server));
check('the keepsakes stand on a shelf in her cottage, and the plaque keeps her count', /keepsakes: Object\.values\(DUNGEON_LORE\)\.map\(\(l\) => l\.wanderer\)\.filter\(\(w\) => w && key && accounts\[key\] && accounts\[key\]\.wanderers && accounts\[key\]\.wanderers\[w\.key\]\)\.map\(\(w\) => w\.keepsake\.model\)/.test(server) && /kkStatic\('wd_kshelf'/.test(cottage) && /k\.name = 'keepsake'/.test(cottage)
  && /msg\.type === 'wanderer_record'\) \{ wandererRecord = msg\.slain/.test(main) && /You have laid it \$\{rec\.slain === 1 \? 'once'/.test(main) && /for \(const who of \[player, \.\.\.partyMembers\]\) sendWandererRecord\(who\);/.test(server));
check('a creature held by the Hand of Glory is marked for everyone in the room', /held: m\.heldUntil > Date\.now\(\) \|\| undefined/.test(server) && /mark\.name = 'heldMark'/.test(dmobs) && /if \(mark\) mark\.visible = v\.held;/.test(dmobs));
check('others see a witch on the besom come down out of the sky to where she lands', /flying: p\.flyingUntil > Date\.now\(\) \? p\.flyingUntil - Date\.now\(\) : undefined/.test(server) && /existing\.flyDownAt = performance\.now\(\) \+ p\.flying/.test(main) && /function stepOthersOnBesoms\(\)/.test(main) && /stepOthersOnBesoms\(\);/.test(main) && /v\.otherBesom = broom/.test(main));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
