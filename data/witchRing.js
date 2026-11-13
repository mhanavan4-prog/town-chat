// The witches' ring in the empty west of the Ember Wastes: where the five of
// the Old Circle worked the Severance for three nights while the Order held
// the minster (data/emberTown.js, data/emberField.js). Thirteen stones; five
// places worn into the ground inside them, one for each of the five; and in
// the middle an elder, the one living green thing in the Wastes.
//
// By night each place gives that witch's voice. All five in one night and the
// elder speaks. Five people, each standing in a place at once, and the ring
// sings for all of them.
//
// The five, the ring and the Severance are the game's own story. The elder is
// borrowed from a real legend, the Rollright Stones', and its board says so.
const CX = 3000, CY = 13600;

const RING = {
  x: CX, y: CY,
  stoneR: 560, stones: 13,
  placeR: 300, range: 95,       // how near a place she must stand
  elderRange: 220,
  name: 'The witches\' ring',
  blurb: 'Thirteen stones, blackened on one side. Inside them five places are worn into the ground, and in the middle an elder grows green, the only living thing for miles.',
  radius: 1300,                 // how near before the place is named to you
  voiceXp: 10, elderXp: 80, sungXp: 150, sungGold: 30,
};

// The five places, sunways from the north. Each is where one of the five stood.
const FIVE = [
  { id: 'hazel', name: 'Hazel', angle: 0,
    says: '"I stood here. I was the youngest and I had the key, so I stood where the line from the minster comes in, and I took the whole weight of it for three nights. I did not know then that I would be the one left holding it. Nobody asked me. Nobody asks the one with the key."' },
  { id: 'morwenna', name: 'Morwenna Tarrant', angle: 1,
    says: '"The Order\'s Brother Aldo brought us bread on the second night, himself, across the open field, because none of his men would. He would not look at us. He set the basket down at the stones and said a prayer over it and went back. I have thought about that prayer for five hundred years. I think it was for us."' },
  { id: 'joan', name: 'Joan Ashby', angle: 2,
    says: '"They burned my sister in the market at Ashminster the summer before. The same men. I came anyway. Hate is a thing you can carry a long way, but you cannot work a seal with it; it slips. So I put it down at this stone, for three nights. I never did pick it back up. I was surprised."' },
  { id: 'tamsin', name: 'Tamsin Rook', angle: 3,
    says: '"We cut their marks for them, on the minster\'s door and every window, the same marks they had hanged us for cutting. The knights stood and watched us do it with their faces like boards. On the third morning one of them asked me to cut one in his helm. I did it small, on the inside, where his captain would not see."' },
  { id: 'elspet', name: 'Elspet Grey', angle: 4,
    says: '"I am the one who did not go home. When the seal took, the ground under this place opened its hand and I let it close on me, because one of us had to stay and keep the ring awake, and I was old, and tired, and fond of the place. I put my staff in the ground as I went. You will have seen what it grew into."' },
].map((w) => ({ ...w, x: Math.round(CX + RING.placeR * Math.sin(w.angle * 2 * Math.PI / 5)), y: Math.round(CY - RING.placeR * Math.cos(w.angle * 2 * Math.PI / 5)) }));

const ELDER = {
  says: 'The elder moves, though there is no wind. Five voices together, very quiet, like people talking in the next room: "It held. Tell them it held. Tell the Order we were not ashamed of them either."',
  tier: 'folk',
  lore: [
    'The Rollright Stones in Oxfordshire are a ring of weathered stones, the King\'s Men, with a single great stone, the King Stone, across the road. The story told of them is that a king marching to take England was met there by a witch, who said to him: "Seven long strides shalt thou take, and if Long Compton thou canst see, King of England thou shalt be." At the seventh stride a mound rose up and hid the village, and she turned him and his army to stone, and herself into an elder tree.',
    'The elder was still there, people said, and if it were cut on Midsummer Eve it bled, and the King Stone turned his head. On that night people gathered to cut a sprig of it. Elsewhere in England an elder was not to be cut or burned without asking it first, because there might be a witch in it.',
  ],
  source: 'Arthur J. Evans, "The Rollright Stones and their Folk-Lore", Folk-Lore 6 (1895); the "Old Lady" of the elder: Charlotte Latham, "Some West Sussex Superstitions Lingering in 1868", Folk-Lore Record 1 (1878).',
  note: 'The Rollright witch who became an elder, and the elder that bleeds when cut, are folk tradition, well recorded. Elspet Grey, and an elder that speaks for the five who sealed the Hollow, are the game\'s.',
};

const RING_LORE = {
  tier: 'story',
  lines: [
    'The five of the Old Circle worked the Severance here for three nights, while the Order held the minster at Ashminster against what came up out of the ground. Four went home and were buried in Thornreach. Hazel took the key down under the Wilds. Elspet stayed.',
    'This is the game\'s own story. By night, stand in each of the five places; by night, five of you, each in a place at once, and the ring will sing.',
  ],
};

module.exports = { RING, FIVE, ELDER, RING_LORE };
