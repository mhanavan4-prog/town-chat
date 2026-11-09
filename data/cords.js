// ---------------------------------------------------------------------------
// Knots, and Selling the Wind — cord magic (blueprint proposal F).
//
// Recorded across the northern seaboard into the 1800s: a wind-seller tied the
// wind into a cord with three knots and sold it to a sailor. Undo the first for
// a moderate wind, the second for half a gale, the third and you have a
// hurricane. Frazer (The Golden Bough, 1890) gathers it from Finnish and Lapp
// wizards and from witches in Shetland, Lewis and the Isle of Man, where a
// 14th-century account already has the wind "under three knots of thread" and
// Lerwick still had old women selling winds in Frazer's day.
//
// Mechanically this is the one system that stores power for LATER: you tie a
// cord under the open sky today and loose its knots when you need them — each
// knot stronger than the last, and the third with a real cost.
//
// The Sea Witch path (+8% move speed until now) gets the practice: a Sea Witch
// may tie two cords a day, and her knots blow longer.
// ---------------------------------------------------------------------------

// The three knots, loosed in order. `swift` is added move speed while it blows.
const KNOTS = [
  { n: 1, name: 'The first knot', wind: 'a fair breeze', swift: 0.15, ms: 180000, line: 'A fair breeze gets up behind you.' },
  { n: 2, name: 'The second knot', wind: 'half a gale', swift: 0.30, ms: 120000, line: 'The wind rises to half a gale and fills your coat like a sail.' },
  { n: 3, name: 'The third knot', wind: 'a hurricane', swift: 0.60, ms: 45000, line: 'The third knot was never meant to be loosed. The storm takes you — and takes its due.', hpCostFrac: 0.25 },
];

// Cord items by knots still tied. Untying moves a cord down this ladder.
const CORD_BY_KNOTS = { 3: 'wind_cord_3', 2: 'wind_cord_2', 1: 'wind_cord_1' };
const CORD_MATERIAL = 'hemp_cord';
const CORDS_PER_DAY = 1;
const CORDS_PER_DAY_SEA = 2;
const SEA_WITCH_KNOT_MULT = 1.5; // a Sea Witch's knots blow half again as long
const OPEN_SKY_ROOMS = ['outside', 'wilds']; // a wind is tied under the open sky

const CORD_LORE = {
  wind: "Wind-sellers tied the wind into a cord with three knots and sold it to sailors. \"In Finnland wizards used to sell wind to storm-staid mariners. The wind was enclosed in three knots; if they undid the first knot, a moderate wind sprang up; if the second, it blew half a gale; if the third, a hurricane\" (Frazer, The Golden Bough, 1890); the same, he says, was told of Lappland, Lewis and the Isle of Man, and \"There are now in Lerwick old women who live by selling wind.\" The Isle of Man has the oldest record: Higden's 14th-century Polychronicon has the women there selling shipmen wind \"as it were closed under three knottes of threde\". At Stromness, Bessie Millie sold sailors winds for sixpence when Scott met her in 1814.",
  ladder: "The best-known knot-charm that survives is the Wellington 'witch's ladder' — a cord about a metre and a half long, with cock's feathers worked into it — found in the roof of a house demolished in Wellington, Somerset, in 1878–9 and now in the Pitt Rivers Museum, Oxford. What it was for is honestly unknown: the museum's label says it was used for getting away the milk from neighbours' cows, and for causing deaths.",
  tier: 'folk',
  source: "J. G. Frazer, The Golden Bough (1890), vol. I · R. Higden, Polychronicon (14th c.), in A. W. Moore, The Folk-Lore of the Isle of Man (1891) · Stromness Museum, on Bessie Millie · Pitt Rivers Museum 1911.32.7 (the Wellington witch's ladder)",
};

module.exports = { KNOTS, CORD_BY_KNOTS, CORD_MATERIAL, CORDS_PER_DAY, CORDS_PER_DAY_SEA, SEA_WITCH_KNOT_MULT, OPEN_SKY_ROOMS, CORD_LORE };
