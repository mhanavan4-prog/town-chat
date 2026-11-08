// ---------------------------------------------------------------------------
// St Crispin's Day, 25 October: the shoemakers' saints, Crispin and
// Crispinian; the gentle craft's holiday, with King Crispin's procession,
// and Agincourt fought on it in 1415. The caller is dated by the Commonplace
// Book's own entry (when: { calendar: 'st_crispin' }).
//
// Sources: Shakespeare, Henry V, IV.iii, in the First Folio (1623), read in
// the EEBO-TCP transcription (long s modernised); T. Deloney, The Gentle
// Craft (1637 edition, EEBO-TCP); W. Hone, The Every-Day Book, vol. I (1826),
// 25 October, after Butler and the Times Telescope; R. Chambers, The Book of
// Days (1864), 25 October, on the procession and Tenby; Britannica on
// Agincourt; gov.uk and apprenticeships.gov.uk on an apprentice's rights; the
// HSE on hand knives. Left out: "St Crispin's lance" for the awl (not in
// Hone), Faversham from Hasted (couldn't be read; Faversham here is
// Deloney's story), a firm year for the martyrdom (c. 286–287), and the
// out-of-date "20%" training rule.
// ---------------------------------------------------------------------------
const CRISPIN_RITES = {
  st_crispin: {
    key: 'st_crispin', name: 'The Gentle Craft', icon: '👞',
    how: 'On St Crispin\'s Day keep holiday for the gentle craft: walk with the shoemakers behind their banner and the band, with King Crispin and his court, stop at every craftsman\'s door for the reading of Crispin\'s will, and end the day at a good tavern drinking to the two saints who made shoes for the poor.',
    outcomes: [
      'The cordwainers walk behind their banner and the band, and King Crispin rides at the front in a paper crown.',
      'At every shoemaker\'s door the procession halts, and Crispin\'s last will and testament is read out to roars.',
      'The evening ends at a good tavern, and every cup is raised to Crispin and Crispinian.',
    ],
    lore: 'Crispin and Crispinian, the legend says, came from Rome to preach at Soissons and "worked with their hands in the night, making shoes", until they "finished their course by the sword about the year 287" (Hone, after Butler). Deloney\'s Gentle Craft made them British princes taken in by "a Shoomaker in Feversham", and gave the trade its proverb: "A Shoomakers sonne is a Prince borne." Agincourt was fought on their day in 1415, and the First Folio\'s Henry V (1623) holds it fast: "This day is call\'d the Feast of Crispian… And Crispine Crispian shall ne\'re goe by, / From this day to the ending of the World, / But we in it shall be remembred". The craft kept it with "a grand procession of the brethren of the craft with banners and music, whilst various characters representing King Crispin and his court were sustained by different members" (Chambers, 1864), though the London cordwainers of 1816 wanted no procession, only "a good tavern" (Hone). At Tenby an effigy of the saint hung from the steeple on the eve was cut down in the morning and carried round, his "last will and testament" read at each craftsman\'s door, and at the end "the padding which formed the body of the effigy was made into a football".',
    tier: 'record',
    source: 'Shakespeare, Henry V, IV.iii, First Folio (1623) · T. Deloney, The Gentle Craft (1637 edition) · W. Hone, The Every-Day Book, vol. I (1826), 25 October · R. Chambers, The Book of Days (1864), 25 October',
  },
};

module.exports = { CRISPIN_RITES };
