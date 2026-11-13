// The field: the Ember Wastes between their places. A worn track runs from
// the arrival portal to Ashminster and out from it to each landmark (and west
// to the witches' ring), with a fingerpost at each fork and waymarker stones
// along it; and along the track lie twelve things left by the war Dame Isolt
// tells of (data/emberTown.js). Each can be searched once a day, and gives up
// a piece of what happened. Finding all twelve is "walking the field".
//
// The story is the game's own. Two of the twelve are things that are in the
// record (a witch-bottle; rowan and red thread), and those say so, with their
// sources, and say where the game goes beyond them.

// The track, as runs of points. The client draws it; the finds lie along it.
const TRACK = [
  { id: 'south', to: 'Ashminster', pts: [[10000, 18350], [9900, 16800], [10100, 15200], [10000, 14400]] },
  { id: 'north', to: 'the Cinder Bazaar', pts: [[10000, 9300], [10200, 7500], [9800, 5600], [10000, 4300]] },
  { id: 'west', to: 'Charhold Keep', pts: [[8300, 10900], [7200, 9600], [6200, 7900], [5800, 7300]] },
  { id: 'east', to: 'the Great Ossuary', pts: [[11700, 10800], [12900, 9900], [13900, 8900]] },
  { id: 'southeast', to: 'Emberfall Caldera', pts: [[10500, 18250], [12800, 17600], [14700, 16700], [15300, 16300]] },
  { id: 'ring', to: 'the witches\' ring', pts: [[8300, 11200], [6500, 12100], [4800, 12800], [3950, 13200]] },
];

// Fingerposts where the track forks, and what their arms say.
const POSTS = [
  { x: 10260, y: 18200, arms: ['Ashminster ↑', 'Emberfall ↗'] },
  { x: 10180, y: 14420, arms: ['Ashminster ↑', 'the portal ↓'] },
  { x: 8250, y: 11050, arms: ['Charhold ↖', 'the witches\' ring ←'] },
  { x: 10180, y: 9250, arms: ['the Cinder Bazaar ↑'] },
  { x: 11750, y: 10950, arms: ['the Great Ossuary ↗'] },
];

const FIELD = {
  range: 170,
  gold: 4, xp: 12, firstXp: 25,          // each find, each day; and the first time ever
  allGold: 120, allTitle: 'field_walker', // all twelve, ever
};

