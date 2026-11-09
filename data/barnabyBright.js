// ---------------------------------------------------------------------------
// Barnaby Bright, St Barnabas's Day, 11 June: under the old calendar, the
// summer solstice itself; hay-harvest, and rose garlands in the churches. The
// caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'barnaby_bright' }).
//
// Sources: J. Ray, A Collection of English Proverbs (1678), p. 51, read
// first-hand in EEBO-TCP; E. Spenser, Epithalamion (1595), read first-hand
// (RPO, from the 1595 edition); R. Chambers, The Book of Days (1864), 11 June,
// read first-hand; W. Hone, The Every-Day Book, 11 June, and the Preface to
// vol. II (1827), quoting Plot on the clog almanacs, read first-hand; the
// churchwardens' accounts of St Mary at Hill, ed. H. Littlehales (1905), in
// British History Online; the Calendar (New Style) Act 1750. For the
// practical half: NHS, "Sunscreen and sun safety" and "Heat exhaustion and
// heatstroke".
//
// Put right: the old calendar entry said St Barnabas "fell near the old
// midsummer"; Old Midsummer Day is 24 June. Under the old calendar 11 June
// fell at the solstice itself. Left out: "put the scythe to the grass" and
// "all day and no night" (not found); "St. Barnabas, mow the grass" (one
// source only, 1892); lavender garlands (those were for Corpus Christi); a
// Barnabas thistle custom.
// ---------------------------------------------------------------------------
const BARNABY_RITES = {
  barnaby_bright: {
    key: 'barnaby_bright', name: 'Barnaby Bright', icon: '☀️',
    how: 'On St Barnabas\'s Day put the scythe to the grass, for the old clog almanacs marked the day with a rake for hay-harvest; and carry a garland of roses and woodruff to the church, as the parish of St Mary at Hill bought them in 1477–9.',
    outcomes: [
      'The scythes go into the grass at dawn. By evening the meadow lies in swathes, and still the light hardly goes.',
      'Rose and woodruff garlands for the clerks, as at St Mary at Hill, and the church smells of summer.',
      '"Barnaby bright, the longest day and the shortest night," and the haymakers are still out at ten.',
    ],
    lore: '"Barnaby bright, the longest day and the shortest night," Ray printed among the proverbs of husbandry and weather in 1678. Under the old calendar it was true: "Before the change of style, the 11th of June was the day of the summer solstice" (Chambers), and Spenser married on it: "This day the sunne is in his chiefest hight, / With Barnaby the bright" (1595). The old Staffordshire clog almanacs marked the day with "a rake on the 11th of June, St. Barnabas\'-day, importing that then it is hay-harvest" (Plot, as Hone gives him), and in London the churchwardens of St Mary at Hill paid "ffor Rose-garlondis and wodrove-garlondis on Saynt Barnebes day, xj d" (1477–9). In 1752 eleven days were dropped from the calendar, and the solstice has fallen nine or ten days after St Barnabas ever since; the saying stayed.',
    tier: 'record',
    source: 'J. Ray, A Collection of English Proverbs (1678), p. 51 · E. Spenser, Epithalamion (1595) · R. Chambers, The Book of Days (1864), 11 June · W. Hone, The Every-Day Book, vol. II (1827), Preface · St Mary at Hill churchwardens\' accounts, ed. H. Littlehales (1905) · Calendar (New Style) Act 1750',
  },
};

module.exports = { BARNABY_RITES };
