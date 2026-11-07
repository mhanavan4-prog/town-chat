// ---------------------------------------------------------------------------
// The Good Friday bun: bread baked on Good Friday was kept the year through,
// said never to go mouldy, hung up against fire, and grated into water as a
// cure. Good Friday moves with Easter, so its caller is dated by the
// Commonplace Book's own entry (when: { calendar: 'good_friday_bun' }).
//
// Sources: R. Chambers, The Book of Days (1864), Good Friday; W. Hone, The
// Every-Day Book (1826–27), Good Friday; Poor Robin's Almanack (1733), as
// Brewer quotes it; Pitt Rivers Museum 1981.11.2; Historic England list entry
// 1065801 (the Widow's Son, Bow). The practical half: NHS, "Diarrhoea and
// vomiting" (2023).
// ---------------------------------------------------------------------------
const GOOD_FRIDAY_RITES = {
  cross_bun: {
    key: 'cross_bun', name: 'The Good Friday Bun', icon: '🍞',
    how: 'Bake the cross buns on Good Friday morning and hang one from the kitchen beam to keep the year through. For the one who is ill, grate a little of last year\'s into a cup of water.',
    outcomes: [
      'The new bun goes up on its string beside last year\'s, hard as wood and not a speck of mould on it.',
      'You grate a pinch of the old bun into a cup of water. The child sips, makes a face, and sips again.',
      'The kitchen smells of spice. The bun is hung by the chimney: no fire in a house that has one.',
    ],
    lore: 'Bread baked on Good Friday was kept "all through the ensuing year", and "a few gratings of it in water would prove a specific for any ailment, but particularly for diarrhea" (Chambers, 1864). The buns would "not grow mouldy like the common bread" (Poor Robin\'s Almanack, 1733), and Hone saw one kept "for luck", hung from the ceiling, that "preserves the house from fire". The Pitt Rivers Museum keeps one baked before noon on Good Friday 1976, to be "Grated & mixed with a hot drink to cure colds". At the Widow\'s Son in Bow a sailor adds a bun to the net over the bar every Good Friday, for a widow whose son went to sea and never came home.',
    tier: 'record',
    source: 'R. Chambers, The Book of Days (1864), Good Friday · W. Hone, The Every-Day Book (1826–27), Good Friday · Poor Robin\'s Almanack (1733), in Brewer, Dictionary of Phrase and Fable (1895), "Bun" · Pitt Rivers Museum 1981.11.2 · Historic England, list entry 1065801 (the Widow\'s Son, Bow)',
  },
};

module.exports = { GOOD_FRIDAY_RITES };
