// ---------------------------------------------------------------------------
// Allantide, 31 October, in west Cornwall: "Allan-day", as Allhallows was
// called there, when every child had a big Allan apple from the Allan market;
// at Penzance one each was eaten for luck, the elder girls first putting theirs
// under the pillow to dream of their sweethearts. The caller is dated by the
// Commonplace Book's own entry (when: { calendar: 'allantide' }).
//
// Sources: R. Hunt, Popular Romances of the West of England, 2nd series
// (1865), no. 111, "Allhallows-Eve at St Ives", p. 177; M. A. Courtney,
// Cornish Feasts and Folk-Lore (1890), pp. 2–3; both read in the Project
// Gutenberg texts. The NHS on water and young children and on washing fruit;
// the London Fire Brigade and Cambridgeshire Fire and Rescue on costumes and
// candles. Left out: "polished" apples and a St Allen behind the name (both
// modern and unsourced), "husbands" (Courtney says sweethearts), nuts in the
// fire and ducking for apples (not in Courtney's Cornwall), and a 1572
// deposition for the Cornish name, which couldn't be read.
// ---------------------------------------------------------------------------
const ALLAN_RITES = {
  allantide: {
    key: 'allantide', name: 'The Allan Apple', icon: '🍎',
    how: 'On Allan-night give every child, and everyone in the house, a big Allan apple from the Allan market: the elder girls put theirs under the pillow before they eat it, to dream of their sweethearts, and the rest are eaten for luck.',
    outcomes: [
      'The Allan market is all big red apples in heaps. You buy one for every head in the house, and one over.',
      'The apple goes under the pillow, round and cold. In the morning she says she dreamed of someone, but won\'t say who.',
      'Apples hang from a spinning cross of candles in the kitchen; whoever bites one gets a taste of the wax as well.',
    ],
    lore: 'Hunt found it "still observed, to a great extent, at St Ives" in 1865: "Allan-day," as it is called, is the day of days to hundreds of children, who would deem it a great misfortune were they to go to bed on "Allan-night" without the time-honoured Allan apple to hide beneath their pillows", and the selling of them "is dignified by the term Allan Market." At Penzance, Courtney wrote in 1890, the fruiterers set out "very large apples, known locally as "Allan" apples", and "one was given to each member of the family to be eaten for luck. The elder girls put theirs, before they ate them, under their pillows, to dream of their sweethearts", though the custom was "practically dying out". At Newlyn West a wooden cross with "a lighted candle" at each end and apples hung between was made to spin from a beam, and the players trying to catch the apples in their mouths "often get instead a taste of the candle." Allan-day is simply Hunt\'s name for Allhallows in the west; a St Allen behind it, and the polished apples of modern accounts, have no old source.',
    tier: 'folk',
    source: 'R. Hunt, Popular Romances of the West of England, 2nd series (1865), no. 111, p. 177 · M. A. Courtney, Cornish Feasts and Folk-Lore (1890), pp. 2–3',
  },
};

module.exports = { ALLAN_RITES };
