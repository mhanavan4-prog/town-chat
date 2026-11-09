// ---------------------------------------------------------------------------
// Shrove Tuesday, the day before Lent (Easter less 47 days): the bell rung to
// call the parish to confession became the Pancake Bell; the day was for
// pancakes, football and, before it was put down, throwing at cocks; and in
// Dorset and Wiltshire children went "a-shrovin" for food, with crocks thrown
// at the door of anyone who gave nothing ("Lent crocking"). The caller is
// dated by the Commonplace Book's own entry (when: { calendar:
// 'shrove_tuesday' }), so the day moves with Easter.
//
// Sources: W. Hone, The Every-Day Book (1826), 15 February, quoting the
// Gentleman's Magazine (1790); J. Taylor, Jack-a-Lent (1617?; the 1630 text as
// T. S. Knowlson quotes it, 1910); R. Chambers, The Book of Days (1864), the
// shroving rhyme and Lent crocking; the Gentleman's Magazine (1737) and the
// Leeds death of 1783, as Knowlson gives them; Ashbourne's Royal Shrovetide
// Football and the Olney pancake race (its 1445 is tradition). Left out: the
// "When Jack went to plough" rhyme, found in no old source; and any claim
// that the 1835 Act banned cock-throwing by name, which it doesn't.
// ---------------------------------------------------------------------------
const SHROVE_RITES = {
  shroving: {
    key: 'shroving', name: 'A-Shrovin\'', icon: '🥞',
    how: 'When the Pancake Bell rings, fry the pancakes; then go round the doors with the children singing for a bit of bread or bacon or a dough-nut, and see that no crock is thrown at the door of anyone who has nothing to give.',
    outcomes: [
      '"A-shrovin, a-shrovin, I be come a-shrovin." The farmer\'s wife gives a dough-nut each and a bit of fat bacon.',
      'Old Mrs Pike has nothing in. The biggest boy has a crock in his hand; you take it off him, and she gives a song instead.',
      'The Pancake Bell goes at eleven, and every chimney in the street smokes. The first pancake sticks, as the first always does.',
    ],
    lore: 'Shrove Tuesday "means Confession Tuesday": the great bell was rung to call the parish to be shriven, and the custom of ringing it "obtains in and about London the name of Pancake-bell" (Gentleman\'s Magazine, 1790, in Hone). John Taylor wrote in Jack-a-Lent (1620) that "then there is a bell rung, cal\'d the Pancake-bell, the sound whereof makes thousands of people distracted, and forgetful either of manners or humanitie". Football "was, and remains, a game on Shrove Tuesday, in various parts of England" (Hone, 1826): at Kingston the shops were shut for it, and at Teddington people made fast the glass of all their front windows. At Ashbourne in Derbyshire it is still played on Shrove Tuesday and Ash Wednesday, almost every year since at least 1667. The cruel sport of the day was throwing at cocks: "Battering with massive weapons a cock tied to a stake" (Gentleman\'s Magazine, 1737). Magistrates set about putting it down (Westminster, 1759); near Birstall in 1783 "a youth about thirteen years of age" was killed by a stick thrown at a cock; and by 1826 Hone could write that "there is not a country gentleman now who would not discourage the shocking usage". In Dorset and Wiltshire children went "a-shrovin" for food, and a door that gave nothing had broken crockery thrown at it: "Lent Crocking" (Chambers, 1864). At Olney the women still race with frying pans; tradition says since 1445.',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book (1826), 15 February · J. Taylor, Jack-a-Lent (first printed 1617?; the 1630 Workes text), in T. S. Knowlson, The Origins of Popular Superstitions and Customs (1910) · R. Chambers, The Book of Days (1864), Shrove Tuesday · Ashbourne Royal Shrovetide Football · Olney Pancake Race',
  },
};

module.exports = { SHROVE_RITES };
