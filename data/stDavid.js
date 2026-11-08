// ---------------------------------------------------------------------------
// St David's Day, 1 March: the Welsh wore the leek; in London, less kindly,
// effigies of Welshmen were hung up. The caller is dated by the Commonplace
// Book's own entry (when: { calendar: 'st_david' }).
//
// Sources: Shakespeare, Henry V, IV.vii and V.i, in the First Folio (1623),
// read in EEBO-TCP (long s and u/v kept as printed); S. Pepys, Diary, 1 March
// 1666/67, ed. Wheatley, read in the Project Gutenberg text; W. Hone, The
// Every-Day Book, vol. I (1826), 1 March, for Porter (1632) and Poor Robin's
// Almanack (1757, second-hand) and his doubt of the Saxon-battle story;
// Buchedd Dewi (c. 1350), ed. D. S. Evans, The Welsh Life of St David (1988),
// as Wikipedia quotes it (second-hand); Amgueddfa Cymru on the daffodil; the
// Crown Prosecution Service and the Crime and Disorder Act 1998, s. 28, on
// hate crime; Citizens Advice Wales on reporting it; the Welsh Language
// (Wales) Measure 2011. Left out: Wheatley's "burnt in effigy" (Poor Robin
// says hanged), gingerbread "taffies" (only second-hand), any early source
// for the Saxon battle (none found), and the claim that hostility to the
// Welsh as such is in law racial (unsettled).
// ---------------------------------------------------------------------------
const DAVID_RITES = {
  st_david: {
    key: 'st_david', name: 'The Leek', icon: '🥬',
    how: 'On St David\'s Day wear a green leek in your hat, as the Welsh have worn it, Shakespeare says, since they fought "in a Garden where Leekes did grow"; and keep the saint\'s last word, and do the little things.',
    outcomes: [
      'A green leek goes in every Welsh hat in the street. It smells strongly, and nobody minds today.',
      'A lad mocks the leek, and old Mrs Jones reminds him what happened to Pistol. He thinks better of it.',
      'The little things are done: a letter home written, the step swept, bread taken to the old man next door.',
    ],
    lore: 'Shakespeare\'s Fluellen says the Welsh "did good seruice in a Garden where Leekes did grow, wearing Leekes in their Monmouth caps, which your Maiesty know to this houre is an honourable badge of the seruice", and Gower calls it "an ancient Tradition began vppon an honourable respect, and worne as a memorable Trophee of predeceased valor" (Henry V, First Folio, 1623). Porter wrote in 1632 that "the greatest part of his solemnitie consisteth in wearing of a greene leeke". The tale that David bade the Britons wear it to tell friend from Saxon in battle is told in Brady, but, Hone said, "he lays no ground for this positive statement." London was less kind: on 1 March 1667 Pepys saw in Mark Lane "the picture of a man dressed like a Welchman, hanging by the neck upon one of the poles that stand out at the top of one of the merchants\' houses", "one of the oddest sights I have seen a good while", and Poor Robin\'s almanac for 1757 rhymed of the English who "hang poor Taff… All stuffed with hay". David\'s own last words, in the Welsh Life of about 1350, were to "do the little things that you have seen me do and heard about": "gwnewch y petheu bychain". The daffodil came later, worn by Lloyd George in 1911.',
    tier: 'record',
    source: 'Shakespeare, Henry V, IV.vii, V.i, First Folio (1623) · S. Pepys, Diary, 1 March 1666/67 · W. Hone, The Every-Day Book, vol. I (1826), 1 March · Buchedd Dewi (c. 1350), ed. D. S. Evans (1988) · Amgueddfa Cymru, "National emblems"',
  },
};

module.exports = { DAVID_RITES };
