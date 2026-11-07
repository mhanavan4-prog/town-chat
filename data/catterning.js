// ---------------------------------------------------------------------------
// Catterning: St Catherine's Day, 25 November. St Catherine of the wheel was
// the spinners' and spinsters' saint, and her day was "Cathar'ning": young
// women met and made merry. In the lace villages of Bedfordshire,
// Buckinghamshire and Northamptonshire it was the lacemakers' holiday, kept
// with tea and Cattern cakes; in Worcestershire children went round the farms
// for apples and beer. The caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'catterning' }).
//
// Sources: W. Hone, The Every-Day Book, vol. II (1827), 25 November, quoting
// La Motte (1730); C. C. Channer and M. E. Roberts, Lace-making in the
// Midlands (1900), Mrs Orlebar's account of Podington; Notes and Queries, 3rd
// ser. I (17 May 1862), p. 387, as Lace in Context quotes it; J. O.
// Halliwell, Popular Rhymes and Nursery Tales (1849), p. 238; C. Dack, Weather
// and Folk Lore of Peterborough (1911), p. 12. Katharine of Aragon and the
// burnt lace is told as legend, as the sources tell it.
//
// Left out: jumping the candlestick ("Jack" or "Kit be nimble"), often said
// to be a Catterning game, since no source seen ties it to the day; and
// "lamb's wool", which none of them gives.
// ---------------------------------------------------------------------------
const CATTERN_RITES = {
  cattern_cakes: {
    key: 'cattern_cakes', name: 'Keeping Cattern', icon: '🎡',
    how: 'Bake large seed cakes and set the kettle on, and keep Cattern with the lacemakers: tea, cakes and gossip, the pillows put away for the day; and apples at the door for the children who come singing for Catharine and Clement.',
    outcomes: [
      'Six lacemakers round the fire, the pillows put away. The seed cake goes, then the gossip, then the second pot of tea.',
      'Children at the door: "Catharine and Clement, be here, be here." They go off with an apple each and a slice of cake.',
      'Old Betsy tells how a queen burnt all her lace so the poor might sell her new. Nobody believes it. Everyone likes it.',
    ],
    lore: 'St Catherine of the wheel "was esteemed the saint and patroness of spinsters, and her holiday observed by young women meeting on this day, and making merry together, which they call \'Cathar\'ning.\'" (Hone, quoting La Motte, 1730). In the lace villages it was the lacemakers\' holiday. At Podington in Bedfordshire, Mrs Orlebar remembered, they "\'kept Cattern\'" on St Catherine\'s Day Old Style, 6 December; the tea-drinking was called "washing the candle-block", the cakes were "seed cakes of large size", and "It really consisted in getting through a great deal of gossip, tea, and Cattern cakes" (1900). In 1862 lacemakers were said to "eat a sort of cakes they call \'wigs,\' and drink ale." Why her day? It is said that Katharine of Aragon, who lived at Ampthill, burnt her lace so that the poor lacemakers might sell her new; the same writers thought the holiday "probably far older". In Worcestershire children went round the farmhouses on St Catharine\'s Day "collecting apples and beer for a festival", singing "Catharine and Clement, be here, be here, / Some of your apples, and some of your beer", and the Chapter of Worcester made "a rich bowl of wine and spices, called the \'Cathern bowl,\'" (Halliwell, 1849). At Peterborough the girls of the workhouse went in procession dressed in white, the tallest with "a crown of gilt paper" and a sceptre and distaff (Dack, 1911).',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book, vol. II (1827), 25 November · C. C. Channer & M. E. Roberts, Lace-making in the Midlands (1900) · Notes and Queries (17 May 1862) · J. O. Halliwell, Popular Rhymes and Nursery Tales (1849), p. 238 · C. Dack, Weather and Folk Lore of Peterborough (1911), p. 12',
  },
};

module.exports = { CATTERN_RITES };
