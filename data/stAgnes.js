// ---------------------------------------------------------------------------
// St Agnes' Eve: the night of 20 January (Aubrey dates "St. Agnes Night" the
// 21st), when girls kept St Agnes' fast and, with a row of pins and a
// Paternoster, looked to dream of the one they would marry. A caller comes on
// the 20th and the 21st only (AGNES_WHEN, by calendar date, UTC).
//
// Sources: J. Aubrey, Miscellanies (1696), as Hone quotes it (the 1696 page
// not seen, so his spelling is not given); W. Hone, The
// Every-Day Book (1826), 20 January; J. Keats, "The Eve of St. Agnes" (1820),
// st. VI; on hunger and vivid dreams, Nielsen & Powell, Frontiers in
// Psychology 6 (2015), a survey, not a trial.
// ---------------------------------------------------------------------------
const AGNES_WHEN = { month: 1, from: 20, to: 21, label: 'St Agnes\' Eve' };

const AGNES_RITES = {
  st_agnes_pins: {
    key: 'st_agnes_pins', name: "St Agnes' Pins", icon: '🕯️',
    how: 'Keep St Agnes\' fast through the day. At night take a row of pins and pull them out one after another, saying a Paternoster over each; stick one in your sleeve, and go to bed without supper.',
    outcomes: [
      'She dreams of a dark-haired lad at a fair, and wakes certain she knows which one he was.',
      'She dreams of nothing but bread and butter, and laughs about it at breakfast.',
      'A face at a window in her dream, too dim to know. She keeps the pin in her sleeve all day.',
    ],
    lore: 'St Agnes\' Eve, 20 January, was "a night of great import to maidens who desired to know who they should marry" (Hone, 1826). They kept "St. Agnes\' fast", eating nothing all day. Aubrey (1696) gives the charm, as Hone quotes it: "Upon St. Agnes\' night you take a row of pins", and pull them out one after another "saying Pater Noster, sticking a pin in your sleeve, and you will dream of him or her you shall marry." Keats made a poem of it in 1820: "They told her how, upon St. Agnes\' Eve, / Young virgins might have visions of delight", if "supperless to bed they must retire".',
    tier: 'record',
    source: 'J. Aubrey, Miscellanies (1696), as Hone quotes it · W. Hone, The Every-Day Book, vol. I (1826), 20 January · J. Keats, "The Eve of St. Agnes" (1820)',
  },
};

module.exports = { AGNES_RITES, AGNES_WHEN };
