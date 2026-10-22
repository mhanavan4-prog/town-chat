// Player Titles — honorifics earned through play (coven Rites to start). An
// account accumulates earned title ids (playerProgress[key].riteTitles) and may
// set one active (playerProgress[key].activeTitle), which shows on their
// nameplate. Pure data; the server grants ids and the client renders from this
// catalog. Keep ids stable — they're persisted on accounts.
const TITLES = {
  hollow_vigil: {
    id: 'hollow_vigil', name: 'Keeper of the Hollow Vigil', glyph: '🕯️',
    desc: 'Kept the Samhain vigil and held the veil against the dead.',
    from: 'The Hollow Vigil — Samhain'
  },
  sunreturn: {
    id: 'sunreturn', name: 'Warden of the Returning Sun', glyph: '☀️',
    desc: 'Held the longest night until the new sun climbed clear.',
    from: 'The Sunreturn Vigil — Yule'
  },
  first_flame: {
    id: 'first_flame', name: "Kindler of Brigid's Flame", glyph: '🌱',
    desc: 'Purified the thaw and carried the first flame of the returning year.',
    from: "Brigid's Kindling — Imbolc"
  },
  spring_equinox: {
    id: 'spring_equinox', name: 'Herald of the Spring Equinox', glyph: '🥚',
    desc: 'Quickened the fields and kept the balance as spring broke open.',
    from: 'The Blossom Rite — Ostara'
  },
  bright_fire: {
    id: 'bright_fire', name: 'Keeper of the Bright Fire', glyph: '🔥',
    desc: 'Lit the bale-fire and guarded the thinning veil through Beltane eve.',
    from: 'The Bale-Fire Rite — Beltane'
  },
  midsummer_crown: {
    id: 'midsummer_crown', name: 'Bearer of the Midsummer Crown', glyph: '☀️',
    desc: 'Crowned the sun at its height and held the long light against the dark.',
    from: 'The Midsummer Crown — Litha'
  },
  first_harvest: {
    id: 'first_harvest', name: 'Champion of the First Harvest', glyph: '🌾',
    desc: "Reaped the first grain and proved their strength in Lugh's games.",
    from: "Lugh's Reaping — Lughnasadh"
  },
  second_harvest: {
    id: 'second_harvest', name: 'Warden of the Second Harvest', glyph: '🍂',
    desc: 'Brought in the last sheaves and released what could not last the dark.',
    from: 'The Reckoning Harvest — Mabon'
  },
  ember_warden: {
    id: 'ember_warden', name: 'Warden of the Ember Wastes', glyph: '🔥',
    desc: 'Proved themselves in open blood out on the ash flats, and walked back wearing the Wastes like a crown.',
    from: "The Ashblood Trials — the Ember Wastes"
  },
  well_read: {
    id: 'well_read', name: 'Reader of the Forbidden Shelf', glyph: '📖',
    desc: 'Read every volume the Midnight Archive keeps under lock, and carried none of them back out — only what they said.',
    from: 'The Forbidden Shelf — the Midnight Archive'
  },
  cauldron_regular: {
    id: 'cauldron_regular', name: 'Regular at the Cauldron', glyph: '☕',
    desc: 'Worked through every special Barkeep Joss ever chalked up, and has a stool that is, by now, unofficially theirs.',
    from: 'The Daily Special — the Cauldron Café'
  },
  arcade_champion: {
    id: 'arcade_champion', name: 'Champion of the Starlight Arcade', glyph: '🕹️',
    desc: 'Topped the day\'s board at the cabinets with the whole town to beat, and held the high score when the lights came up.',
    from: 'The Daily High Scores — the Starlight Arcade'
  },
  vigil_keeper: {
    id: 'vigil_keeper', name: 'Keeper of the Midnight Vigil', glyph: '🌙',
    desc: 'Sat the Parlor vigil night after night until every departed guest had spoken, and learned the courtesy of looking up.',
    from: 'The Midnight Vigil — the Phantom Parlor'
  },
  reliquary_keeper: {
    id: 'reliquary_keeper', name: 'Keeper of the Reliquary', glyph: '🗝️',
    desc: 'Stood before every relic under glass in Thornreach and read it down to the last line — and now knows which of them is listening back.',
    from: 'The Reliquary — the Arcade & the Parlor'
  }
};

function titleName(id) { return (TITLES[id] && TITLES[id].name) || null; }
function titleExists(id) { return !!TITLES[id]; }

module.exports = { TITLES, titleName, titleExists };
