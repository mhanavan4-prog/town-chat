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
  }
};

function titleName(id) { return (TITLES[id] && TITLES[id].name) || null; }
function titleExists(id) { return !!TITLES[id]; }

module.exports = { TITLES, titleName, titleExists };
