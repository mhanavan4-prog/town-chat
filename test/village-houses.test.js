// The Wildlands Village's opened buildings (data/villageHouses.js,
// lib/villageHouses.js): the Tithe Barn, the Watch Tower and the Moot Hall.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { VILLAGE_HOUSES: H, HOUSE_BY_ROOM, VH, WISE_WOMAN, isVillageRoom } = require('../data/villageHouses');
const { WILDS_FINDS } = require('../data/wildsFinds');

let clock = 5_000_000, lit = [], used = [];
const purse = { balance: 20 };
const sent = [];
const vh = require('../lib/villageHouses')({ send: (ws, m) => sent.push({ to: ws, ...m }), playerMaxHealth: () => 100, wildsFinds: { payloadFor: () => ({ lit, used }) }, wildsData: WILDS_FINDS,
  bankOf: (pl) => (pl.guest ? null : purse),
  abroad: () => ['🕯️ Nothing is walking.', '🌒 The moon: Waxing Crescent.', '☀️ It is day.'], now: () => clock });
const mk = (extra) => ({ id: 'p', ws: 'p', room: 'wilds', x: 0, y: 0, health: 40, isDead: false, ...extra });
const last = (type) => [...sent].reverse().find((m) => m.type === type);
const said = (re) => sent.some((m) => m.type === 'toast' && re.test(m.message));

check('four buildings are open, each with a room of its own, a door, a place to stand inside and something to use', Object.keys(H).join() === 'barn,tower,hall,cottage' && Object.values(H).every((h) => h.room.startsWith('vh_') && HOUSE_BY_ROOM[h.room] === h && h.spots.length >= 1 && h.spawn.x === h.width / 2 && h.spawn.y < h.height && h.blurb.length > 40 && h.spots.every((s) => s.x > 60 && s.x < h.width - 60 && s.y > 60 && s.y < h.height - 60 && s.hint)));
check('a village room is known by its name, and nothing else is taken for one', isVillageRoom('vh_barn') && !isVillageRoom('wilds') && !isVillageRoom('vh_nowhere') && !isVillageRoom(null));
check('the doors stand apart from one another, in the village', (() => { const d = Object.values(H).map((h) => h.door); return d.every((a, i) => d.every((b, j) => i === j || Math.hypot(a.x - b.x, a.y - b.y) > 400) && Math.hypot(a.x - 5000, a.y - 3000) < 1050); })());

// in and out
const p = mk({ x: H.hall.door.x + 400, y: H.hall.door.y });
check('you must be at the door to go in', vh.enter(p, 'hall') === false && p.room === 'wilds' && said(/Go up to the door/));
p.x = H.hall.door.x; p.y = H.hall.door.y + 20;
check('at the door you go in, and stand just inside', vh.enter(p, 'hall') === true && p.room === 'vh_hall' && p.x === H.hall.spawn.x && p.y === H.hall.spawn.y && last('vh_entered').id === 'hall' && p.roomLockUntil > clock);
check('you cannot go from one house straight into another, nor in dead, nor into a house that is not there', vh.enter(p, 'barn') === false && vh.enter(mk({ isDead: true, x: H.barn.door.x, y: H.barn.door.y }), 'barn') === false && vh.enter(mk({ x: 0, y: 0 }), 'castle') === false);

// the hearth
p.x = H.hall.spots[0].x + 300; sent.length = 0; vh.use(p, 'hearth');
check('the hearth must be gone up to', p.health === 40 && said(/Go closer/));
p.x = H.hall.spots[0].x; p.y = H.hall.spots[0].y + 40; sent.length = 0; vh.use(p, 'hearth');
check('by the hearth you are made whole, with the sound of mending', p.health === 100 && last('toast').sfx === 'heal' && /whole again/.test(last('toast').message));
p.health = 30; sent.length = 0; vh.use(p, 'hearth');
check('…not again for five minutes', p.health === 30 && said(/in 5 minutes/));
clock += VH.hearthRestMs + 1; vh.use(p, 'hearth');
check('…and then again', p.health === 100);
sent.length = 0; vh.use(p, 'hearth');
check('whole already, the fire has nothing to mend and is not used up', said(/nothing wrong with you/) && p.hearthRestUntil === clock + VH.hearthRestMs);

