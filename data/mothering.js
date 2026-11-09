// ---------------------------------------------------------------------------
// Mothering Sunday, Mid-Lent Sunday (Easter less 21 days): servants and
// apprentices went home to their mothers with a cake or a trinket, and were
// given furmity and a blessing; the older custom was an offering at the mother
// church. The cake was a simnel. The caller is dated by the Commonplace Book's
// own entry (when: { calendar: 'mothering_sunday' }), so it moves with Easter.
//
// Sources: W. Hone, The Every-Day Book, vol. I (1826), 13 March, quoting the
// Gentleman's Magazine and Fosbroke, and Herrick's "To Dianeme. A Ceremonie
// in Glocester" (Hesperides, 1648, p. 278) in Hone's spelling; R. Symonds's
// diary, 1644 (Camden Society, 1859), as quoted; R. Chambers, The Book of Days,
// on Shrewsbury simnels, as Foods of England quotes it; A. Lee, History Today,
// on the Simon and Nell tale (first printed 1838); P. Carter, OUPblog (2013),
// on Constance Penswick Smith. Left out: violets picked for mother on the way
// home, found only in the 20th century.
// ---------------------------------------------------------------------------
const MOTHERING_RITES = {
  simnel: {
    key: 'simnel', name: 'Going a-Mothering', icon: '💐',
    how: 'Bake a simnel cake, then walk home on Mid-Lent Sunday to give it to your mother, and take her blessing and a bowl of furmity in return.',
    outcomes: [
      'Your mother cuts the simnel before you\'ve got your coat off, and says it\'s better than hers. It isn\'t.',
      'A bowl of furmity by the fire, and her hand on your head for a blessing, the way it was when you were small.',
      'Half the parish has come home today. At church every pew is full of sons and daughters in their best.',
    ],
    lore: 'Hone (1826): "It is still a custom on Mid-Lent Sunday in many parts of England, for servants and apprentices to carry cakes or some nice eatables or trinkets, as presents to their parents", or "to visit their mother for a meal of furmity, or to receive cakes from her with her blessing. This is called going a mothering." The older custom was "going to the mother-church on Mid-Lent Sunday, to make offerings at the high altar". Herrick\'s "Ceremonie in Glocester" (1648) has it: "I\'Le to thee a Simnell bring, / \'Gainst thou go\'st a mothering". At Worcester in 1644 Richard Symonds found the children and godchildren feasting with the head of the family: "They call it the Mothering-day." The simnels of Shrewsbury were rich cakes "tied up in a cloth, and boiled for several hours, after which they are brushed over with egg, and then baked" (Chambers). The tale that Simon and Nell quarrelled over boiling or baking one, and so named it, was first printed in 1838. From 1913 Constance Penswick Smith campaigned for the old Mothering Sunday, when the American Mother\'s Day of 1908 was coming in.',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book, vol. I (1826), 13 March · R. Herrick, Hesperides (1648), p. 278 · R. Symonds, Diary of the Marches of the Royal Army, ed. C. E. Long (1859) · R. Chambers, The Book of Days (1864), Mid-Lent Sunday · A. Lee, "Have Your Simnel Cake and Eat It", History Today',
  },
};

module.exports = { MOTHERING_RITES };
