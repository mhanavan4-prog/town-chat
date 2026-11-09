// ---------------------------------------------------------------------------
// St Swithin's Day, 15 July: rain today means forty days of it. Swithun,
// Bishop of Winchester (d. 862 or 863), asked to be buried outside; his body
// was moved into the cathedral on 15 July 971 (record); that it then rained
// for forty days is a later story (Chambers: "rests on no authority
// whatever"). The caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'st_swithin' }).
//
// Sources: R. Chambers, The Book of Days (1864), 15 July (the rhyme, the
// legend, the Greenwich records of 1841–60); W. Hone, The Every-Day Book, vol.
// II (1827), 15 July (Poor Robin's Almanac, 1697); B. Jonson, Every Man Out of
// His Humour (1599), I.1; the Met Office, "Red sky at night and other weather
// lore"; the Royal Meteorological Society, "Behind the folklore: St Swithin's
// Day" (2019) and on swallows (2010); the RHS on potato and tomato blight.
// ---------------------------------------------------------------------------
const SWITHIN_RITES = {
  swithin_sky: {
    key: 'swithin_sky', name: 'Reading the Sky', icon: '🌧️',
    how: 'On St Swithin\'s Day watch the sky as the old ones did, the sunset, the high cloud, how low the swallows fly, and get the hay in when the sky allows, whatever the saint says.',
    outcomes: [
      'Rain from dawn on St Swithin\'s. Old Mead says forty days of it. You count, and it is dry again by Thursday.',
      'A red sky at sunset, out in the west. The hay comes in tomorrow, dry, and nobody says I told you so.',
      'Mares\' tails high up and a mackerel sky behind. The last load is under cover an hour before the rain.',
    ],
    lore: '"St Swithin\'s Day, if thou dost rain, / For forty days it will remain: / St. Swithin\'s Day, if thou be fair, / For forty days \'twill rain nae mair" (Chambers). Swithun, Bishop of Winchester, who died in 862 or 863, asked to be buried outside, "where his corpse might receive the eaves-droppings from the roof, and his grave be trodden by the feet of the passers-by"; on 15 July 971 his body was moved into the new cathedral. That it then rained for forty days, Chambers wrote, "rests on no authority whatever"; an annotator on Brand traced it only to "a cutting from an old newspaper". The belief was old all the same: in 1599 Jonson\'s farmer reads his almanac, "St. Swithin\'s, the 15 day, variable weather, for the most part rain", and grumbles that "it should rain forty days after, now, more or less, it was a rule held". Chambers cited twenty years of Greenwich observations, which found that "the greatest number of rainy days, after St. Swithin\'s Day, had taken place when the 15th of July was dry." The Met Office: "since records began there has been no occurrence of rainfall for such a prolonged period of time." Yet the Royal Meteorological Society allows "the tiniest glimmer of sense": about the middle of July the jet stream tends to settle, and the summer\'s weather with it.',
    tier: 'record',
    source: 'R. Chambers, The Book of Days (1864), 15 July · W. Hone, The Every-Day Book, vol. I (1826), 15 July · B. Jonson, Every Man Out of His Humour (1599), I.1 · Met Office, "Red sky at night and other weather lore" · Royal Meteorological Society, "Behind the folklore: St Swithin\'s Day" (2019)',
  },
};

module.exports = { SWITHIN_RITES };