// the board
p.x = H.hall.spots[1].x; p.y = H.hall.spots[1].y; sent.length = 0; vh.use(p, 'board');
check('the moot board says what is abroad', last('vh_board') && last('vh_board').lines.length === 3 && /moot board/.test(last('vh_board').title));
check('going out puts you at the door you came in by', vh.exit(p) === true && p.room === 'wilds' && p.x === H.hall.door.x && p.y === H.hall.door.y + 30 && last('vh_exited').id === 'hall' && vh.exit(p) === false);

// the look-out
const t = mk({ x: H.tower.door.x, y: H.tower.door.y }); vh.enter(t, 'tower');
t.x = H.tower.spots[0].x; t.y = H.tower.spots[0].y; sent.length = 0; vh.use(t, 'lookout');
const look = last('vh_board').lines;
check('from the look-out, with nothing lit, all six balefires are dark and each has a bearing', /0 of 6 balefires are lit/.test(look[0]) && (look[0].match(/to the (north|south|east|west)/g) || []).length === 6);
check('…and the cairns not yet searched are counted, with the three nearest', new RegExp(`${WILDS_FINDS.caches.length} cairns stand`).test(look[1]) && (look[1].split('The nearest:')[1].match(/to the/g) || []).length === 3);
check('…and the moon is told, but not what walks underground', look.some((l) => /^🌒/u.test(l)) && !look.some((l) => /walking/.test(l)));
lit = WILDS_FINDS.balefires.map((f) => f.id); used = WILDS_FINDS.caches.map((c) => c.id); sent.length = 0; vh.use(t, 'lookout');
check('with the round made and every cairn searched it says so', /All six balefires are burning/.test(last('vh_board').lines[0]) && /every cairn/.test(last('vh_board').lines[1]));
check('bearings read as on a map: north is up, and near and far are told apart', vh.bearing({ x: 0, y: 0 }, { x: 0, y: -500 }) === 'close by, to the north' && vh.bearing({ x: 0, y: 0 }, { x: 2000, y: 2000 }) === 'to the south-east' && vh.bearing({ x: 0, y: 0 }, { x: -4000, y: 0 }) === 'far off, to the west');
check('a thing can only be used in the house it is in', (() => { sent.length = 0; vh.use(t, 'hearth'); return sent.length === 0; })());

