// ---------------------------------------------------------------------------
// Grotto Day: Old St James's Day, 5 August. London children built little
// grottoes of oyster shells, from the taverns and fish-shops, with a candle in
// the top, and begged passers-by to "Mind the grotto!" for a penny to keep the
// candle up. St James's Day was when oysters came in, and his badge was the
// pilgrim's shell. The caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'grotto_day' }).
//
// Sources: R. Chambers, The Book of Days (1864), 25 July; W. Hone, The
// Every-Day Book, vol. II (1827), 25 July; Notes and Queries (11 October
// 1851), p. 270; The Leisure Hour (1856), as transcribed; N. Douglas, London
// Street Games (1916; 1931 ed.); the Whitstable Oyster Festival; the Sea
// Fisheries (Shellfish) Act 1967, s. 16; the Food Standards Agency; the
// London Fire Brigade. Left out: the rhyme "Father's gone to sea", found in
// no source before 1929.
// ---------------------------------------------------------------------------
const GROTTO_RITES = {
  grotto: {
    key: 'grotto', name: 'Mind the Grotto', icon: '🐚',
    how: 'Gather oyster shells from the inn and the fish stall, build them into a grotto in a quiet corner with a candle in the top, and light it at dusk on Old St James\'s Day for the children to keep.',
    outcomes: [
      '"Mind the grotto!" A carter stops his horse, laughs, and drops a penny in the cap to keep the candle up.',
      'The grotto glows in the corner by the pump, shell on shell. Half the street comes out to look at it.',
      'Rain at dusk. You build a roof of the biggest shells, and the candle burns on under it till bedtime.',
    ],
    lore: 'London children gathered the oyster shells "which have been cast out from taverns and fish-shops," and built them into grottoes: "By the time that old St. James\'s Day (the 5th of August) has come about, they have these little fabrics in nice order, with a candle stuck in the top, to be lighted at night." A passer-by heard "Mind the grotto!", "a demand for a penny wherewith professedly to keep up the candle" (Chambers, 1864). Chambers traced it to the saint: St James\'s badge, worn by pilgrims to his shrine at Compostela, "was a scallop shell worn on the cloak or hat", and in London "it is customary ... to begin eating oysters on St. James\'s Day". Hone had the old saying, "whoever eats oysters on St. James\'s day will never want money." The children\'s plea was "It is but once a year, sir!" (Notes and Queries, 1851), and in 1916 they still came up to you "and say \'Remember the grotto\'—meaning Pay up" (Douglas). Whitstable has built its grotters again, lit by candles, since the 1980s.',
    tier: 'record',
    source: 'R. Chambers, The Book of Days (1864), 25 July · W. Hone, The Every-Day Book, vol. II (1827), 25 July · Notes and Queries (11 October 1851), p. 270 · N. Douglas, London Street Games (1916; 1931 ed.) · Whitstable Oyster Festival, "Oyster grotter"',
  },
};

module.exports = { GROTTO_RITES };
