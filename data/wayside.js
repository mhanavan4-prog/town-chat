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

module.exports = { WAYSIDE, WAYSIDE_BY_ID, WAY };
