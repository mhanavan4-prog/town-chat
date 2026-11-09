// ---------------------------------------------------------------------------
// St Andrew's Day, 30 November: Scotland's saint, the Scots' night abroad,
// the lace-makers' "Tanders", and in Kent a squirrel hunt that was a riot.
// The caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'st_andrew' }).
//
// Sources: E. Hasted, The History and Topographical Survey of the County of
// Kent, vol. 6 (1798), "Easling", read first-hand in British History Online;
// W. Hone, The Every-Day Book, vol. II, 30 November, read first-hand (Hone
// archive transcription), who reprints Hasted; R. Chambers, The Book of Days
// (1864), 30 November, read first-hand; W. Henderson, Notes on the Folk-Lore
// of the Northern Counties (1879), index, read first-hand, for the lace-makers
// and Andermas; T. Sternberg, The Dialect and Folk-Lore of Northamptonshire
// (1851), as Lace in Context quotes him (second-hand); the South Carolina
// Encyclopedia on the St Andrew's Society of Charleston (1729); the National
// Records of Scotland's translation of the Declaration of Arbroath (1320).
// For the practical half: the Wildlife and Countryside Act 1981, sch. 5;
// NatureScot; Natural Resources Wales; GOV.UK (March 2019) and the Invasive
// Alien Species (Enforcement and Permitting) Order 2019, art. 3.
//
// Left out: St Andrew's Eve love-divination (Central European: Googe's
// Naogeorgus is a German satire, and Henderson puts hair-snatching in
// Germany); the saltire seen in the sky in 832 (a much later detail, Broun
// says, second-hand); Sussex squirrel hunts, Tandry cakes and metheglin in
// Hone (not found); Baker's Glossary (1854) (not read); that Hasted's
// squirrels were red (likely, not sourced), so the caller doesn't say so of
// the past, only of the wood now.
// ---------------------------------------------------------------------------
const ANDREW_RITES = {
  st_andrew: {
    key: 'st_andrew', name: 'The Squirrel Hunt', icon: '🐿️',
    how: 'On St Andrew\'s Day go out with the squirrel hunt, as the Kentish labourers did, and bring it home without a death in the wood or a hedge broken; and drink to Andrew with the Scots far from home.',
    outcomes: [
      'The hunt goes shouting through the wood. A red squirrel watches from an oak, and is left alone.',
      'Jem comes home with no hare, no pheasant, no hedge broken, and only a little drunk.',
      'Up in town the Scots meet for their saint, far from home, and the toast is to Andrew.',
    ],
    lore: 'Hasted wrote in 1798 of Easling in Kent: "On Nov. 30, being St. Andrew\'s, there is yearly a diversion called squirrel hunting", when "the labourers and lower kind of people assembling together, form a lawless rabble, and being accoutred with guns, poles, clubs, and other such weapons", went through the woods "under the pretence of demolishing the squirrels, some few of which they kill", destroying "numbers of hares, pheasants, partridges", "breaking down the hedges", and ending at the alehouses "in drunkenness, as is usual with such sort of gentry". Hone printed it, shortened and reworded, in the Every-Day Book (1826). Andrew has been "regarded, from time immemorial, as the patron saint of Scotland" (Chambers), named in the Declaration of Arbroath of 1320 as the Scots\' "patron for ever", and his day was "a favorite occasion of social and national reunion" for "Scotchmen residing in England and other places abroad": the St Andrew\'s Society of Charleston was founded on 30 November 1729. In Scotland the day was Andermas, kept, Henderson notes, "by repasts of sheeps\' heads"; in the lace country of Buckinghamshire and Northamptonshire Andrew was "the patron of lacemakers", and Sternberg (1851) found his day "a kind of miniature carnival". The saltire seen in the sky is a much later addition to the legend.',
    tier: 'record',
    source: 'E. Hasted, The History and Topographical Survey of the County of Kent, vol. 6 (1798), "Easling" · W. Hone, The Every-Day Book, vol. I (1826), 30 November · R. Chambers, The Book of Days (1864), 30 November · W. Henderson, Notes on the Folk-Lore of the Northern Counties (1879), index · Declaration of Arbroath (1320), NRS translation · South Carolina Encyclopedia, "St. Andrew\'s Society"',
  },
};

module.exports = { ANDREW_RITES };
