// ---------------------------------------------------------------------------
// The Wildlands Village's buildings, opened. Each was a closed shell; now each
// has a door, one room inside, and a use:
//
//   🌾 the Tithe Barn   — a storehouse: your bank, without the walk to town
//   🗼 the Watch Tower  — a look-out over the Wilds: what is lit, what is left
//   🏚️ the Moot Hall    — a hearth to mend at, and a board of what is abroad
//   🌿 the Wise-Woman's — remedies bought, your gatherings sold, and harm taken off
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
  cottage: {
    id: 'cottage', room: 'vh_cottage', icon: '🌿', name: 'The Wise-Woman\'s Cottage',
    sign: 'The Wise-Woman — remedies, and unwitching',
    door: { x: VILLAGE.x - 600, y: VILLAGE.y + 790 }, width: 520, height: 460,
    spots: [
      { id: 'wares', x: 150, y: 150, label: 'Dame Averil\'s shelf', hint: 'buy remedies, or sell what you have gathered', shop: 'npc_averil' },
      { id: 'unwitch', x: 370, y: 150, label: 'Dame Averil', hint: 'have what is on you taken off' },
      { id: 'trade', x: 260, y: 300, label: 'the hearth-side stool', hint: 'ask her about her trade' },
    ],
    blurb: 'One room, low, hung with drying herbs. People come to the back door after dark, and do not say where they have been.',
  },
};
const HOUSE_BY_ROOM = Object.fromEntries(Object.values(VILLAGE_HOUSES).map((h) => [h.room, h]));
for (const h of Object.values(VILLAGE_HOUSES)) h.spawn = { x: h.width / 2, y: h.height - 90 };

const VH = {
  doorRange: 150,          // how near the door you must stand to go in
  spotRange: 120,          // …and how near a thing inside to use it
  hearthRestMs: 5 * 60 * 1000,   // the hearth mends you fully, this often
  unwitchGold: 8,                // what the wise-woman asks for taking harm off you
  // the afflictions she can lift (server.js activeStatus types that are harms)
  harms: ['wither', 'stumble', 'shrink', 'toad', 'gibberish', 'wolfmark', 'rooted', 'reversed', 'bloodcurse', 'pumpkin'],
};
// The wise-woman's trade, as the record has it: told at her hearth, with its tier and source.
const WISE_WOMAN = {
  name: 'Dame Averil',
  tier: 'record',
  lore: [
    'Every district had one until about a hundred years ago: a cunning man or a wise woman, paid to do what the parson and the doctor could not. The historian Owen Davies reckons there were several thousand at work in England at any time between the Reformation and the First World War.',
    'Their chief business was unwitching. A client who thought herself, her child or her cow overlooked paid to have the harm found out and turned back. They also found stolen goods and lost things, told fortunes, and sold charms and remedies.',
    'It was against the law for most of that time. The Witchcraft Act of 1736 stopped the hanging of witches and made it an offence instead to pretend to such powers: a year in gaol and the pillory for anyone who undertook to tell fortunes or to find stolen goods "by any occult or crafty science". The trade went on regardless, at the back door.',
    'James Murrell of Hadleigh, who died in 1860, left a chest of his clients\' letters. He is on the Real Shelf in the town with others whose names are on record.',
  ],
  source: 'O. Davies, Cunning-Folk: Popular Magic in English History (2003); the Witchcraft Act, 9 Geo. II c. 5 (1736).',
  note: 'Dame Averil is nobody in the record; she stands for the trade. That her unwitching works every time is the game\'s: her real sisters were paid whether it did or not.',
};
const isVillageRoom = (room) => typeof room === 'string' && !!HOUSE_BY_ROOM[room];

module.exports = { VILLAGE, VILLAGE_HOUSES, HOUSE_BY_ROOM, VH, WISE_WOMAN, isVillageRoom };
