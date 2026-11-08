// ---------------------------------------------------------------------------
// St Lucy's Day, 13 December: reckoned the shortest day under the old
// calendar, "the year's midnight" (Donne), and "Lucy light, the shortest day
// and the longest night" (Ray). England wrote down no custom of its own for
// it; the crown of candles is Sweden's. The caller is dated by the
// Commonplace Book's own entry (when: { calendar: 'st_lucy' }).
//
// Sources: J. Donne, "A nocturnall upon S. Lucies day, Being the shortest
// day", Poems (1633), pp. 187–88, and J. Ray, A Collection of English
// Proverbs, 2nd edn (1678), pp. 51–52, both read in the EEBO-TCP
// transcriptions (long s modernised); W. Hone, The Every-Day Book, vol. I
// (1826), 13 December, col. 1570; G. Crump, The Christmas Encyclopedia, as
// Wikipedia quotes it, on the old solstice (second-hand); the Swedish
// Institute, "Lucia in Sweden"; the NHS on seasonal affective disorder and
// vitamin D; Greater Manchester Fire and Rescue on candles. Left out: a
// doubled "Lucy light, Lucy light" rhyme no early source gives, Chambers and
// Brand (couldn't be read), and any advice on wearing a crown of lit candles.
// ---------------------------------------------------------------------------
const LUCY_RITES = {
  st_lucy: {
    key: 'st_lucy', name: 'Lucy Light', icon: '🕯️',
    how: 'On St Lucy\'s Day, the shortest day of the old reckoning, go out while its few hours of light last; at dusk set one candle in the window, well back from the curtain, against the longest night, and say over it "Lucy light, the shortest day and the longest night."',
    outcomes: [
      'You go out at noon while the light lasts. The sun hardly clears the hedge, and it is down again by four.',
      'At dusk one candle goes in the window, well back from the curtain. Lucy light, the shortest day and the longest night.',
      'The year has passed its midnight, by the old reckoning. From here the days begin to draw out.',
    ],
    lore: 'Donne\'s "Nocturnall upon S. Lucies day, Being the shortest day" (printed 1633) opens "Tis the yeares midnight, and it is the dayes, / Lucies, who scarce seaven houres herself unmaskes, / The Sunne is spent", and ends "Both the yeares, and the dayes deep midnight is." Ray\'s proverbs (1678) set the two ends of the year side by side: "Barnaby bright, the longest day and the shortest night", and "Lucy light, the shortest day and the longest night." Under the old calendar that was nearly so; "Prior to the adoption of the Gregorian calendar in the sixteenth century, St. Lucy\'s Day fell on the winter solstice" (Crump), though by Donne\'s time the true solstice had slipped a day or two before it. England wrote down no custom of its own for the day: Hone gives only the saint, a young lady of Syracuse who "gave away all her fortune to the poor". The crown of candles is Sweden\'s, and young there too: a white-clad Lucia is first recorded in 1764, and Stockholm crowned its first in 1927.',
    tier: 'record',
    source: 'J. Donne, Poems (1633), pp. 187–88 · J. Ray, A Collection of English Proverbs (1678), pp. 51–52 · W. Hone, The Every-Day Book, vol. I (1826), 13 December, col. 1570 · Swedish Institute, "Lucia in Sweden"',
  },
};

module.exports = { LUCY_RITES };
