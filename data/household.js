// ---------------------------------------------------------------------------
// The house and the hive — household customs of the British and Irish record,
// worked as caller rites (any time of year): telling the bees, silver water for
// the evil eye, rowan and red thread on the byre, the hagstone, and the
// customs when someone is dying in the house. `how` follows the sources; the
// outcomes are the game's readings of what people looked for. Ids are stable.
//
// Sources were checked against: Chambers, Book of Days (1864); Notes and
// Queries (1851); J. G. Campbell, Witchcraft and Second Sight in the Highlands
// (1902); the Carmichael Watson papers; the Pitt Rivers Museum (1884.56.3);
// T. F. Thiselton Dyer, Domestic Folk-Lore (1881) and The Ghost World (1893).
// ---------------------------------------------------------------------------
const HOUSEHOLD_RITES = {
  telling_bees: {
    key: 'telling_bees', name: 'Telling the Bees', icon: '🐝',
    how: 'Go to every hive, knock on it with the house key, and tell the bees who has died; pin a piece of black crape to each, and ask them to the funeral.',
    outcomes: [
      'The hum rises at your knock, then settles low and steady. They have heard, and they will stay.',
      'A single bee walks out onto the crape and sits a while. The old folk would call that an answer.',
      'Nothing for a long moment; then, deep in the hive, the hum begins again. They are in mourning too.',
    ],
    lore: 'In Suffolk, Chambers wrote in 1864, people would "formally impart the fact to the bees", invite them to the funeral and "fix a piece of crape upon their hives"; bees bought at a dead man\'s sale sickened until someone put them in mourning. In Yorkshire the funeral messenger asked the bees too (1851), and in Devon in 1790 the hives were turned round as the coffin left. Untold, they would leave or die.',
    tier: 'record',
    source: 'R. Chambers, The Book of Days (1864), 7 June · Notes and Queries (25 October 1851)',
  },
  silver_water: {
    key: 'silver_water', name: 'Silver Water', icon: '🥈',
    how: 'Fill a bowl with clean water and put a silver sixpence in it. If the coin sticks to the bowl, the eye has been on the child. Sprinkle the child three times with the silver water.',
    outcomes: [
      'The sixpence slides free when you tip the bowl. No eye has been on her; it will be her teeth.',
      'The coin will not slide; it clings to the bottom. Overlooked, they say. You sprinkle her three times.',
      'The water clouds a little as the coin goes in. You sprinkle her three times, to be sure.',
    ],
    lore: 'In the Highlands a child or a cow that sickened might be "forspoken" or overlooked: harmed by a look or by too much praise. The test, as J. G. Campbell gives it: "She fills a bowl with clean water, into which she puts a silver sixpence"; if it sticks, "the child is the victim of an evil eye". In Barra the cure was to "place silver in the dish & sprinkle this 3 times".',
    tier: 'record',
    source: 'J. G. Campbell, Witchcraft and Second Sight in the Highlands (1902) · A. Carmichael, notes (John Cameron of Barra)',
  },
  rowan_thread: {
    key: 'rowan_thread', name: 'Rowan and Red Thread', icon: '🔴',
    how: 'Bind a sprig of rowan with red thread and hang it over the byre door; tie another into the cow\'s tail.',
    outcomes: [
      'The red thread shows bright against the dark wood of the door. Nothing ill will cross under it.',
      'The cow flicks her tail and the rowan stays put. She lets down her milk like a lamb.',
      'A neighbour passing sees the red thread over the door and says nothing at all, which tells you plenty.',
    ],
    lore: '"Rowan-tree and red thread / Put the witches to their speed," the Scottish rhyme ran; in the Highlands it "gars a\' the witches dance to dead". The rowan and red thread were the gentle cure. The other was a crime: "scoring above the breath", cutting the suspected witch\'s forehead to draw her blood. A man was tried for it in 1700, and a woman was cut so in 1831.',
    tier: 'record',
    source: 'Popular Science Monthly, vol. 34 (1889) · J. G. Campbell (1902) · Kelso Chronicle (10 July 1863)',
  },
  hagstone: {
    key: 'hagstone', name: 'The Hagstone', icon: '🪨',
    how: 'Find a stone with a hole worn right through it and hang it on a nail by the stable door, or over the bed, so that the hag cannot ride the horses, or you, by night.',
    outcomes: [
      'In the morning the horses are dry and calm, their manes untangled. The stone turns a little on its nail.',
      'One mare is still sweating at dawn. You hang a second stone, and a horseshoe besides.',
      'You sleep the whole night through without the weight on your chest. The stone stays.',
    ],
    lore: 'A horse found sweating and tangle-maned in the morning had been ridden in the night by the hag, the mare that also sat on sleepers\' chests. A "self-holed" stone kept her off. One hung "on a nail to the cottage-door … to keep away witches" in Dorset was collected in 1880–81 and is in the Pitt Rivers Museum. Witch balls are later: nobody called them protective in print until the 1930s.',
    tier: 'record',
    source: 'Pitt Rivers Museum, 1884.56.3 (Rushmore, 1880–81) · S. Butler, Hudibras ("sickle, horse-shoe, hollow flint")',
  },
  death_house: {
    key: 'death_house', name: 'Opening the Door', icon: '🕯️',
    how: 'When the dying are struggling, unfasten every lock and bolt and set the doors open; when they are gone, set a plate of salt on the breast, stop the clock and cover the looking-glass.',
    outcomes: [
      'You draw the last bolt and the house goes quiet. A little after, the breathing stops, easy.',
      'The door stands open to the night air. The family sit up together till morning, and the clock says nothing.',
      'The salt on its plate, the glass covered with a cloth. The house holds still, as it should.',
    ],
    lore: 'Locks and bolts were unfastened and the doors opened "so that the struggle between life and death may not be prolonged" (Thiselton Dyer, 1893). A plate of salt went on the breast; Pennant saw a wooden platter of earth and salt in Scotland in 1769. Stopping the clocks and covering the mirrors are recorded later, from the 1890s and after.',
    tier: 'record',
    source: 'T. F. Thiselton Dyer, The Ghost World (1893) and Domestic Folk-Lore (1881) · T. Pennant, A Tour in Scotland (1771)',
  },
};

module.exports = { HOUSEHOLD_RITES };
