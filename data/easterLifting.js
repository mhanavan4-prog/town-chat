// ---------------------------------------------------------------------------
// Easter lifting, or heaving: on Easter Monday the men lifted the women three
// times into the air, in a chair or by the arms, and on Easter Tuesday the
// women lifted the men, and each one lifted paid for it. The caller is dated
// by the Commonplace Book's own entry (when: { calendar: 'lifting' }).
//
// Sources: W. Hone, The Every-Day Book, vol. I (1826), 5 April (Easter
// Tuesday, 1825), with Lysons' extract from the royal accounts and the
// Warwickshire letter signed L. S.; T. Loggan's account of the Talbot at
// Shrewsbury in 1799, as Hone prints it; the Gentleman's Magazine (1784) and
// the Walsall Advertiser (2 May 1896), both second-hand, the second as D. C.
// Woods gives it in The Blackcountryman 12.2 (1979); the Sexual Offences Act
// 2003, ss. 3 and 74; the CPS on consent; Rape Crisis England & Wales and
// Victim Support. Left out: the year 1290, the sum paid and the Latin of the
// Edward I entry, which couldn't be checked against the roll itself.
// ---------------------------------------------------------------------------
const LIFTING_RITES = {
  lifting: {
    key: 'lifting', name: 'Easter Lifting', icon: '🙌',
    how: 'On Easter Monday the men bring a chair dressed with ribbons, seat a woman who is willing in it, and lift her three times into the air; on Easter Tuesday the women do the same to the men. Whoever is lifted pays a small coin, and whoever says no is let be.',
    outcomes: [
      'The chair is lined white and tied with ribbons. Up she goes three times, laughing, and pays her sixpence.',
      "Tuesday's the women's day: they lift the churchwarden thrice, and he pays sixpence for leave and license to go.",
      'One girl shakes her head and steps back. The lads set the chair down, lift their hats, and go on up the street.',
    ],
    lore: 'Hone, writing on Easter Tuesday 1825: "In Lancashire, Staffordshire, Warwickshire, and some other parts of England there prevails this custom of heaving or lifting at Easter-tide", and "from every one lifted or heaved they extort a contribution". However it was done, "the ceremony is incomplete without three distinct elevations." He quotes Lysons on a roll among the Tower records with a payment to "certain ladies and maids of honour" "for taking king Edward I. in his bed at Easter". A Warwickshire correspondent, L. S., wrote that "on the former day it was customary for the men to heave and kiss the women, and on the latter for the women to retaliate upon the men", and told of a man "heaved and kissed, and compelled to pay sixpence for \'leave and license\' to depart". At the Talbot in Shrewsbury in 1799, Thomas Loggan was lifted in "an arm chair, lined with white, and decorated with ribbons and favours of different colours", by all the women servants of the inn: "It was the custom of the place." Not everyone liked it. The Gentleman\'s Magazine called it in 1784 "a rude, indecent, and dangerous diversion", and Hone himself "an absurd custom". At the Black Horse in Walsall on Easter Monday 1896 a woman who refused was followed into the passage and thrown down; the man was fined twenty shillings, and the magistrates\' clerk said plainly that "if the complainant objected to being heaved it was at once an assault for the defendant to proceed".',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book, vol. I (1826), 5 April · Walsall Advertiser (2 May 1896), in D. C. Woods, The Blackcountryman 12.2 (1979)',
  },
};

module.exports = { LIFTING_RITES };
