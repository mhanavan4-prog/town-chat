// ---------------------------------------------------------------------------
// The Wildlands Village's buildings, opened. Each was a closed shell; now each
// has a door, one room inside, and a use:
//
//   🌾 the Tithe Barn   — a storehouse: your bank, without the walk to town
//   🗼 the Watch Tower  — a look-out over the Wilds: what is lit, what is left
//   🏚️ the Moot Hall    — a hearth to mend at, and a board of what is abroad
//
// One room each, the same shape of thing on the server (a room id, a size, a
// way in and out) and on the client (client/village-house.js draws whichever
// you are in). `door` is where you stand in the Wilds to go in, and where you
// come out; `spawn` is where you stand inside, just within the door (south).
// `spots` are the things to use inside.
// ---------------------------------------------------------------------------
const VILLAGE = { x: 5000, y: 3000 };   // the village's middle (client/wilds-scene.js VX, VZ)

const VILLAGE_HOUSES = {
  barn: {
    id: 'barn', room: 'vh_barn', icon: '🌾', name: 'The Tithe Barn',
    sign: 'The Tithe Barn — a storehouse',
    door: { x: VILLAGE.x - 720, y: VILLAGE.y + 250 }, width: 760, height: 560,
    spots: [{ id: 'store', x: 380, y: 150, label: 'the storekeeper\'s ledger', hint: 'see to what you have in store' }],
    blurb: 'A long barn, a tenth of everybody\'s harvest once. Now the village keeps what people leave with it, and the ledger is good in the town as well.',
  },
  tower: {
    id: 'tower', room: 'vh_tower', icon: '🗼', name: 'The Watch Tower',
    sign: 'The Watch Tower — a look-out',
    door: { x: VILLAGE.x - 150, y: VILLAGE.y - 420 }, width: 460, height: 460,
    spots: [{ id: 'lookout', x: 230, y: 130, label: 'the look-out', hint: 'climb to the look-out' }],
    blurb: 'A ladder goes up through three floors to an open top. From there the whole of the Wilds is laid out like a cloth.',
  },
  hall: {
    id: 'hall', room: 'vh_hall', icon: '🏚️', name: 'The Moot Hall',
    sign: 'The Moot Hall — hearth and board',
    door: { x: VILLAGE.x, y: VILLAGE.y + 265 }, width: 900, height: 620,
    spots: [
      { id: 'hearth', x: 450, y: 110, label: 'the hearth', hint: 'sit by the hearth and mend' },
      { id: 'board', x: 760, y: 300, label: 'the moot board', hint: 'read what is abroad tonight' },
    ],
    blurb: 'The village meets here. There is always a fire, and a board by the door where anybody who has seen anything chalks it up.',
  },
};
const HOUSE_BY_ROOM = Object.fromEntries(Object.values(VILLAGE_HOUSES).map((h) => [h.room, h]));
for (const h of Object.values(VILLAGE_HOUSES)) h.spawn = { x: h.width / 2, y: h.height - 90 };

const VH = {
  doorRange: 150,          // how near the door you must stand to go in
  spotRange: 120,          // …and how near a thing inside to use it
  hearthRestMs: 5 * 60 * 1000,   // the hearth mends you fully, this often
};
const isVillageRoom = (room) => typeof room === 'string' && !!HOUSE_BY_ROOM[room];

module.exports = { VILLAGE, VILLAGE_HOUSES, HOUSE_BY_ROOM, VH, isVillageRoom };
