// ---------------------------------------------------------------------------
// Lammas, 1 August, in Scotland: a quarter day and money-term, in hay-time,
// with the herd boys' Lammas towers and the Lammas fairs. The caller is dated
// by the Commonplace Book's own entry (when: { calendar: 'lammas_term' }).
//
// Sources: The Battle of Otterbourne (Child 161C, Scott's Minstrelsy), read
// in Child's English and Scottish Ballads, vol. VII (1860); the Scottish
// National Dictionary, "Term", "Lammas" and "Fee", read first-hand (the last
// quoting the St Andrews Citizen, 1937); the Removal Terms (Scotland) Act
// 1886 and the Term and Quarter Days (Scotland) Act 1990; Hansard, House of
// Lords, 13 June 1990; J. Anderson in Archaeologia Scotica I (1792), on the
// Lammas towers, as the SND quotes him; Fife Council's notice for the Lammas
// Market (2026); the Inverkeithing Highland Games (2026). For the practical
// half: GOV.UK on the written statement of employment particulars and the
// National Minimum Wage; the Agricultural Wages (Scotland) Order (No. 73)
// 2026.
//
// Put right: the old calendar entry said Lammas "was a quarter day until
// 1886". The 1886 Act fixed only the house-removal terms, 28 May and
// 28 November, and never names Lammas; Lammas is a quarter day still, 28
// August since 1990. It is in hay-time, not "the end of the hay". Left out:
// "the oldest medieval street fair in Europe" (no official source); Lammas as
// a flitting term (it never was).
// ---------------------------------------------------------------------------
const LAMMAS_TERM_RITES = {
  lammas_term: {
    key: 'lammas_term', name: 'Lammas Term', icon: '🌾',
    how: 'At Lammas tide, when the muir-men win their hay, pay the term\'s money, look for the herd boys\' Lammas tower, and go to the Lammas fair.',
    outcomes: [
      'The hay coming in on the muir, cart after cart, and the herd boys have a sod tower up on the knowe.',
      'The Lammas Market fills the street end to end, and the farmers are feeing hands for the half-year.',
      'The quarter\'s money paid at Lammas, the old money-term, and a receipt taken for it.',
    ],
    lore: '"It fell about the Lammas tide, / When the muir-men win their hay" (The Battle of Otterbourne, as Scott gave it). In Scotland Lammas was a term-day: "By Acts of 1690 and 1693 the Sc. term-days are Candlemas (2 Feb.), Whitsunday (15 May), Lammas (1 Aug.) and Martinmas (11 Nov.)". It was a money-term, for rents and school fees, not a flitting term: in 1886 "the removal terms for house occupancy were fixed by statute as 28 May and 28 Nov" (Scottish National Dictionary), and since 1990 Lammas has meant 28 August. In Mid-Lothian, Dr Anderson recorded in 1792, the herd boys "agreed to build a tower in some conspicuous place, near the centre of their district, which was to serve as the place of their rendezvous on Lammas day", a tower "usually built of sods". The St Andrews Lammas Market still fills the streets each August, where once "the fair was principally for the country folks \'feeing\'" (1937), and the games and Lammas Fair at Inverkeithing "appear in Burgh records of 1652".',
    tier: 'record',
    source: 'The Battle of Otterbourne, Child 161C (Scott, Minstrelsy of the Scottish Border) · Scottish National Dictionary, "Term", "Lammas" and "Fee" · Removal Terms (Scotland) Act 1886, s. 4 · Term and Quarter Days (Scotland) Act 1990, s. 1 · J. Anderson, Archaeologia Scotica I (1792) · Fife Council, Lammas Market order (2026)',
  },
};

module.exports = { LAMMAS_TERM_RITES };
