// Ashminster: the town in the middle of the Ember Wastes, and the minster that
// stood through the war that made them. The place and its story are the
// game's own invention. Three real things are set in it and each says so on
// its board: the right of sanctuary, the anchorhold, and the marks cut at the
// ways into a building to keep harm out.
//
// The client draws the town from its own copy of the numbers it needs
// (EMBER_TOWN and ASH_PIECES in client/ember-scene.js); test/ember-town.test.js
// keeps the two in step.
const X = 10000, Y = 11000;

const EMBER_TOWN = {
  id: 'ashminster',
  name: 'Ashminster',
  x: X, y: Y,
  radius: 1900,           // how near the minster before the place is named to you
  blurb: 'A minster that stood through the war that made the Wastes. The tower lost its head and the nave its roof, but the east window is still in its glass.',
  // the minster model (public/kk/home/minster.glb): one model unit is this many world units, and it is turned to show its broken side to the south
  unit: 250, height: 7.5, turn: Math.PI,
  // the town's ground: nothing of the Wastes (creatures' rising-places, lava, geysers, crystals, dead trees) lies inside any of these
  ground: [{ x: X, y: Y, r: 1700 }, { x: X, y: Y + 1900, r: 1450 }, { x: X, y: Y + 2950, r: 750 }],
  // the frith: the minster's peace. No creature of the Wastes comes inside it.
  frith: 1650,
  // sanctuary, once the knocker is taken hold of: this long, while she stays inside the frith
  sanctuaryMs: 37 * 60 * 1000,
  range: 190,             // how near a thing must be stood to
};

// What stands in the town, for the client to set down: [model key, x, y, turn, size, fit].
const ASH_PIECES = [
  ['em_ash_cross', X, Y + 1950, 0, 260, 'fit'],
  ['em_house_a', X - 650, Y + 1700, 1.57, 440, 'fit'], ['em_house_b', X - 700, Y + 2250, 1.4, 400, 'fit'],
  ['em_house_c', X + 650, Y + 1700, -1.57, 470, 'fit'], ['em_house_a', X + 700, Y + 2250, -1.5, 440, 'fit'],
  ['em_house_b', X - 450, Y + 2700, 0.1, 400, 'fit'], ['em_house_c', X + 470, Y + 2700, -0.1, 470, 'fit'],
  ['em_house_a', X - 420, Y + 3200, 1.57, 440, 'fit'], ['em_house_b', X + 420, Y + 3200, -1.57, 400, 'fit'],
  ['em_house_c', X - 1000, Y + 1350, 0.4, 470, 'fit'], ['em_house_b', X + 1000, Y + 1350, -0.3, 400, 'fit'],
  ['em_house_a', X - 1350, Y + 1750, 0.8, 440, 'fit'], ['em_house_c', X + 1350, Y + 1800, -0.6, 470, 'fit'],
  ['prop_well', X + 300, Y + 2150, 0.3, 110, 'fit'],
  ['em_barricade', X, Y + 3550, 0, 420, 'fit'], ['em_barricade', X - 1050, Y + 2000, -1.57, 420, 'fit'], ['em_barricade', X + 1050, Y + 2000, 1.57, 420, 'fit'],
  // frith crosses, at the four quarters of the minster's peace
  ['em_frith_cross', X, Y + 1650, 0, 170, 'height'], ['em_frith_cross', X + 1650, Y, 1.57, 170, 'height'],
  ['em_frith_cross', X - 1650, Y, -1.57, 170, 'height'], ['em_frith_cross', X, Y - 1650, 3.14, 170, 'height'],
];

// Things to be stood at and used. Places are worked out from the minster's own plan.
const ASH_SPOTS = {
  knocker:   { x: X + 1500, y: Y + 60, name: 'the sanctuary knocker', icon: '🚪', hint: 'take hold of the sanctuary knocker' },
  anchoress: { x: X - 225, y: Y - 235, name: 'the anchoress\'s squint', icon: '🕯️', hint: 'speak at the anchoress\'s squint' },
  marks:     { x: X - 525, y: Y + 440, name: 'marks cut in the stone', icon: '✴️', hint: 'look at the marks cut by the breach' },
  frith:     { x: X + 70, y: Y + 1710, name: 'the south frith cross', icon: '✝️', hint: 'read the frith cross' },
};

