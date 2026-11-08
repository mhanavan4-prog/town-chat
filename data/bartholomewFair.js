// ---------------------------------------------------------------------------
// Bartholomew Fair, West Smithfield, St Bartholomew's Day, 24 August (from
// 1753, 3 September): the great cloth fair, later London's rowdiest. The
// caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'bartholomew_fair' }).
//
// Sources: H. Morley, Memoirs of Bartholomew Fair (1859), read first-hand in
// the 4th edition (1892), for the charter of 1133 and the last proclamation;
// E. A. Webb, Records of St Bartholomew's Priory, vol. 1 (1921), British
// History Online, for the cloth trade, Cloth Fair and the end (second-hand,
// scholarly); Ben Jonson, Bartholomew Fair (1614; printed 1631), II.ii, read
// first-hand in the HIERONIMO transcription, and the cutpurse ballad as Hone
// quotes it (Every-Day Book, 5 September); S. Pepys, Diary, 1 and 4 September
// 1668; W. Wordsworth, The Prelude (1850), VII. For the practical half: City
// of London Police and the Metropolitan Police on pickpocketing and reporting;
// Notting Hill Carnival and RBKC on lost children at events.
//
// Put right: the old calendar entry cited Morley for "suppressed in 1855";
// Morley has the last proclamation in 1853, Webb an end in 1854, and the
// London Metropolitan Archives the last fair in 1855. It also now says the
// fair opened on 3 September from 1753. Left out: Chambers (not read); any
// police advice to use front pockets (not found in their words).
// ---------------------------------------------------------------------------
const BARTHOLOMEW_RITES = {
  bartholomew_fair: {
    key: 'bartholomew_fair', name: 'Bartholomew Fair', icon: '🎪',
    how: 'At Bartholomew-tide go to the fair in Smithfield, eat roast pig, keep your purse in your hand while the ballad-singer sings, and bring everyone home.',
    outcomes: [
      'Roast pig at a booth, and gingerbread gilt like a lord\'s coat. Pepys ate pig here and was "pretty merry".',
      'The ballad-singer sings "Youth, youth", and while the crowd sings along, a purse goes. Not yours.',
      'The mare that tells money paws out the sum, and the crowd roars. Nobody can say how she does it.',
    ],
    lore: 'Henry I\'s charter to Rahere\'s priory, dated 1133 as Morley gives it, granted "my firm peace to all persons coming to and returning from The Fair" held "at the Feast of St. Bartholomew", "on those three days, to wit, the eve of the feast, the feast itself, and the day following". In monastic times it was "the great annual market for the woollen and cloth trade of the country", hence the street called Cloth Fair (Webb, 1921). Later it was London\'s rowdiest. Jonson\'s Ursla, roasting pigs, asks "who would weare out their youth, and prime thus, in roasting of pigges, that had any cooler vocation?" (1614), and his ballad-singer sings "Youth, youth, thou hadst better been starved by thy nurse, / Than live to be hanged for cutting a purse" while his partner cuts the purses of the crowd. Pepys went in 1668, saw "the mare that tells money", and another day "did eat a pig, and was pretty merry". Wordsworth found it "anarchy and din, / Barbarian and infernal". After the calendar changed it opened on 3 September, from 1753. The City squeezed it out: Morley has it last proclaimed in 1853, and it was last held in 1855.',
    tier: 'record',
    source: 'H. Morley, Memoirs of Bartholomew Fair (1859; 4th ed. 1892) · E. A. Webb, Records of St Bartholomew\'s Priory, vol. 1 (1921) · Ben Jonson, Bartholomew Fair (1614), II.ii · W. Hone, The Every-Day Book (1826–27), 5 September · S. Pepys, Diary, 1 and 4 September 1668 · W. Wordsworth, The Prelude (1850), VII',
  },
};

module.exports = { BARTHOLOMEW_RITES };
