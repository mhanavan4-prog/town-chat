// The witch's daybook: one page of what she has done of the things that can be
// done, each with the day it was first done and how often since. It keeps no
// state of its own beyond a small record on her account (acct.daybook), and
// reads the rest from where it already lives (acct.oldWays, acct.wanderers).
//
// Five leaves: the Old Ways (data/oldWays.js), the wanderers under the dungeons
// (data/dungeons.js), the rare rooms (data/rareRooms.js), what is done out in
// the Wilds (the balefire round, and the three old sites that keep a count of
// their own), and the doors of the Wildlands Village (data/villageHouses.js).
const { OLD_WAYS } = require('../data/oldWays');
const { DUNGEON_LORE } = require('../data/dungeons');
const { RARE_ROOMS } = require('../data/rareRooms');
const { VILLAGE_HOUSES } = require('../data/villageHouses');

// When an Old Way counts as done: the thing made, won or kept, not merely begun.
const WAY_DONE = {
  besom: (s) => !!(s.besom && s.besom.made),
  bees: (s) => !!s.bees,
  toad: (s) => !!(s.toad && s.toad.bone),
  glory: (s) => !!(s.glory && s.glory.has),
  reel: (s) => !!(s.reel && s.reel.danced),
};
// What to do about one not yet done, in a line.
const WAY_HINT = {
  besom: 'Cut the stave and the birch in the Wilds, and bind them in the town by night.',
  poppet: 'Stitch one, stuffed with a scrap of fur.',
  lead: 'Pour lead through a key, any day.',
  bees: 'Barter for a skep at the bee garth in the town.',
  brownie: 'Set cream by the hearth, and see what is done by morning.',
  sin: 'Take the bread and ale when a house sends for you.',
  toad: 'Lay a toad on an ant-hill in the Wilds, and carry the bones to running water by night.',
  hare: 'Say the charm out of doors.',
  glory: 'A man in the town sells the hand.',
  moon: 'Turn your silver out of doors on a night of the young crescent.',
  reel: 'Take hands at the Unbound Circle by night, three of you or more.',
};

module.exports = function createDaybook({ accounts, now = () => Date.now() }) {
  const bookOf = (player) => {
    const a = player && player.accountKey && accounts[player.accountKey];
    if (!a) return null;
    if (!a.daybook) a.daybook = {};
    return a.daybook;
  };
  // Write a thing down: the first day stays, the count goes up. Returns true the first time.
  function note(player, id) {
    const b = bookOf(player);
    if (!b) return false;
    const e = b[id] || (b[id] = { first: now(), times: 0 });
    e.times++;
    return e.times === 1;
  }
  // After an Old Way's button has done something: if that way now counts as done, write it down.
  function noteWay(player, way) {
    const a = player && player.accountKey && accounts[player.accountKey];
    if (!a) return false;
    const done = WAY_DONE[way] ? WAY_DONE[way](a.oldWays || {}) : true;
    if (!done) return false;
    // the made-once ways are written once; the rest count each time
    if (WAY_DONE[way] && way !== 'reel' && a.daybook && a.daybook['way:' + way]) return false;
    return note(player, 'way:' + way);
  }

  function body(player) {
    const a = player && player.accountKey && accounts[player.accountKey];
    if (!a) return { isGuest: true, leaves: [], done: 0, of: 0 };
    const b = a.daybook || {}, ow = a.oldWays || {}, wd = a.wanderers || {};
    const counted = (n) => (n > 0 ? { first: null, times: n } : null);
    const entry = (id, icon, name, hint, rec, doneNow) => {
      const done = !!(rec || doneNow);
      return { id, icon, name, done, first: rec ? rec.first || null : null, times: rec ? rec.times || 0 : 0, hint: done ? '' : hint };
    };
    const leaves = [
      { id: 'ways', title: 'The Old Ways', entries: OLD_WAYS.map((w) => entry('way:' + w.id, w.icon, w.name, WAY_HINT[w.id] || w.how, b['way:' + w.id],
        // done before the daybook was kept: it shows as done, with no day against it
        WAY_DONE[w.id] ? WAY_DONE[w.id](ow) : false)) },
      { id: 'wanderers', title: 'The wanderers', entries: [1, 2, 3, 4].map((t) => { const w = DUNGEON_LORE[t].wanderer, r = wd[w.key]; return entry('wanderer:' + w.key, '🕯️', w.name, `Some nights it walks ${DUNGEON_LORE[t].name.replace(/^The /, 'the ')}.`, r ? { first: r.firstAt, times: r.slain } : null); }) },
      { id: 'rare', title: 'Rare rooms', entries: Object.values(RARE_ROOMS).map((r) => entry('rare:' + r.id, r.icon, r.name, 'Now and then, one chamber of a dungeon or a Delve floor.', b['rare:' + r.id])) },
      { id: 'wilds', title: 'Out in the Wilds', entries: [
        entry('balefires', '🔥', 'The round of the balefires', 'Light all six in one day.', b.balefires),
        entry('road', '🛤️', 'The road north, walked', 'The gibbet, the coin tree and the coffin stone, between the portal and the village, all in one day.', b.road),
        // these three were counted on the account before the book was kept: the count is theirs, with no first day
        entry('troy', '🌀', 'Troy Town, walked to the middle', 'A turf maze in the south-east of the Wilds: walk it in to the middle.', counted(a.troyTown && a.troyTown.runs)),
        entry('crick', '🕳️', 'The Crick-stone, nine times through', 'A holed stone in the west of the Wilds: crawl through it nine times against the sun.', counted(a.menAnTol && a.menAnTol.crawls)),
        entry('countless', '🪨', 'The Countless Stones, counted', 'A ring of stones in the east of the Wilds that will not be counted the same twice. Count them.', counted(a.countless && a.countless.beaten)),
      ] },
      { id: 'village', title: 'The Wildlands Village', entries: Object.values(VILLAGE_HOUSES).map((h) => entry('house:' + h.id, h.icon, h.name, 'A door in the village in the north of the Wilds. Go in.', b['house:' + h.id])) },
    ];
    const all = leaves.flatMap((l) => l.entries);
    return { isGuest: false, leaves, done: all.filter((e) => e.done).length, of: all.length };
  }
  return { note, noteWay, body, WAY_DONE, WAY_HINT };
};