// The twelve. model: a key the client knows; size in world units; turn in radians.
const FINDS = [
  { id: 'standard_south', name: 'A fallen standard', icon: '🚩', model: 'em_standard', x: 9720, y: 16150, size: 200, turn: 0.4,
    hint: 'search the fallen standard',
    says: 'The pole was snapped by a blow, not burnt through. Wound tight round the stump, under the rag of the banner, is a strip of linen with a line written on it in a careful hand: "Third night. They are still singing inside. We hold till they stop."' },
  { id: 'bell', name: 'A cracked bell', icon: '🔔', model: 'em_bell', x: 10260, y: 15150, size: 90, turn: 0.5,
    hint: 'look at the cracked bell',
    says: 'A hand-bell, the kind a priest carries before the dead, split down one side and half buried. Scratched inside the lip is the name of a field chapel to the east and a date nobody now keeps. Somebody rang it for every one carried in, until there were too many to carry.' },
  { id: 'barrow_north', name: 'A knight\'s barrow', icon: '⚱️', model: 'em_barrow', x: 9600, y: 5000, size: 280, turn: 1.2,
    hint: 'kneel at the barrow',
    says: 'One of the few that was buried. The sword at its head is good steel and nobody has taken it, which out here says more than any stone. The helm hung on the hilt has a daisy wheel scratched inside the brow, small, where only the wearer would see it.' },
  { id: 'trench_north', name: 'A siege trench', icon: '⛏️', model: 'em_trench', x: 10350, y: 6650, size: 330, turn: -0.2,
    hint: 'climb down into the trench',
    says: 'The Order dug this facing north, toward the Bazaar, to hold whatever was coming down that road off the minster. The stakes lean out still. In the bottom, under the ash, the ground is scored with the same marks as the minster\'s door, cut with a knife-point, again and again, the whole length of it.' },
  { id: 'barrow_west', name: 'A knight\'s barrow', icon: '⚱️', model: 'em_barrow', x: 6950, y: 9150, size: 280, turn: -0.6,
    hint: 'kneel at the barrow',
    says: 'Two buried together, by the size of it. On the kerb-stone at its head someone has cut two names and, between them, a little hand. The Order did not mark its graves with hands. The witches did.' },
  { id: 'stakes_west', name: 'The last line of stakes', icon: '⛏️', model: 'em_trench', x: 5950, y: 7650, size: 330, turn: 0.9,
    hint: 'walk the line of stakes',
    says: 'The furthest the Order got toward Charhold, and no further. The stakes here face the wrong way, back toward the minster, as if the men who drove them had been told to stop anything leaving rather than anything coming in.' },
  { id: 'standard_east', name: 'A fallen standard', icon: '🚩', model: 'em_standard', x: 12650, y: 10300, size: 200, turn: -1.1,
    hint: 'search the fallen standard',
    says: 'Wrapped round this one is a page torn from a book of hours, and on the back of it, in the same careful hand as the other: "Grand Master says no witch is to be named in the chronicle. Brother Aldo says he will name them himself if it costs him his spurs. It will."' },
  { id: 'long_grave', name: 'The long grave', icon: '🪦', model: 'em_barrow', x: 13550, y: 9350, size: 520, turn: 0.6,
    hint: 'stand at the long grave',
    says: 'A mound three barrows long, with no stones on it at all. Nobody knows who is in it. Dame Isolt says the anchoress before her used to say the office for it every night, by name, and would not tell anyone the names.' },
  { id: 'chapel', name: 'The field chapel', icon: '⛪', model: 'em_chapel', x: 13350, y: 17450, size: 380, turn: 0.3,
    hint: 'go into the field chapel',
    says: 'Where the wounded were brought. The altar stone is still there, cracked through. Under it, pushed into the gap, are five hairpins of black horn laid side by side, and a knight\'s glove.' },
  { id: 'wagons', name: 'The Order\'s baggage', icon: '🛞', model: 'em_barricade', x: 14350, y: 16850, size: 380, turn: 1.8,
    hint: 'search the burnt wagons',
    says: 'The Order\'s baggage train, overturned and burnt where it stood. The chests were carried off long ago but the ledger was too heavy to bother with. Its last entry is a bill: five women, fed and lodged three nights at the Order\'s expense, "by command." The command is signed and the signature is scratched out.' },
  { id: 'bottle', name: 'A witch-bottle at the crossroads', icon: '🏺', model: 'em_bottle', x: 6050, y: 12350, size: 160, turn: 2.2,
    hint: 'look at the witch-bottle', tier: 'record',
    says: 'A stoneware jug with a bearded face on its neck, stoppered and buried where the track to the ring crosses an older road. Somebody has dug it half out and then, it seems, thought better of it.',
    lore: [
      'A witch-bottle was a jug, very often a brown stoneware "Bellarmine" with a bearded mask on its neck, filled with the urine of the bewitched together with bent pins or iron nails, hair and nail-clippings, then stoppered and buried, usually under the hearth or the threshold of the house. It was meant to turn the spell back on the witch who cast it, who would suffer until she lifted it.',
      'Joseph Blagrave gave a recipe for one in 1671. They turn up in England from the 1500s on, a couple of hundred of them so far. One found sealed at Greenwich in 2004 still held its contents: urine, bent nails and pins, a nail driven through a little leather heart, hair, and nail-parings.',
    ],
    source: 'Joseph Blagrave, Astrological Practice of Physick (1671); Ralph Merrifield, The Archaeology of Ritual and Magic (1987); Alan Massey and colleagues on the Greenwich witch-bottle (2009).',
    note: 'The witch-bottle and what went into it are in the record. They were made against witches; one buried by witches, at a crossroads on this field, to turn something back on the Hollow, is the game\'s.' },
  { id: 'rowan', name: 'Rowan and red thread', icon: '🧶', model: 'em_rowan', x: 4650, y: 12980, size: 130, turn: 0.2,
    hint: 'look at what is tied to the post', tier: 'folk',
    says: 'Tied to a charred post at the side of the track: a little cross of rowan twigs, bound with red thread, so old the thread has gone brown. The track beyond it runs west to the ring.',
    lore: [
      'Rowan and red thread together were one of the commonest protections against witchcraft in Scotland and the north of England: a sprig of rowan tied with red thread over the byre door or round a cow\'s horn, or a little equal-armed cross of rowan bound with red thread sewn into a coat or carried. A Scottish rhyme recorded in the nineteenth century paired the two as what made witches lose their power.',
      'Rowan was cut on particular days (in parts of Scotland at Beltane, the beginning of May) and without a knife.',
    ],
    source: 'Robert Chambers, Popular Rhymes of Scotland (1826, enlarged editions to 1870); James Napier, Folk Lore: or, Superstitious Beliefs in the West of Scotland (1879); F. Marian McNeill, The Silver Bough (1957–68).',
    note: 'Rowan and red thread against witchcraft are folk tradition, well recorded. Witches using it themselves, to mark the way to their own ring, is the game\'s.' },
];

const FINDS_BY_ID = Object.fromEntries(FINDS.map((f) => [f.id, f]));

module.exports = { TRACK, POSTS, FIELD, FINDS, FINDS_BY_ID };
