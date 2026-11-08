// ---------------------------------------------------------------------------
// The Abbots Bromley Horn Dance: six deer-men carry reindeer antlers round the
// parish on Wakes Monday (the Monday after the first Sunday after 4
// September, so between 6 and 12 September), with the hobby horse, Maid
// Marian, the jester and a boy with a bow. Plot (1686) knew it as a Christmas
// hobby-horse dance already lapsed "within memory". The caller is dated by
// the Commonplace Book's own entry (when: { calendar: 'horn_dance' }).
//
// Sources: R. Plot, The Natural History of Stafford-shire (1686), ch. X, §66,
// p. 434, read in the EEBO-TCP transcription (long s modernised); St
// Nicholas, Abbots Bromley, on the service and the date; R. Gandy in the
// Fortean Times on the route, the characters and the weight of the horns; T.
// Buckland, Lore and Language 3 (1980), on the radiocarbon date, and S. Roud,
// The English Year (2006), on its origin, both as Wikipedia gives them
// (second-hand); the NHS on blisters; the Highway Code, rules 3 and 5; the
// HSE on carrying a load. Left out: a pagan origin (no evidence), any weight
// beyond Gandy's range, and the official Horn Dance site, which couldn't be
// read.
// ---------------------------------------------------------------------------
const HORN_RITES = {
  horn_dance: {
    key: 'horn_dance', name: 'The Horn Dance', icon: '🦌',
    how: 'Fetch the six pairs of reindeer horns from the church on Wakes Monday morning and carry them round the parish all day, the deer-men dancing the hay with the hobby horse, Maid Marian, the jester and the boy with the bow, to the melodeon; take the pennies at every house, and bring the horns home to the church after dark.',
    outcomes: [
      'The horns come down off the church wall in the morning, heavy and cold. Six men shoulder them, and out they go.',
      'At the hall the deer-men dance the hay, horns lowered, weaving in and out, and the bow snaps in time to the tune.',
      'The pot goes round and the pennies go in, for the church and the poor. It is dark before the horns come home.',
    ],
    lore: 'Plot wrote in 1686 that at "Abbots, or now rather Pagets Bromley, they had also within memory" a Christmas sport, kept "on New-year, and Twelft-day", "call\'d the Hobby-horse dance": a man with "the image of a horse between his leggs" and a bow and arrow that "made a snapping noise as he drew it to and fro, keeping time with the Musick", and "6 others, carrying on their shoulders as many Rain deers heads, 3 of them painted white, and 3 red", who "danced the Hays, and other Country dances". The pennies went into a pot kept by the Reeves, and with the money "they not only repaired their Church but kept their poore too". So when he wrote it was a Christmas dance, and already lapsed. Now it comes on Wakes Monday in September: the horns are fetched from St Nicholas\'s church in the morning, and the six deer-men, with the hobby horse, Maid Marian, the jester and a boy with a bow and arrow, cover "around 10 miles" before they bring them back. One antler was radiocarbon dated in 1976 to 1065, give or take eighty years; it is reindeer, long gone from Britain, so it must have come from Scandinavia. As for the pagan rite it is often said to be, "there is no concrete evidence" (Roud).',
    tier: 'record',
    source: 'R. Plot, The Natural History of Stafford-shire (1686), ch. X, §66, p. 434 · St Nicholas, Abbots Bromley, "Horn Dance Service" · R. Gandy, "The Abbots Bromley Horn Dance", Fortean Times · T. Buckland, Lore and Language 3 (1980) · S. Roud, The English Year (2006)',
  },
};

module.exports = { HORN_RITES };
