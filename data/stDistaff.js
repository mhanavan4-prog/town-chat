// ---------------------------------------------------------------------------
// St Distaff's Day, or Rock Day, 7 January, the morrow after Twelfth Day: back
// to work, but only partly; the maids take up the distaff, the men set their
// flax and tow alight, and the maids answer with pails of water. The caller
// is dated by the Commonplace Book's own entry (when: { calendar:
// 'st_distaff' }).
//
// Sources: R. Herrick, "Saint Distaffs day, or the morrow after Twelth day",
// Hesperides (1648), p. 374, read in the EEBO-TCP transcription; W. Hone, The
// Every-Day Book, vol. I (1826), 7 January, cols. 61–62; R. Chambers, The Book
// of Days (1864), 7 January; T. K. Hervey, The Book of Christmas (1836); the
// V&A on the distaff; the London Fire Brigade, South Wales and Cheshire Fire
// and Rescue on open fires and clothing alight; the HSE on textile fibres; the
// NHS on burns. Left out: Brand on Rock Day (couldn't be read), and any
// suggestion that the flax-burning is well recorded in the villages: it rests
// on Herrick alone.
// ---------------------------------------------------------------------------
const DISTAFF_RITES = {
  st_distaff: {
    key: 'st_distaff', name: "St Distaff's Day", icon: '🧶',
    how: 'On the morrow after Twelfth Day go back to work, but only partly: free the plough team early and fodder them; let the maids dress the distaff and spin; in the evening the men may set the flax and tow alight, and the maids answer them with pails of water; then bid Christmas good-night.',
    outcomes: [
      'The distaff is dressed with flax for the first time since Christmas, and the spindle turns. Partly work, partly play.',
      'A lad puts a candle to the tow, it flares, and three pails of water come back over him. Nobody is hurt but his pride.',
      'The pails are empty and the fire is out. Christmas sport is done, and tomorrow everyone to their own work.',
    ],
    lore: 'Herrick\'s "Saint Distaffs day, or the morrow after Twelth day" (1648) gives the whole of it: "Partly worke and partly play / Ye must on S. Distaffs day: / From the Plough soone free your teame; / Then come home and fother them. / If the Maides a spinning goe, / Burne the flax, and fire the tow: / Scorch their plackets, but beware / That ye singe no maiden-haire. / Bring in pailes of water then, / Let the Maides bewash the men. / Give S. Distaffe all the right, / Then bid Christmas sport good-night." St Distaff is in no calendar of saints; the day was kept, Hone wrote, "in honour of the rock, which is a distaff held in the hand", and so it was Rock Day too, and Chambers says it was named "jocularly". Hone took the flax-burning from Herrick, and hedged it: "It seems that the burning of the flax and tow belonging to the women, was the men\'s diversion in the evening of the first day of labour after the twelve days of Christmas". By 1836 Hervey doubted "if there are any remains" of the sport, and it rests, in the end, on the one poem.',
    tier: 'record',
    source: 'R. Herrick, Hesperides (1648), p. 374 · W. Hone, The Every-Day Book, vol. I (1826), 7 January, cols. 61–62 · R. Chambers, The Book of Days (1864), 7 January · T. K. Hervey, The Book of Christmas (1836)',
  },
};

module.exports = { DISTAFF_RITES };
