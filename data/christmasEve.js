// ---------------------------------------------------------------------------
// Christmas Eve: the oxen kneel at midnight, and the bees hum in their hives.
// In Devon and Cornwall the oxen were said to go down on their knees in their
// stalls at twelve on Christmas Eve; in Yorkshire people sat up by the hives
// to hear the bees hum. After the calendar changed in 1752, many said it
// happened only on Old Christmas Eve. The caller is dated by the Commonplace
// Book's own entry (when: { calendar: 'oxen_kneel' }).
//
// Sources: J. Brand's notes, ed. H. Ellis (1813), as W. Hone reprints them in
// The Every-Day Book, 24 December (Brand's own page not seen); R. Hunt,
// Popular Romances of the West of England (1865); P. H. Ditchfield, Old
// English Customs Extant at the Present Time (1896), p. 52; the Gentleman's
// Magazine (January 1753), as W. C. Hazlitt quotes it in Faith and Folklore
// (1905); T. Hardy, "The Oxen" (The Times, 24 December 1915; Moments of
// Vision, 1917), quoted only in lines the two printings share. The bees are
// said to hum: no source seen says sing.
// ---------------------------------------------------------------------------
const CHRISTMAS_EVE_RITES = {
  midnight_oxen: {
    key: 'midnight_oxen', name: 'The Oxen Kneel', icon: '🐂',
    how: 'Sit up in the shippon with a lantern on Christmas Eve, and at twelve o\'clock watch the oldest beasts in their stalls; then go down the garden and put your ear to the hives.',
    outcomes: [
      'Twelve strikes from the church. The old ox shifts and folds one knee into the straw. Knelt? You couldn\'t swear to it.',
      'Nothing kneels. But at the hives, with your ear to the wood, there is a hum, low and steady, as there is all winter.',
      'At twelve the old man beside you says, very quietly, "Now they are all on their knees." You don\'t look. Neither does he.',
    ],
    lore: 'Brand recorded a notion in the western parts of Devonshire that "at twelve o\'clock at night on Christmas-eve, the oxen in their stalls are always found on their knees, as in an attitude of devotion", and that since the change of the calendar they did it only on Old Christmas Eve. A countryman by Launceston told him in 1790 that he and others had watched, and the two oldest oxen fell on their knees and made "a cruel moan like christian creatures". Brand thought the notion came from old prints of the Nativity with the oxen kneeling. Robert Hunt was told the same as a child, of a farm in St Germans. In Yorkshire people sat up "watching the beehives on the new and old Christmas Eve" for "the humming noise which they suppose the bees will make" (Ditchfield, 1896). When the calendar changed, the new day was put to the test. At Quainton in Buckinghamshire, the Gentleman\'s Magazine reported in January 1753, "Above two thousand people came here this night with lanthorns and candles" to see a blackthorn said to be a slip of the Glastonbury Thorn blow. It did not, so they agreed that "Dec. 25th, N.S. could not be the right Christmas Day", and the ministers gave notice that "the old Christmas Day should be kept holy as before". Thomas Hardy wrote it down in 1915, as something an elder said by the fire: "Christmas Eve, and twelve of the clock. / \'Now they are all on their knees,\'" He ended, "Hoping it might be so."',
    tier: 'record',
    source: 'J. Brand, Observations on Popular Antiquities, ed. H. Ellis (1813), quoted in W. Hone, The Every-Day Book, 24 December · R. Hunt, Popular Romances of the West of England (1865) · P. H. Ditchfield, Old English Customs Extant at the Present Time (1896), p. 52 · The Gentleman\'s Magazine (January 1753), in W. C. Hazlitt, Faith and Folklore (1905) · T. Hardy, "The Oxen" (1915)',
  },
};

module.exports = { CHRISTMAS_EVE_RITES };
