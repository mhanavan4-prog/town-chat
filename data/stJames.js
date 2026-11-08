// ---------------------------------------------------------------------------
// St James's Day, 25 July: the first, dear oysters, and the children's shell
// grottoes. The caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'st_james' }).
//
// Sources: R. Chambers, The Book of Days (1864), 25 July, read first-hand
// online; W. Hone, The Every-Day Book, vol. I (1826), col. 978, and vol. II
// (1827), 5 August, read first-hand in the Project Gutenberg texts; H. Buttes,
// Dyets Dry Dinner (1599), read first-hand in EEBO-TCP. For the practical
// half: the Food Standards Agency (as Southwark Council gives its advice, and
// its shellfish classification); NHS 111 Wales and nidirect on norovirus and
// on cuts.
//
// Put right: the old calendar entry said London ate its first oysters on
// 25 July; Hone corrects himself in 1827 ("It is on this day, and not on
// St. James's day new style"), so the entry now gives Old St James's Day,
// 5 August, too. The "R" rule is Buttes's (1599), not William Butler's.
// Left out: "Please remember the grotto" and the "Father's gone to sea"
// rhyme (later, or second-hand only); Murray's 1588 (not traced); which Act
// of Parliament Hone meant.
// ---------------------------------------------------------------------------
const JAMES_RITES = {
  st_james: {
    key: 'st_james', name: 'The First Oysters', icon: '🦪',
    how: 'At St James\'s tide eat the first oysters of the season for luck, and give the grotto-builders a penny for their candle.',
    outcomes: [
      'The first oysters of the year, dear as they are. Whoever eats them today, they say, will never want money.',
      'A cone of oyster shells in the court, a candle on top. "Mind the grotto!" A penny goes in the cap.',
      'Somebody says it\'s no month with an R in it. Somebody else says that\'s what the pot is for.',
    ],
    lore: '"Whoever eats oysters on St. James\'s Day, will never want money," the proverb ran, and Chambers (1864) explains it: "it is customary in London to begin eating oysters on St. James\'s Day, when they are necessarily somewhat dearer than afterwards", so the saying is "only meant as a jocular encouragement to a little piece of extravagance". Hone called it "a vulgar superstition" (1826), then put himself right a year later: "It is on this day, and not on St. James\'s day new style", Old St James\'s Day, 5 August, "that oysters come in". By then the children had built their grottoes of the cast-off shells, "with a candle stuck in the top", and the stranger would hear "a whining claim—\'Mind the grotto!\'" for a penny (Chambers); "A grotto comes but once a year!" ran a rhyme in Hone. The shell was St James\'s own: his pilgrims wore "a scallop shell worn on the cloak or hat". The rule against oysters in months without an R is Henry Buttes\'s, in 1599: "It is vnseasonable and vnholesome in all monethes, that haue not the letter R. in their name". July has none.',
    tier: 'record',
    source: 'R. Chambers, The Book of Days (1864), 25 July · W. Hone, The Every-Day Book, vol. I (1826), 25 July, and vol. II (1827), 5 August · H. Buttes, Dyets Dry Dinner (1599), "Oyster"',
  },
};

module.exports = { JAMES_RITES };
