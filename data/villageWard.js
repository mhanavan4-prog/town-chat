// The bound fires of the Wildlands Village: four stones at the edge of its
// ground, each with an iron cresset. By night, fire carried to all four in the
// sun's order (east, south, west, north) closes a round, and until dawn the
// night creatures of the Wilds will not come inside it. Anyone may carry the
// fire on from where another left it.
const { VILLAGE } = require('./villageHouses');

const R = 1400;   // the round: clear of every house in the village, short of the coffin stone on the road south

const WARD = {
  tier: 'record',
  centre: { x: VILLAGE.x, y: VILLAGE.y },
  radius: R,
  range: 150,        // how near a stone you must stand
  // in the sun's order. (North is up the map, so east is +x and south is +y.)
  stones: [
    { id: 'east', name: 'the east bound stone', x: VILLAGE.x + R, y: VILLAGE.y },
    { id: 'south', name: 'the south bound stone', x: VILLAGE.x, y: VILLAGE.y + R },
    { id: 'west', name: 'the west bound stone', x: VILLAGE.x - R, y: VILLAGE.y },
    { id: 'north', name: 'the north bound stone', x: VILLAGE.x, y: VILLAGE.y - R },
  ],
  model: 'wd_boundstone', size: 150,
  eachXp: 15,        // for each stone you light
  roundXp: 50,       // to everyone who lit one, when the round closes
  lore: [
    'Martin Martin, travelling the Western Isles in the 1690s, found that people there still made what they called the dessil: a round, carrying fire in the right hand, always the way the sun goes. It was made about houses, corn and cattle to keep them from harm, and about a woman after childbirth and a child before it was christened, to keep off evil spirits that might otherwise carry the child away.',
    'The direction was the whole of it. Sunways (deiseil, from the Gaelic for the right hand, the south) was lucky and was how you went round a well, a boat, a house or a grave. The other way, against the sun, was widdershins or tuathal, and was how a witch was said to go round a thing to harm it.',
    'In England the parish went round its own edge once a year at Rogationtide, beating the bounds: the priest and the old men walked the boundary with wands, stopped at every stone and marked tree, and saw to it that the boys remembered where each one was.',
  ],
  source: 'Martin Martin, A Description of the Western Islands of Scotland (1703), on the dessil and the fire-round; the Rogationtide perambulation is described in John Brand, Observations on Popular Antiquities (1777; enlarged by Henry Ellis, 1813).',
  note: 'The round with fire, sunways, to keep a place from harm is in the record. Four stones with fire-baskets round this village, and night creatures that will not cross between them until dawn, are the game\'s.',
};

module.exports = { WARD };
