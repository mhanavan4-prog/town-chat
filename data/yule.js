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
    lore: 'Herrick, among his Christmas ceremonies: "Wassail the trees, that they may bear / You many a plum and many a pear: / For more or less fruits they will bring, / As you do give them wassailing." In the cider country of the West Country it was done at Twelfth Night, or on Old Twelvey Night (17 January) where the old calendar was kept. Toast soaked in cider went into the branches for the robins and cider on the roots; Hone gives the Devon toast "Here\'s to thee, old apple-tree," down to "sacks full, / And my pockets full too! Huzza!", and "Some are so superstitious as to believe, that if they neglect this custom, the trees will bear no apples that year." Pans were banged, and by 1890 "guns are often fired". Carhampton in Somerset, "a rare survivor", still wassails on the 17th with shotguns and pans, and Whimple in Devon has since its revival in 1993.',
    tier: 'record',
    source: `${HERRICK}, "Another" ("Wassail the trees…"), among his Christmas ceremonies · W. Hone, The Every-Day Book, vol. I (1826), 5 January, after the Gentleman\'s Magazine (1791) · D. & S. Lysons, Magna Britannia, vol. VI (1822), Devonshire · All the Year Round (30 August 1890), "About Cider" · West Somerset Free Press (January 2026), Carhampton · Calendar Customs, "Carhampton Wassailing"`,
  },
  firstfoot: {
    key: 'firstfoot', name: 'First-Footing', icon: '🚪',
    how: 'After the bells at midnight on Hogmanay, be the first foot over the threshold in the New Year, and do not come empty-handed: a piece of coal for the fire, salt, black bun or shortbread, and a dram.',
    outcomes: [
      'First over the step, dark-haired, coal in hand: the house cheers you in. There is no better first-foot.',
      'First, but she looks hard at your fair hair. She takes the coal anyway; the salt makes up for it.',
      'A lad beat you over the step, but empty-handed. Your coal goes on the fire, and it is your luck they keep.',
    ],
    lore: 'The first-foot was "the first to enter the house since twelve o\'clock" (Chambers, 1864), and whatever they were, the year would be. In Aberdeenshire the unlucky ones were "women generally", "those whose eyebrows met, and males who had red hair"; in Edinburgh "A dark-complexioned young man was always considered lucky, and a likely suitor" (Folk-Lore, 1893). In Aberdeenshire the first-foot must not come "empty-handed", but with shortbread, oatcakes and a whisky-bottle. In the Isle of Man the same visitor was the qualtagh, lucky "of dark complexion", and Moore believed "the superstition in Scotland is the exact reverse of this", though Edinburgh, as above, liked a dark one too.',
    tier: 'record',
    source: 'R. Chambers, The Book of Days (1864), 1 January · Folk-Lore 4 (1893), "First-footing in Aberdeenshire" and "First-footing in Edinburgh" · A. W. Moore, The Folk-Lore of the Isle of Man (1891), ch. VI, on the qualtagh',
  },
  yulelog: {
    key: 'yulelog', name: 'The Yule Log', icon: '🪵',
    how: "Bring the great log in with a noise, light it from the brand saved from last year's log, and keep a piece of it back, unburnt, to light next year's.",
    outcomes: [
      "It takes at the first touch of last year's brand and burns all night. The house will keep its luck.",
      'It hisses, damp from the woodpile, and has to be coaxed. It catches: the luck is there, but wants working for.',
      'By morning it is a sound brand. You pull it from the ashes and lay it up: the luck kept safe till next year.',
    ],
    lore: 'Herrick, "Ceremonies for Christmas": "Come, bring with a noise, / My merry, merry boys, / The Christmas log to the firing;" and "With the last year\'s brand / Light the new block, and / For good success…" In "The Ceremonies for Candlemas Day" the brand is kindled again at Candlemas, burned till sunset, then quenched and laid up "Till Christmas next return": "And where \'tis safely kept, the fiend / Can do no mischief there." Two centuries on, Chambers gives the Christmas reason: "it was believed that the preservation of last year\'s Christmas log was a most effectual security to the house against fire."',
    tier: 'record',
    source: `${HERRICK}, "Ceremonies for Christmas" and "The Ceremonies for Candlemas Day" · R. Chambers, The Book of Days (1864), 24 December`,
  },
};

module.exports = { YULE_RITES };
