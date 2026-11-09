// ---------------------------------------------------------------------------
// St Patrick's Day, 17 March: shamrock worn in the hat, Patrick's crosses on
// the children's sleeves, and at night the Patrick's pot, with the shamrock
// "drowned" in the last glass. The caller is dated by the Commonplace Book's
// own entry (when: { calendar: 'st_patrick' }).
//
// Sources: T. Dinely, Observations in a Voyage through the Kingdom of
// Ireland (1681), as printed in the Journal of the Kilkenny Archaeological
// Society (1856), and C. Threlkeld, Synopsis Stirpium Hibernicarum (1726),
// both second-hand; W. Hone, The Every-Day Book, vol. II (1827), 17 March,
// cols. 386–89, read in the Project Gutenberg text; the National Museum of
// Ireland, Folklife Collections, "St. Patrick"; C. Nelson's 1988 survey on
// which plant is the shamrock; the HSE on low-risk drinking; the NHS on
// drinking with food; the Road Safety Authority on drink-driving. Left out:
// 1681 as the date of drowning the shamrock (Dinely says nothing of it), the
// 1893 survey's percentages (the sources disagree), "drawn in colours" for the
// crosses, and a UK drink-drive comparison (no source reached).
// ---------------------------------------------------------------------------
const PATRICK_RITES = {
  st_patrick: {
    key: 'st_patrick', name: 'Drowning the Shamrock', icon: '☘️',
    how: 'On St Patrick\'s Day wear a sprig of shamrock in your hat and pin Patrick\'s crosses to the children\'s sleeves; at night drink the Patrick\'s pot to the saint, drown the shamrock in the last glass (by the strict rule, on Sheelah\'s night, the 18th), then fish it out and throw it over your left shoulder for luck.',
    outcomes: [
      'A sprig of shamrock goes in every hat, and the children have paper Patrick\'s crosses pinned to their sleeves.',
      'At night the last glass is raised to the saint, and the shamrock goes into it. Drowned.',
      'The wet sprig is fished out and flung over the left shoulder. It lands in the fire, which all agree is lucky.',
    ],
    lore: 'Thomas Dinely, an Englishman travelling in Ireland in 1681, wrote that on St Patrick\'s Day "ye Irish of all stations and condicions were crosses in their hatts, some of pinns, some of green ribbon, and the vulgar superstitiously wear shamroges, 3 leav\'d grass, which they likewise eat (they say) to cause a sweet breath." Threlkeld (1726) is the first to set down "a current tradition, that by this Three Leafed Grass, he emblematically set forth to them the Mystery of the Holy Trinity. However that be, when they wet their Seamar-oge, they often commit excess in liquor". By Hone\'s day (1827) the inn added "a \'Patrick\'s pot,\' or quantum of beer; but, of late years, whiskey is the beverage most esteemed", "children have \'Patrick\'s crosses\' pinned to their sleeves", and the shamrock, worn "also on Sheelah\'s day" (the 18th), should "on the latter night, be drowned in the last glass", though "it frequently happens that the shamrock is flooded in the last glass of St. Patrick\'s day". Throwing it over the left shoulder after the toast comes from later accounts. Which plant it is was never settled: in a survey of 1988, lesser clover was named most often, white clover next.',
    tier: 'record',
    source: 'T. Dinely (1681), in the Journal of the Kilkenny Archaeological Society (1856–57) · C. Threlkeld, Synopsis Stirpium Hibernicarum (1726) · W. Hone, The Every-Day Book, vol. II (1827), 17 March, cols. 386–89 · National Museum of Ireland, "St. Patrick"',
  },
};

module.exports = { PATRICK_RITES };
