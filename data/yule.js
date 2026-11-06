// ---------------------------------------------------------------------------
// Yule rites — the customs of the midwinter season, from the solstice through
// Hogmanay and Twelfth Night.
//
// Three of the best-recorded British ones:
//   • wassailing the apple trees (Herrick, 1648; West Country records into
//     the 19th century and still kept),
//   • first-footing at Hogmanay (Scotland and the north of England; the Manx
//     qualtagh),
//   • the Yule log, lit from last year's brand (Herrick's two poems).
// As with the Hallowe'en rites, `how` follows the sources; the outcomes are
// the game's readings of the signs people looked for.
//
// They are worked as a caller step ('rite'), and the callers who bring them
// come to the door only in the Yule season.
// ---------------------------------------------------------------------------
const HERRICK = 'Robert Herrick, Hesperides (1648)';

const YULE_RITES = {
  wassail: {
    key: 'wassail', name: 'Wassailing the Orchard', icon: '🍏',
    how: 'At the oldest tree in the orchard: pour cider on its roots, lay cider-soaked toast in its fork for the robins, sing to it, and make all the noise you can.',
    outcomes: [
      'A robin drops to the toast before the song is done. The good spirits of the tree are fed; it will bear.',
      'Nothing stirs but the frost. A quiet tree, they say, is only resting; it will bear next year if not this.',
      'The din sends every rook out of the elms. Whatever was lurking in the orchard is gone now.',
    ],
    lore: 'Herrick, among his Christmas ceremonies: "Wassail the trees, that they may bear / You many a plum, and many a pear: / For more or less fruits they will bring, / As you do give them wassailing." In the cider country of the West Country it was done at Twelfth Night, or on Old Twelvey Night (17 January) where the old calendar was kept. Toast soaked in cider went into the branches for the robins, cider went on the roots, and guns and pans were let off to frighten away anything ill. Devon verses sung to the tree ended "Hats full! caps full!" Carhampton in Somerset and Whimple in Devon still wassail on the 17th.',
    tier: 'record',
    source: `${HERRICK}, "Another" ("Wassail the trees…"), among his Christmas ceremonies · 19th-century Devon and Somerset wassail records`,
  },
  firstfoot: {
    key: 'firstfoot', name: 'First-Footing', icon: '🚪',
    how: 'After the bells at midnight on Hogmanay, be the first foot over the threshold in the New Year, and do not come empty-handed: a piece of coal for the fire, salt, black bun or shortbread, and a dram.',
    outcomes: [
      'First over the step, dark-haired, coal in hand: the house cheers you in. There is no better first-foot.',
      'First, but she looks hard at your fair hair. She takes the coal anyway; the salt makes up for it.',
      'A lad beat you over the step, but empty-handed. Your coal goes on the fire, and it is your luck they keep.',
    ],
    lore: 'The first-foot was the first person to cross the threshold after midnight, and whatever they were, the year would be. A tall, dark-haired man was best; a woman, or a red- or fair-haired man, was unlucky in most places (East Yorkshire wanted dark, the North York Moors fair). The first-foot must not come empty: coal for warmth, salt, shortbread or black bun for food, and whisky to toast the house. In the Isle of Man the same visitor was the qualtagh, and dark was luckier there too.',
    tier: 'record',
    source: 'J. Simpson & S. Roud, A Dictionary of English Folklore (2000), "first-foot" · A. W. Moore, The Folk-Lore of the Isle of Man (1891), on the qualtagh',
  },
  yulelog: {
    key: 'yulelog', name: 'The Yule Log', icon: '🪵',
    how: "Bring the great log in with a noise, light it from the brand saved from last year's log, and keep a piece of it back, unburnt, to light next year's.",
    outcomes: [
      "It takes at the first touch of last year's brand and burns all night. The house will keep its luck.",
      'It hisses, damp from the woodpile, and has to be coaxed. It catches: the luck is there, but wants working for.',
      'By morning it is a sound brand. You pull it from the ashes and lay it up: the luck kept safe till next year.',
    ],
    lore: 'Herrick, "Ceremonies for Christmas": "Come, bring with a noise, / My merry, merry boys, / The Christmas Log to the firing," and "With the last year\'s brand / Light the new block." In "The Ceremonies for Candlemas Day" the brand is kindled again at Candlemas, burned till sunset, then quenched and laid up "Till Christmas next return": "And where \'tis safely kept, the fiend / Can do no mischief there." Herrick\'s poems are the classic early English account of the custom.',
    tier: 'record',
    source: `${HERRICK}, "Ceremonies for Christmas" and "The Ceremonies for Candlemas Day"`,
  },
};

module.exports = { YULE_RITES };
