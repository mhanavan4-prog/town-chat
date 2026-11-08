// ---------------------------------------------------------------------------
// St Simon and St Jude, 28 October: "deemed as rainy as St. Swithin's". The
// caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'simon_jude' }).
//
// Sources: W. Hone, The Every-Day Book, vol. II (1827), 28 October, read
// first-hand in the Hone archive transcription; T. Middleton & T. Dekker, The
// Roaring Girl (1611), I.ii and II.i, read first-hand in the Folger EMED
// transcription of the quarto (regularised spelling); R. Holinshed,
// Chronicles (1587), on Doncaster, 1536, as transcribed online (second-hand);
// M. Bush, The Pilgrimage of Grace (1996), for the dates (second-hand). For
// the practical half: GOV.UK, "What to do before or during a flood"; SEPA,
// Floodline leaflet; UKHSA on flooding and health.
//
// Put right: Holinshed gives no saint's day and calls the rain small; it was
// the Don rising that stopped the armies. The day was tied to it later (Hone,
// following Brand, it seems). The old calendar entry now says so, and quotes
// Trapdoor's whole line. Left out: the apple-peel rhyme "St Simon and St Jude,
// on you I intrude" (no period source found); Swainson and Brand (not read);
// any saying that the day ends the fine weather (not found).
// ---------------------------------------------------------------------------
const SIMON_JUDE_RITES = {
  simon_jude: {
    key: 'simon_jude', name: "Simon and Jude's Rain", icon: '☔',
    how: 'On St Simon and St Jude\'s Day look for rain, as sure as St Swithin\'s; and if the ford is up, wait on the bank, as two armies once had to by the Don.',
    outcomes: [
      'It rains, as Trapdoor swore it would, and beats every feather in the street as flat as pancakes.',
      'The ford is a brown flood by noon. Nobody crosses, and the cart waits in the yard till it falls.',
      'The rain stops by evening. The old folk say the saints were only clearing their throats.',
    ],
    lore: '"This anniversary was deemed as rainy as St. Swithin\'s," Hone wrote (1827). In The Roaring Girl (1611) Trapdoor swears by it, "As well as I know \'twill rain upon Simon and Jude\'s day next", and Jack Dapper wishes on a feather-seller "a continual Simon and Jude\'s rain" to "Beat all your feathers as flat down as pancakes". Hone tied it to 1536, when the king\'s army and the Pilgrimage of Grace faced each other at Doncaster: "on the eve of this day in 1536, when a battle was to have been fought", he says, "there fell so great a rain" that it "could not take place". The chronicle tells it otherwise, with no saint\'s day: the night before the battle "there fell a raine not great to speake of, but yet as it were by miracle, the riuer of Dun rose suddenlie" (Holinshed), and the armies talked instead. Historians put the meeting at Doncaster on 27 October; the saints\' day seems to have been fitted to the story afterwards.',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book, vol. II (1827), 28 October · T. Middleton & T. Dekker, The Roaring Girl (1611), I.ii and II.i · R. Holinshed, Chronicles (1587) · M. Bush, The Pilgrimage of Grace (1996)',
  },
};

module.exports = { SIMON_JUDE_RITES };
