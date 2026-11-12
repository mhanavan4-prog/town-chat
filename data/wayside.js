// ---------------------------------------------------------------------------
// The road north — three things by the wayside between the Wilds' portal and
// the Wildlands Village, so the walk between them is a walk past something.
// Each is out of the record or the folk tradition, with its tier and source
// and a note where the game goes past them, as with the Old Ways.
//
//   ⛓️ the gibbet at the crossroads — take a splinter
//   🪙 the coin tree               — hammer in a coin, and wish
//   ⚰️ the coffin stone            — set down what you are carrying
//
// Each may be used once a day. All three in one day is the road walked, which
// pays a purse. What they do is lib/wayside.js.
// ---------------------------------------------------------------------------
const WAYSIDE = [
  {
    id: 'gibbet', icon: '⛓️', name: 'The gibbet at the crossroads', x: 5000, y: 7200, model: 'wd_gibbet', size: 175,
    hint: 'take a splinter from the gibbet',
    tier: 'record',
    lore: [
      'A gibbet was not the gallows. It was where the body was hung afterwards, in an iron cage on a post by the road nearest the crime, and left until it fell apart. William Winter was hanged at Newcastle on 10 August 1792 for the murder of an old woman at Raw, and his body hung in chains at Steng Cross above Elsdon "until even his clothes had rotted away". A replica of his gibbet has stood there since 1867.',
      'The law gave it up in 1834. Until 1823 the law also buried suicides at a crossroads, at night, without a service, which is half the reason crossroads have the name they have.',
      'What hung there was thought to have a use. It was said of Winter\'s gibbet, and of others, that a splinter cut from the post and rubbed on the gum would cure the toothache.',
    ],
    source: 'The Murder Act (1752) and its repeal as to hanging in chains, 4 & 5 Will. IV c. 26 (1834); the Burial of Suicides Act, 4 Geo. IV c. 52 (1823); S. Tarlow, The Golden and Ghoulish Age of the Gibbet in Britain (2017); the toothache cure is local tradition at Elsdon, Northumberland.',
    note: 'The splinter was for toothache. That it mends a hurt of any kind is the game\'s.',
  },
  {
    id: 'cointree', icon: '🪙', name: 'The coin tree', x: 4760, y: 5900, model: 'wd_cointree', size: 230,
    hint: 'hammer a coin into the tree, and wish',
    tier: 'record',
    lore: [
      'On Isle Maree in Loch Maree there was an oak by a holy well, and pilgrims left something on it for the saint: Thomas Pennant saw their tokens in the 1770s. First it was rags, then nails and pins, and by the end of the nineteenth century coins driven edgeways into the bark. Queen Victoria and her party hammered theirs in on 17 September 1877; she wrote that it was "a sort of offering to the saint".',
      'By then it was called a wishing tree, and a wish made as the coin went in "would certainly be realised". The copper killed the oak. There are about two hundred coin trees in Britain and Ireland now, most of them fallen trunks beside a path, and nearly all of them begun since the 1980s by walkers copying each other.',
    ],
    source: 'C. Houlbrook, "Sustaining and Substituting the Sacred: Coin Trees in Britain and Ireland", Folklore (Tartu) 81 (2021), and The Magic of Coin-Trees from Religion to Recreation (2018); T. Pennant, A Tour in Scotland (1775); Queen Victoria, More Leaves from the Journal of a Life in the Highlands (1884).',
    note: 'Nobody ever claimed the tree paid back. In the game a wish is now and then heard, in coin.',
  },
  {
    id: 'coffinstone', icon: '⚰️', name: 'The coffin stone', x: 5180, y: 4600, model: 'wd_coffinstone', size: 190,
    hint: 'set down what you are carrying, and rest',
    tier: 'folk',
    lore: [
      'Where a hamlet had no burying-ground of its own, its dead were carried to the mother church, sometimes ten miles over the fell. The way they went was the corpse road, and along it were flat stones where the bearers could set the coffin down and change hands without it touching the ground. There is one on the Swaledale Corpse Way near Ivelet Bridge.',
      'The dead were carried feet first, so that they should not look back at the house, and it was held that spirits kept to the same road afterwards; crossing running water on the way was thought to stop them coming home. Shakespeare has the sprites of the night gliding "in the church-way paths".',
    ],
    source: 'J. Simpson and S. Roud, A Dictionary of English Folklore (2000); P. Hindle, Roads and Tracks of the Lake District (1998); W. Shakespeare, A Midsummer Night\'s Dream (c.1595), V.i.',
    note: 'The stone was for a coffin. That a living traveller is the better for resting at one is the game\'s.',
  },
];
const WAYSIDE_BY_ID = Object.fromEntries(WAYSIDE.map((w) => [w.id, w]));

const WAY = {
  range: 150,             // how near you must stand
  splinterHeal: 0.35,     // the gibbet: this share of your health back
  coinGold: 1,            // the coin tree: what you hammer in…
  wishChance: 0.2, wishGold: 15,   // …and now and then a wish is heard
  eachXp: 15,             // each of the three, once a day
  roadGold: 30, roadXp: 40,        // all three in one day: the road walked
};

// The corpse candle (canwyll corff): at night a small light comes down the
// road from the coffin stone to the gibbet. Keep behind it to the end.
const CANDLE = {
  tier: 'folk',
  from: 'coffinstone',
  // from the coffin stone, round the coin tree, to the foot of the gibbet
  path: [[5180, 4700], [5060, 5300], [4870, 5900], [4930, 6600], [5045, 7140]],
  speed: 80,          // a slow walking pace: she can be overtaken, and must not be
  standMs: 7000,      // it stands by the stone this long before it goes
  wake: 170,          // how near the coffin stone, by night, before it sets out
  lose: 380, loseMs: 4000,   // further behind than this, for this long, and it is gone
  cross: 45,          // nearer than this is in its way
  ahead: 70, beside: 80,     // or this far before it on the road
  struck: 0.25,       // of her health, and never the last of it
  xp: 60,
  kinds: [
    { id: 'child', colour: 0x9fc4ff, size: 22, name: 'a small pale-blue light', whose: 'a child\'s' },
    { id: 'woman', colour: 0xf2f2ff, size: 34, name: 'a white light', whose: 'a woman\'s' },
    { id: 'man', colour: 0xff8a6a, size: 38, name: 'a reddish light', whose: 'a man\'s' },
  ],
  lore: [
    'In Wales it was the canwyll corff, the corpse candle: a small light seen going by night, about the height of a hand above the ground, along the very road a funeral would take from a house to the churchyard, days before anyone in the house was known to be ill.',
    'Its size and colour told whose it was. A small pale or bluish light was a child\'s, a larger one a grown person\'s; in some accounts a white one was a woman\'s and a red one a man\'s. Two together meant two burials.',
    'It was not to be meddled with. The stories are of people who stood in its way, or struck at it, and were thrown down or took sick. You stepped off the road and let it by.',
    'St David was said to have prayed that his people might have warning of their deaths, and the candle was the answer.',
  ],
  source: 'John Aubrey, Miscellanies (1696), printing letters on corpse-candles in Wales; Edmund Jones, A Relation of Apparitions of Spirits in the County of Monmouth and the Principality of Wales (1780); Wirt Sikes, British Goblins (1880).',
  note: 'A folk belief, well recorded. Following one down the road for a reward is the game\'s; in the stories you kept out of its way and learned who had died.',
};

module.exports = { CANDLE, WAYSIDE, WAYSIDE_BY_ID, WAY };
