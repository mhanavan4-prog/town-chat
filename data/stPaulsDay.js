// ---------------------------------------------------------------------------
// St Paul's Day, the Conversion of St Paul, 25 January: the day's weather
// foretold the year. The caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'st_pauls_day' }).
//
// Sources: T. Willsford, Natures Secrets (1658), p. 145, read first-hand in
// EEBO-TCP (A96648); W. Hone, The Every-Day Book, vol. I (1826), 25 January,
// read first-hand in the Hone archive, quoting Bourne, Bishop Hall and Gay;
// R. Chambers, The Book of Days (1864), 25 January, read first-hand, for the
// "monkish Latin verses". For the practical half: UKHSA, "Keeping warm and
// well"; NHS, "Hypothermia".
//
// Put right: the old calendar entry cited Hone for the rhyme; it is
// Willsford's, who called it what "old Wives do dream". In the rhyme mist
// kills "birds and beasts", not cattle alone. Left out: Gay's full Trivia
// passage (only Hone's two lines read); Bourne's and Brand's Latin (not
// reached); any Herrick (none found).
// ---------------------------------------------------------------------------
const PAUL_RITES = {
  st_pauls_day: {
    key: 'st_pauls_day', name: "St Paul's Day", icon: '🌤️',
    how: 'On St Paul\'s Day watch the sky and read the year by it: fair, and plenty; snow or rain, and dear grain; mist, and dead beasts; wind, and war. Then knock on your neighbour\'s door.',
    outcomes: [
      'Fair and clear by noon: a happy year, then, if the old rhyme is to be believed.',
      'Snow from first light. Dear grain this year, says the rhyme; the baker says so every year anyway.',
      'Wind in the chimney all day. "Then wars shall vex that Kingdome oft," says Granny, and bolts the door.',
    ],
    lore: 'Willsford wrote in 1658 that some "observe the 25: day of January, celebrated for the conversion of St. Paul; if fair and clear, plenty; if cloudy or misty, much cattle will die; if rain or snow fall that day, it presages a dearth; and if windy, wars, as old Wives do dream", and gave the verses for it: "If Saint Paul\'s day be fair and clear, / It does betide a happy year: / But if it chance to snow or rain / Then will be dear all kind of grain: / If clouds or mists do dark the Skie, / Great store of birds and beasts shall die: / And if the winds do fly aloft, / Then wars shall vex that Kingdome oft." Chambers traced them to "four monkish Latin verses, which are found very frequently in the manuscripts of the middle ages", beginning "Clara dies Pauli bona tempora denotat anni". Bourne could not see "why this day should therefore be a standing almanac to the world, rather than the day of any other saint", and Gay told his reader, "Let no such vulgar tales debase thy mind, / Nor Paul nor Swithin rule the clouds and wind."',
    tier: 'record',
    source: 'T. Willsford, Natures Secrets (1658), p. 145 · W. Hone, The Every-Day Book, vol. I (1826), 25 January · R. Chambers, The Book of Days (1864), 25 January',
  },
};

module.exports = { PAUL_RITES };