// wiring
const server = read('server.js'), main = read('client/main.js'), wilds = read('client/wilds-scene.js'), scene = read('client/village-house.js');
check('the server knows the rooms, their size, the way in and out, and lets the bank be opened in the barn', /Object\.keys\(require\('\.\/data\/villageHouses'\)\.HOUSE_BY_ROOM\)\.forEach\(r => ROOM_IDS\.add\(r\)\);/.test(server) && /if \(vh\) return \{ width: vh\.width, height: vh\.height \};/.test(server) && /msg\.type === 'vh_enter'\) \{ villageHouses\.enter\(player, String\(msg\.id \|\| ''\)\); return; \}/.test(server) && /msg\.type === 'vh_exit'/.test(server) && /msg\.type === 'vh_use'/.test(server) && /player\.room !== 'bank' && player\.room !== 'vh_barn'/.test(server));
check('the moot board is gathered from the wanderers, the rare rooms, the moon, the season and any reel called', /function mootBoardLines\(player\)/.test(server) && /wandererOf\(DUNGEON_ROOMS\[n\]\)/.test(server) && /dungeonFinds\.rareOf\(dungeonFinds\.placeOf\(DUNGEON_ROOMS\[n\]\)\)/.test(server) && /oldWays\.callOf\(player\)/.test(server) && /abroad: mootBoardLines/.test(server));
check('each door is in the Wilds with its name over it, and the client goes in, draws the room, and comes out', /portal: 'vh_enter', vhId: h\.id/.test(wilds) && /if \(msg\.type === 'vh_entered'\)/.test(main) && /function swapToVillageHouse\(id\)/.test(main) && /kiosk\.portal === 'vh_exit'\) \{ ws\.send\(JSON\.stringify\(\{ type: 'vh_exit' \}\)\); return; \}/.test(main) && /if \(kiosk\.vhSpot === 'store'\) openBankModal\(\);/.test(main) && /if \(isVHRoom\(me\.room\)\) return nearestKioskIn\(vhKiosks\(\), me\.x, me\.y\);/.test(main));
check('each house has its own dressing, and a way out at the south end', /house\.id === 'barn'/.test(scene) && /house\.id === 'tower'/.test(scene) && /furn_hearth/.test(scene) && /tw_board/.test(scene) && /Out to the village/.test(scene));
// the wise-woman's cottage
{
  const c = H.cottage, w = mk({ x: c.door.x, y: c.door.y });
  vh.enter(w, 'cottage');
  const at = (id) => { const sp = c.spots.find((x) => x.id === id); w.x = sp.x; w.y = sp.y; };
  check('her shelf is a shop of its own, and the server has that shop with remedies on it', c.spots.find((x) => x.id === 'wares').shop === 'npc_averil' && /npc_averil: \{ name: 'Dame Averil, the wise-woman', items: \[\s+\{ id: 'healing_potion', price: 14 \}/.test(read('server.js')));
  at('unwitch'); sent.length = 0;
  check('with nothing on you she takes no money', vh.use(w, 'unwitch') === true && said(/nothing on you but the weather/) && purse.balance === 20);
  w.activeStatus = { type: 'speedboost', expiresAt: clock + 60000 };
  check('a thing that is doing you good is not hers to take off', vh.use(w, 'unwitch') === true && w.activeStatus && purse.balance === 20);
  w.activeStatus = { type: 'bloodcurse', expiresAt: clock - 1 };
  check('nor one that has already worn off', vh.use(w, 'unwitch') === true && purse.balance === 20);
  w.activeStatus = { type: 'bloodcurse', expiresAt: clock + 60000 }; purse.balance = VH.unwitchGold - 1; sent.length = 0;
  check('harm she will lift, for her fee, and not for less', vh.use(w, 'unwitch') === true && w.activeStatus && said(new RegExp(VH.unwitchGold + ' gold to do it')) && purse.balance === VH.unwitchGold - 1);
  purse.balance = 20; sent.length = 0;
  check('paid, she takes it off, and the server is told to save the purse', vh.use(w, 'unwitch') === 'paid' && w.activeStatus === null && purse.balance === 20 - VH.unwitchGold && said(/goes out of the room like a draught/) && /villageHouses\.use\(player, String\(msg\.spot \|\| ''\)\) === 'paid'\) saveBankAccounts\(\);/.test(read('server.js')));
  const g = mk({ x: c.door.x, y: c.door.y, guest: true }); vh.enter(g, 'cottage'); g.x = w.x; g.y = w.y; g.activeStatus = { type: 'stumble', expiresAt: clock + 60000 }; sent.length = 0;
  check('a guest has nothing to pay her with', vh.use(g, 'unwitch') === true && g.activeStatus && said(/no name to put it to/));
  check('every harm the game can lay on you is on her list, and nothing that helps', ['wither', 'stumble', 'shrink', 'toad', 'gibberish', 'wolfmark', 'rooted', 'reversed', 'bloodcurse', 'pumpkin'].every((k) => VH.harms.includes(k) && new RegExp(k + ": \\{ icon: '[^']+', label: '[^']+', debuff: true").test(read('client/main.js'))) && !VH.harms.includes('speedboost') && !VH.harms.includes('hare'));
  at('trade'); sent.length = 0; vh.use(w, 'trade');
  const b = last('vh_board');
  check('at her hearth she tells her trade: its tier, the Act of 1736, her source, and where the game leaves the record', b && /on her trade/.test(b.title) && b.epithet === 'In the record' && b.lines.some((l) => /Witchcraft Act of 1736/.test(l)) && b.lines.some((l) => /^Source: O\. Davies/.test(l)) && /the game's/.test(b.lines[b.lines.length - 1]) && WISE_WOMAN.tier === 'record');
  check('the client opens her shelf as a shop, and draws her room', /else if \(kiosk\.vhShop\) ws\.send\(JSON\.stringify\(\{ type: 'npc_shop_open', npcId: kiosk\.vhShop \}\)\);/.test(read('client/main.js')) && /vhShop: s\.shop \|\| null/.test(read('client/main.js')) && /house\.id === 'cottage'/.test(read('client/village-house.js')));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