const SANCTUARY = {
  tier: 'record',
  lore: [
    'From before the Conquest until the 1620s, an English church could shelter someone in flight. At Durham the fugitive took hold of the great bronze knocker on the north door. Men kept watch in a chamber over it and let him in at any hour; a bell was rung so that it was known; and he had thirty-seven days in which to make his peace, or else to confess before the coroner and swear to leave the kingdom.',
    'At Beverley and at Hexham the peace was centred on a stone seat by the altar, the frith stool. Beverley\'s reached out about a mile on every side, its edge marked by crosses, and the fine for laying hands on someone inside it rose the nearer the seat he had got. At the seat itself there was no fine that could pay for it.',
    'Henry VIII cut the right down and an Act of 1624 ended it for crime.',
  ],
  source: 'The Rites of Durham (written 1593); the Durham and Beverley sanctuary registers, printed by the Surtees Society (1837); J. Charles Cox, The Sanctuaries and Sanctuary Seekers of Mediaeval England (1911). The Act is 21 James I, c. 28.',
  note: 'The knocker, the thirty-seven days, the frith and its crosses are in the record. Thirty-seven minutes, and a peace that other players\' blades cannot break, are the game\'s.',
};

const WITCH_MARKS = {
  tier: 'record',
  lore: [
    'Cut into the stone at the edge of the breach, and again at every window and the door, are marks nobody carved for ornament: a daisy wheel of six petals drawn with compasses, two letters V laid over one another, an M, a mesh of crossed lines, and on the old door-post the long scorched tears a candle makes when it is held to wood on purpose.',
    'They are found all over England, in churches, barns and houses of roughly 1550 to 1750, and always at the ways in: doors, windows, hearths, the stair. They were put there to keep harm out. The overlaid Vs are usually read as Virgo Virginum, for the Virgin Mary. Under the floor of a room made ready for King James at Knole in 1606, the year after the Gunpowder Plot, the carpenters left a whole run of them.',
    'People now call them witches\' marks, which is the wrong way round. They were made against witches, by people who feared them.',
  ],
  source: 'Timothy Easton, on ritual marks on historic timber (from the 1970s onward); Matthew Champion, Medieval Graffiti: The Lost Voices of England\'s Churches (2015); Historic England\'s public survey of the marks (2016); the Knole marks were dated by tree-ring to 1606 (Museum of London Archaeology, 2014).',
  note: 'The marks, where they are put and what they were for are in the record. That these were cut by witches of the Old Circle for the knights who held this church, and that the creatures of the Wastes will not cross them, is the game\'s.',
};

const ANCHORESS = {
  tier: 'record',
  name: 'Dame Isolt, the anchoress',
  // what she says through the squint, a line at a time
  says: [
    '"Stand where I can see your boots. That is all of you I get, through this, and it is enough to know a great deal."',
    '"I am the ninth to keep this cell. Each of us chose the next and was walled in by her. The door was built up behind the first the week before the field burned, and there has been a lamp behind the east window every night since."',
    '"They will have told you in the town that the war was won. It was not won. It was stopped, here, at this wall, by an Order that would not run and five women the Order had been hunting the year before. The knights held the door. The witches cut the marks. Then everybody agreed to remember it differently."',
    '"I keep the lamp and I keep the marks sharp. The cat keeps me. Take hold of the knocker if you are hunted. Nobody has ever been turned from this door, whatever they were."',
  ],
  lore: [
    'An anchoress was a woman shut for life into a cell built against the wall of a church. The bishop enclosed her with a rite that borrowed from the burial service, and the door was then blocked or sealed. Her cell had a narrow window, the squint, cut through into the church so that she could see the altar, and another to the outside, hung with a curtain, at which people came to ask her advice.',
    'Julian of Norwich, who wrote the Revelations of Divine Love, was one, in a cell at St Julian\'s church from the 1390s. A rule written for three such women in the early 1200s, the Ancrene Wisse, tells them among much else that they are to keep no animal but a cat.',
  ],
  source: 'Ancrene Wisse (early 13th century); Rotha Mary Clay, The Hermits and Anchorites of England (1914).',
  note: 'The enclosure, the squint, the window to the world and the cat are in the record. Dame Isolt, and a line of nine anchoresses each walling in the next, are the game\'s.',
};

module.exports = { EMBER_TOWN, ASH_PIECES, ASH_SPOTS, SANCTUARY, WITCH_MARKS, ANCHORESS };
