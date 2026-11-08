// ---------------------------------------------------------------------------
// St Peter's Eve, 28 June: the last of the midsummer fires. Newcastle's cooks
// kept two bonfires on the Sand-hill, Midsummer Eve's and St Peter's; in west
// Cornwall the fishing towns lit lines of tar-barrels in the streets on both
// eves, St Peter being the fishermen's saint. The caller is dated by the
// Commonplace Book's own entry (when: { calendar: 'st_peters_eve' }).
//
// Sources: J. Stow, A Survey of London (1603), "Watches in London", ed. C. L.
// Kingsford (1908), on British History Online; the Newcastle cooks' ordinary
// of 1575, in Brand, Popular Antiquities (1849), i. 318, as T. F. Thiselton
// Dyer, British Popular Customs (1876), quotes it (second-hand); W. Borlase,
// Antiquities of Cornwall (1754), as Dyer quotes it (second-hand); M. A.
// Courtney, Cornish Feasts and Folk-Lore (1890), read in the Project
// Gutenberg text; the Countryside Code; Swansea Bay University Health Board
// and Cornwall Fire and Rescue on beach barbecues; the NHS on burns. Left
// out: Hone as a source for the ordinance (he doesn't quote it), the torches
// swung round heads as St Peter's own (Courtney gives them for Midsummer
// Eve), "bel-fires" as a Northumberland name, and a general "below the high
// tide line" rule for beach fires.
// ---------------------------------------------------------------------------
const PETER_RITES = {
  st_peters_eve: {
    key: 'st_peters_eve', name: "St Peter's Fire", icon: '🔥',
    how: 'On St Peter\'s Eve, the last of the midsummer fires, go from house to house begging faggots and pence for the fishermen\'s bonfire; set tables before the doors with sweet bread and good drink for the neighbours; and at nightfall light the bonfire on the beach and the lines of tar-barrels down the street.',
    outcomes: [
      'Every house gives a faggot or a stick, and the pile on the beach grows taller than the boats drawn up beside it.',
      'Tables come out before the doors with sweet bread and good drink, and neighbours who never speak share a cup.',
      'At nightfall the tar-barrels are lit down the street, and the whole town glows orange to the harbour wall.',
    ],
    lore: 'Stow (1603) remembered London "In the Moneths of Iune, and Iuly, on the Vigiles of festiuall dayes", with bonfires in the streets, "euery man bestowing wood or labour towards them", and tables before the doors "furnished with sweete breade, and good drinke": "These were called Bonefiers aswell of good amitie amongest neighbours … as also for the vertue that a great fire hath to purge the infection of the ayre." At Newcastle in 1575 the cooks were bound "to mainteigne and keep the bonefires, according to the auntient custome of the said towne on the Sand-hill; that is to say, one bone-fire on the even of the Feast of the Nativitie of St. John Baptist, commonly called Midsomer Even, and the other on the even of the Feast of St. Peter the Apostle, if it shall please the Maior and Aldermen of the said towne for the time being to have the same bone-fires." In Cornwall, Borlase wrote in 1754, "the festival fires, called bonfires, are kindled on the eve of St. John the Baptist and St. Peter\'s Day", and Courtney found that "In Penzance, and in nearly all the parishes of West Penwith, immediately after nightfall on the eves of St. John and St. Peter, the 23rd and 28th of June, lines of tar-barrels, occasionally broken by bonfires, were simultaneously lighted in all the streets." At Polperro "a large pile of faggots and tar-barrels is built on the beach", and the young fishermen "go from house to house and beg money": Peter was their saint.',
    tier: 'record',
    source: 'J. Stow, A Survey of London (1603), "Watches in London" · the Newcastle cooks\' ordinary (1575), in J. Brand, Popular Antiquities (1849), i. 318, as T. F. Thiselton Dyer gives it (1876) · M. A. Courtney, Cornish Feasts and Folk-Lore (1890)',
  },
};

module.exports = { PETER_RITES };
