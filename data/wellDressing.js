// ---------------------------------------------------------------------------
// Well-dressing at Tissington, Derbyshire, on Holy Thursday (Ascension Day,
// forty days after Easter): boards covered in moist clay, set with flower
// petals in a mosaic of devices and inscriptions, put up over the five wells;
// after church each well is visited and the psalms, Epistle and Gospel read.
// The caller is dated by the Commonplace Book's own entry (when: { calendar:
// 'well_dressing' }), which moves with Easter.
//
// Sources: D. and S. Lysons, Magna Britannia, vol. V, Derbyshire (1817),
// Customs, pp. ccxli–ccxlii; W. Hone, The Every-Day Book, vol. II (1827), 4
// May, with E. Rhodes, Peak Scenery, as Hone quotes it; R. Chambers, The Book
// of Days (1864), 5 May, on the drought of 1615 and the Youlgreave register;
// the Pitt Rivers Museum and the Derbyshire Historic Environment Record on its
// unknown origin; the Drinking Water Inspectorate, UKHSA and Rushcliffe
// Borough Council on private water supplies; RoSPA on open water; Plantlife
// and the Wildlife and Countryside Act 1981, s. 13, on picking. Left out: the
// Black Death as its origin (no early source; it is told as modern lore), a
// Gentleman's Magazine of 1794 that couldn't be found, and the date of the
// first garlands (1748 and 1758 are both given).
// ---------------------------------------------------------------------------
const WELL_RITES = {
  well_dressing: {
    key: 'well_dressing', name: 'Dressing the Well', icon: '⛲',
    how: 'Soak a board, cover it with moist clay, and press flower petals into it in a mosaic of devices and an inscription; set it up over the well on Holy Thursday, and after church go round the wells in turn for the psalms of the day, the Epistle and the Gospel, one at each.',
    outcomes: [
      'The board comes up out of the brook, and the clay goes on smooth. Petal by petal the letters come up in red daisies.',
      'The dressed board goes up over the well, a mosaic of petals bright as glass. The water runs clear below it.',
      'After church the procession stops at the well and the Gospel is read over the water. Then on to the next.',
    ],
    lore: 'Lysons (1817) found "an annual custom at Tissington, of dressing the wells or springs": on Holy Thursday they "are adorned with flowers, arranged in various devices, and accompanied with inscriptions", on "boards cut to the size and form of the subject intended to be represented, and covered with moist clay", "the petals of flowers forming a sort of mosaic-work". After a service and sermon each of the wells, "of which there are five, of remarkably clear water", is visited, and "the three Psalms for the day, with the Epistle and Gospel, are read, one at each well". Rhodes called it "well-flowering", and a correspondent of Hone\'s in 1826, who had never seen the day, noted that Tissington folk living away gathered flowers to bring home: "red daises, and none else". Why it began nobody knows. Chambers (1864) said some put it down to the drought of 1615, when the Youlgreave register says "There was no rayne fell upon the earth from the 25th day of March till the 2nd day of May"; the tale that it gives thanks for pure water in the Black Death has no early source behind it at all. The first visitors, in the middle of the eighteenth century, saw only garlands; the petal pictures came after.',
    tier: 'record',
    source: 'D. and S. Lysons, Magna Britannia, vol. V (1817), pp. ccxli–ccxlii · W. Hone, The Every-Day Book, vol. II (1827), 4 May · R. Chambers, The Book of Days (1864), 5 May',
  },
};

module.exports = { WELL_RITES };
