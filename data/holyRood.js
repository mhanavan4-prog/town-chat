// ---------------------------------------------------------------------------
// Holy Rood Day, 14 September, the Exaltation of the Cross: the young went
// nutting, and the Devil was said to go nutting too. The caller is dated by
// the Commonplace Book's own entry (when: { calendar: 'holy_rood' }).
//
// Sources: W. Hone, The Every-Day Book, vol. I (1826), 14 September, after
// Brand (Grim the Collier of Croydon; the Eton manuscript of c. 1560, the day
// Hone's guess); R. Folkard, Plant Lore, Legends, and Lyrics (1884), "Nut"
// (Sussex; the nut year and the babies); Poor Robin's Almanack (1709) and
// Notes and Queries (24 February 1872), as quoted by later writers; R.
// Chambers, The Book of Days (1864), 14 September; the Woodland Trust; the
// People's Trust for Endangered Species; the Theft Act 1968, s. 4(3); the
// NHS. Left out: "a girl who goes nutting meets the Devil" before 1929, and
// the 21st of September as the Devil's day, neither found in a source.
// ---------------------------------------------------------------------------
const ROOD_RITES = {
  nutting: {
    key: 'nutting', name: 'Going a-Nutting', icon: '🌰',
    how: 'Go nutting in the hazel copse on Holy Rood Day with the young ones, taking only the nuts whose husks are pulling back, leaving plenty on the bushes, and keeping an eye on anyone too helpful with the boughs.',
    outcomes: [
      'Long Copse is thick with hazels, the husks pulling back. The bags fill, and nobody meets anyone they shouldn\'t.',
      'A stranger in a black coat holds a bough down for the girls. It is the new curate, and he blushes scarlet.',
      'Under a hazel, a nut with a neat round hole and tooth marks slanting round it. A dormouse has been here first.',
    ],
    lore: 'Brand found it in the old play Grim the Collier of Croydon: "This day, they say, is called Holy-rood day, / And all the youth are now a nutting gone" (Hone). An Eton manuscript of 1560 gave the scholars a day in September, Hone guessed this one, "to go out and gather nuts", first writing verses "on the fruitfulness of autumn, and the deadly cold of the coming winter". Poor Robin\'s Almanack (1709) has "The devil, as the common people say, / Doth go a nutting on Holy-rood day", and in 1872 a correspondent recalled a very old man at Bury St Edmunds who would not go "for fear he should meet the devil". In Sussex they said "As black as the De\'il\'s nutting bag", and that the Evil One haunts the hazels, "and sometimes appears to nutters in friendly guise, and holds down the branches for them to strip"; and in parts of England "a good Nut year always bringing an abundance of babies" (Folkard, 1884). The day itself is the Exaltation of the Holy Cross.',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book, vol. I (1826), 14 September · R. Folkard, Plant Lore, Legends, and Lyrics (1884), "Nut" · Poor Robin\'s Almanack (1709) · Notes and Queries, 4th ser., vol. IX (24 February 1872) · R. Chambers, The Book of Days (1864), 14 September',
  },
};

module.exports = { ROOD_RITES };
