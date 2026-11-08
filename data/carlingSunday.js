// ---------------------------------------------------------------------------
// Carling Sunday, the fifth Sunday in Lent (the second before Easter), in the
// north of England: peas steeped overnight and fried or parched in butter,
// with pepper and salt, given away and eaten in the afternoon. The caller is
// dated by the Commonplace Book's own entry (when: { calendar:
// 'carling_sunday' }), which moves with Easter.
//
// Sources: W. Turner, Herbal, pt II (1562), as the New English Dictionary
// (1893) quotes it; W. Hone, The Every-Day Book, vol. I (1826), 20 March
// (quoting Brand and The Gentleman's Magazine, 1786) and 4 August (the
// Northumberland assizes); the Older Scots dictionary, "Cair Sonday"; Notes and
// Queries (1864), as Foods of England quotes it, for the grey peas
// (second-hand); NHS East Lancashire on pulses and the NHS on choking; the
// London Fire Brigade and Merseyside Fire & Rescue on pan fires. Left out:
// the ship of peas at Shields in the siege of 1644 as history (no source
// before modern websites), pubs and rum (modern), the "Good Pas Day" variant,
// and Simpson & Roud and Hutton, which couldn't be read.
// ---------------------------------------------------------------------------
const CARLING_RITES = {
  carling_sunday: {
    key: 'carling_sunday', name: 'Carlings', icon: '🫛',
    how: 'On the second Sunday before Easter steep grey peas in water overnight, then fry them in butter with pepper and salt, and give them away hot in the afternoon, a handful to everyone who comes to the door.',
    outcomes: [
      'The peas have swelled in the crock overnight, grey and wrinkled. Into the pan they go, hissing, in a good lump of butter.',
      'Pepper and salt over them, and they go round hot in twists of paper. Every caller at the door gets a handful.',
      'By the afternoon the dish is empty and the kitchen smells of butter. Palm Sunday next, then Easter.',
    ],
    lore: 'Turner\'s Herbal of 1562 already knows "The perched or burstled peasen which ar called in Northumberland Carlines." In Brand\'s Newcastle the peas, "after having been steeped a night in water", were fried, "given away, eaten at a kind of entertainment on Carle Sunday, and are called Carlings" (as Hone gives it); in 1786 "The yeomanry in general steep peas, and afterwards parch them, and eat them on the afternoon of that day" (The Gentleman\'s Magazine). The Northumberland assizes of 1825 heard of "immense quantities of small peas, called carlings, fried in butter, pepper, and salt, on the second Sunday before Easter". The Lent Sundays went by in a rhyme: "Tid, Mid, Misera, / Carling, Palm, Paste Egg day." The name most likely comes from Care Sunday, an old name for the fifth Sunday in Lent. The tale of a ship of peas wrecked at Shields that fed starving Newcastle in the siege of 1644 is often told now, but no old source has it.',
    tier: 'record',
    source: 'W. Turner, Herbal, pt II (1562), in the New English Dictionary (1893), "Carling" · W. Hone, The Every-Day Book, vol. I (1826), 20 March and 4 August · Dictionary of the Older Scottish Tongue, "Cair Sonday"',
  },
};

module.exports = { CARLING_RITES };
