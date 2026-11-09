// ---------------------------------------------------------------------------
// The turning year: two recorded customs for each of the other six festivals
// on the Wheel (Samhain and Yule have their own files). Each is worked as a
// caller step ('rite') for a caller who comes to the door only in that season.
//
// As everywhere in the game, `how` follows the sources and the outcomes are
// the game's readings of the signs people looked for. Public-domain sources
// are quoted; modern books are only paraphrased.
//
//   imbolc      Bride's bed (Martin Martin, 1703) · St Brigid's cross
//   ostara      the sun dancing on Easter morning · pace eggs
//   beltane     May dew (Pepys, 1667) · the Beltane cake (Pennant, 1769)
//   litha       St John's Eve greenery (Stow, 1603) · hemp-seed (Gay, 1714)
//   lughnasadh  the Lammas loaf (an 11th-century charm) · Bilberry Sunday
//   mabon       crying the neck · blackberries before Michaelmas
// ---------------------------------------------------------------------------
const WHEEL_RITES = {
  // ── Imbolc ──
  bridesbed: {
    key: 'bridesbed', season: 'imbolc', name: "Bride's Bed", icon: '🌾',
    how: 'At bedtime on the second of February, dress a sheaf of oats in a woman\'s clothes, lay it in a large basket with a wooden club beside it, and cry three times, "Briid is come, Briid is welcome." In the morning, look in the ashes.',
    outcomes: [
      "There, in the ashes: the print of Briid's club. A good crop and a prosperous year.",
      'The ashes lie smooth and grey. No print; the old folk call it an ill omen, and bank the fire higher.',
      'Something has marked the ashes, a club or the cat. The mistress decides it was the club.',
    ],
    lore: 'Martin Martin, of the Western Isles: "The mistress and servants of each family take a sheaf of oats and dress it up in women\'s apparel, put it in a large basket, and lay a wooden club by it, and this they call Briid\'s-bed." They cried three times, "Briid is come, Briid is welcome," and in the morning looked among the ashes for the impression of the club: "a true presage of a good crop and prosperous year," and no print an ill omen. Carmichael, in 1900, gives it as still kept on the Eve of Bride, with "a small straight white wand (the bark being peeled off)" in place of the club, and the ashes searched for its marks or, better, for "the footprint of Bride".',
    tier: 'record',
    source: 'Martin Martin, A Description of the Western Islands of Scotland (1703) · A. Carmichael, Carmina Gadelica vol. 1 (1900)',
  },
  brigidcross: {
    key: 'brigidcross', season: 'imbolc', name: "St Brigid's Cross", icon: '✚',
    how: 'Gather rushes on the eve of the feast and weave the four-armed cross. Hang it in the rafters or over the door, and take down last year\'s to burn or bury in the field.',
    outcomes: [
      'The arms come out even and the weave holds tight. It goes up over the door; no fire will take this house this year.',
      'One arm is longer than the others, whatever you do. It goes up in the rafters all the same; Brigid is not particular.',
      "Last year's cross comes down black with smoke. You bury it in the field, for Brigid's sake and the crops'.",
    ],
    lore: "In Ireland, rushes were gathered on the eve of Brigid's feast (31 January) and woven into crosses that were hung in the rafters or over the doors of the house, the byre and the stable. \"The most commonly mentioned belief is that these crosses offered protection from fires\" (Ó Longáin); in Kilcullen a child wrote that \"nobody in that house can die of poisoning or fire\". The old cross was burned, left in the rafters, or buried in the fields to bless the harvest. The custom was recorded across the country by schoolchildren for the Irish Folklore Commission in 1937–39.",
    tier: 'folk',
    source: "National Folklore Collection, Schools' Collection (1937–39) · D. Ó Longáin, RTÉ Brainstorm (2024) · National Museum of Ireland, St Brigid's crosses",
  },
  // ── Ostara ──
  sundance: {
    key: 'sundance', season: 'ostara', name: 'The Sun Dancing', icon: '🌅',
    how: 'Rise before four on Easter morning and go out to the east to watch the sun come up, best of all in a clear spring or a vessel of still water, where you will see it dance for joy.',
    outcomes: [
      'The sun clears the hill and, in the water, it shivers and dances. You saw it. Nobody will tell you otherwise.',
      'Cloud over the east. No dance this year; you go home cold, and laughed at, and glad you went.',
      'It quivers in the pail, or the pail quivers in your hands. The children are sure it danced.',
    ],
    lore: 'It was a common belief that the sun danced on Easter Day for the Resurrection. Sir Thomas Browne, collecting vulgar errors in 1646, hoped he would not disparage the Resurrection "if we say the Sun doth not dance on Easter day". In Ireland, a correspondent told Hone, people would "rise about four o\'clock to see the sun dance in honour of the resurrection"; and Dunton\'s Athenian Oracle, which Hone quotes, says that in some parts of England "they call it the lamb-playing, which they look for, as soon as the sun rises, in some clear or spring water, and is nothing but the pretty reflection it makes from the water". In South Uist old Barbara Macphie told Carmichael she had seen it once from the top of Benmore: "It was dancing up and down in exultation at the joyous resurrection".',
    tier: 'record',
    source: 'Sir Thomas Browne, Pseudodoxia Epidemica (1646), Book V ch. 21 (ch. 22 in later editions) · W. Hone, The Every-Day Book (1826–27), 5 April, with J. Dunton\'s Athenian Oracle · A. Carmichael, Carmina Gadelica vol. 2 (1900), "Domhnach Ceusda"',
  },
  paceeggs: {
    key: 'paceeggs', season: 'ostara', name: 'Pace Eggs', icon: '🥚',
    how: 'Hard-boil the eggs inside the papery coats of onions (or with whin blossom for yellow), then take them out to the steepest grassy brae and roll them down. The egg that goes furthest unbroken wins.',
    outcomes: [
      'Yours bowls all the way down to the beck without a crack. The champion egg; the children are speechless.',
      'It hits a stone halfway and that is the end of it. You eat the pieces, which is the other half of the fun.',
      'It wobbles, stops, and is overtaken by a smaller egg. A good egg, all the same; onion-brown and whole.',
    ],
    lore: 'Pace eggs are Pasch (Easter) eggs, from the Latin pascha. Hone describes one boiled hard "within the coat of an onion", and in 1827 a Scots writer has eggs "for the bairns to dye, and row on the braes on Pasch Sunday". In Banffshire in 1834 children played with coloured eggs on "Pace Saturday", and flowers gave the colours: "We eest tae gaither the flooers tae colour oor pess eggs" (Aberdeen, 1958); whin, or gorse, gives yellow. In Preston the rolling moved to Easter Monday, at Avenham Park, where it is said to have begun in 1867 and still goes on.',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book (1826–27), 5 April · Scottish National Dictionary, "Pace" (1827, 1834, 1958 citations) · Preston City Council, "Egg Rolling in Avenham Park" (2024)',
  },
  // ── Beltane ──
  maydew: {
    key: 'maydew', season: 'beltane', name: 'The May Dew', icon: '💧',
    how: 'Before the sun is up on May morning, go out to the grass and wash your face in the dew.',
    outcomes: [
      'The dew is cold enough to make you gasp. Your face glows all morning; whether that is beauty or the cold, who can say.',
      'You are out a little late and the sun has the best of it. Enough left under the hedge for one cheek, and then the other.',
      'A whole meadow of it, grey and silver. You come back soaked to the knee and laughing.',
    ],
    lore: 'Washing the face in dew on May morning was for beauty. Pepys, 28 May 1667: his wife went to Woolwich "to gather May-dew to-morrow morning, which Mrs. Turner hath taught her as the only thing in the world to wash her face with; and I am contented with it." The Morning Post of 1791 still found people bathing their faces in it.',
    tier: 'record',
    source: 'Samuel Pepys, Diary, 28 May 1667',
  },
  beltanecake: {
    key: 'beltanecake', season: 'beltane', name: 'The Beltane Cake', icon: '🔥',
    how: 'On the first of May, cut a square trench in the turf, make a fire, and cook a caudle of eggs, butter, oatmeal and milk. Spill some on the ground. Then each person faces the fire, breaks a knob off the oatmeal cake and throws it over their shoulder.',
    outcomes: [
      '"This I give to thee, preserve thou my sheep." The knob lands soft in the grass. The flocks will do well.',
      '"This to thee, O Fox! spare thou my lambs." A fox barks from the wood, and everyone pretends not to have heard.',
      '"This to thee, O hooded crow!" A crow lifts off the dyke and flaps away east, and the herdsmen take it kindly.',
    ],
    lore: 'Pennant, touring Highland Perthshire in 1769: "On the 1st of May, the herdsmen of every village hold their Bel-tein." The rites began "with spilling some of the caudle on the ground, by way of libation"; the cake had nine knobs, each for a being that preserved the flocks or an animal that destroyed them, and each was thrown over the shoulder: "This I give to thee, O Fox! spare thou my lambs; this to thee, O hooded crow! this to thee, O Eagle!"',
    tier: 'record',
    source: 'Thomas Pennant, A Tour in Scotland, 1769 (1771)',
  },
  // ── Litha ──
  midsummerdoor: {
    key: 'midsummerdoor', season: 'litha', name: "The St John's Eve Door", icon: '🚪',
    how: "On the eve of St John (23 June), shadow the door with green birch, long fennel and St John's wort, garland it with flowers, and set a lamp burning in it all night.",
    outcomes: [
      "The lamp burns till dawn and the St John's wort is still bright in the morning. A good year for the house.",
      'A wind gets up after midnight and the lamp goes out. The birch keeps the door all the same.',
      'Half the street has done the same. The whole lane glows green and gold and nobody goes to bed.',
    ],
    lore: 'Stow, remembering the London of his youth: "On the Vigil of Saint Iohn Baptist … euery mans doore being shadowed with greene Birch, long Fennel, Saint Iohns wort, Orpin, white Lillies, and such like, garnished vpon with Garlands of beautifull flowers, had also Lampes of glasse, with oyle burning in them all the night." St John\'s wort takes its name from the feast it flowers for.',
    tier: 'record',
    source: 'John Stow, A Survey of London (2nd ed., 1603), "Watches in London"',
  },
  hempseed: {
    key: 'hempseed', season: 'litha', name: 'Sowing the Hemp-Seed', icon: '🌱',
    how: 'After dark on Midsummer Eve, go alone and scatter hemp-seed, going through the motions of hoeing it in, and say: "Hemp-seed I sow, hemp-seed I hoe, and he who will my true love be, come after me and mow."',
    outcomes: [
      'You do not look back. You hear, or think you hear, a scythe in the grass behind you, slow and steady.',
      'Nothing behind you but the hedge and the moon. The seed will grow, at least.',
      'You look back too soon, and there is only the farm dog, very pleased to see you.',
    ],
    lore: 'Gay\'s Hobnelia, in 1714: "At eve last Midsummer no sleep I sought, / But to the field a bag of hemp-seed brought," and sowed it saying "This hemp-seed with my virgin hand I sow, / Who shall my true-love be, the crop shall mow." Then: "I strait look\'d back, and if my eyes speak truth, / With his keen scythe behind me came the youth." Hunt (1865), who says it "is not especially a Cornish superstition", gives the words: "Hemp-seed I sow, / Hemp-seed I hoe," the sowing and hoeing to be gone through deliberately, "And he / Who will my true love be, / Come after me and mow." In Scotland it was a Hallowe\'en charm: Burns\'s note has the sower look "over your left shoulder" to see the one invoked "in the attitude of pulling hemp".',
    tier: 'record',
    source: 'John Gay, The Shepherd\'s Week (1714), "Thursday; or, The Spell" · R. Hunt, Popular Romances of the West of England (1865), "Midsummer Superstitious Customs" · Robert Burns, "Halloween" (1785; Kilmarnock edition 1786), with his own notes',
  },
  // ── Lughnasadh ──
  lammasloaf: {
    key: 'lammasloaf', season: 'lughnasadh', name: 'The Lammas Loaf', icon: '🍞',
    how: 'Bake a loaf from the first of the new grain and have it blessed on Lammas Day, the first of August. Take four pieces of it and crumble them into the four corners of the barn.',
    outcomes: [
      "The crumbs go into the corners, and the barn smells of new bread. Not a mouse will get the grain this year.",
      'A mouse is watching from the beam before you are done. You give the fourth corner a little extra.',
      'The new loaf is good: you eat what is left on the step, and the harvest weather holds.',
    ],
    lore: 'Lammas is the Old English hlāf-mæsse, "loaf-mass"; the Anglo-Saxon Chronicle dates by it from the 10th century. A charm in an 11th-century Winchester psalter says to take four pieces of the bread hallowed on Lammas Day and crumble them at the four corners of the barn, with prayers against the mice, to keep the stored grain safe.',
    tier: 'record',
    source: 'British Library, Cotton Vitellius E xviii (mid-11th c.), barn charm · Anglo-Saxon Chronicle, "hlafmæsse"',
  },
  bilberries: {
    key: 'bilberries', season: 'lughnasadh', name: 'Bilberry Sunday', icon: '🫐',
    how: 'On the last Sunday of July or the first of August, climb the hill with everyone else and pick bilberries, and thread some on a straw or a rush for a bracelet for your sweetheart.',
    outcomes: [
      'The hill is blue with them. Everyone comes down with purple mouths; a good sign for the crops, the old ones say.',
      'Thin pickings this year, and the rain comes on. You thread what you have, and it is enough for one bracelet.',
      'Somebody gives you a bracelet before you have finished making yours. You give yours back. The whole hill sees.',
    ],
    lore: 'All over Ireland, on Garland Sunday (also called Bilberry or Fraughan Sunday) at the end of July, people climbed the hills, ate the first of the new food, and picked bilberries; boys strung them on straw or rushes as bracelets for their sweethearts. Máire MacNeill, working from the Irish Folklore Commission\'s questionnaire on Domhnach Chrom Dubh, gathered more than eighty local names for the day, and wrote that "no custom has been more lasting than the picking of bilberries"; she traced the gatherings back to the old festival of Lughnasa.',
    tier: 'folk',
    source: 'M. MacNeill, The Festival of Lughnasa (1962), from the Irish Folklore Commission\'s questionnaire, as R. Sexton gives it (RTÉ Brainstorm, 2025)',
  },
  // ── Mabon ──
  neck: {
    key: 'neck', season: 'mabon', name: 'Crying the Neck', icon: '🌾',
    how: 'When the last of the field is cut, plait the last handful, "the neck". The reapers stand in a ring, and it is held up while they cry "The neck!" three times, then "We yen!" Then run it to the farmhouse.',
    outcomes: [
      'You get in unseen with the neck, so the dairymaid must let you kiss her. She does not seem to mind.',
      'The maid is waiting at the door with a pail. You are soaked to the skin, and the neck too.',
      'The cry carries right across the valley, and another farm answers. The harvest is in.',
    ],
    lore: 'In Devon and Cornwall the last sheaf, "the neck", was held up while the reapers cried "the neck!" three times "in a very prolonged and harmonious tone", then "wee yen!", which an old man told the Devon correspondent meant "we have ended". One of them ran it to the farmhouse: if he got in unseen he might kiss the dairymaid, and if not, he was soused from a pail. "The neck" was hung up in the farmhouse, "where it often remains for three or four years" (Hunt). In 1826 the custom was "beginning to decline"; the Old Cornwall Societies revived it in 1928, and still cry the neck at the end of every summer.',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book, vol. II (1827), 31 August, a letter from north Devon signed R. A. R. · R. Hunt, Popular Romances of the West of England (1865), "Crying the Neck" · St Ives Old Cornwall Society, "Crying the Neck" (2018)',
  },
  michaelmas: {
    key: 'michaelmas', season: 'mabon', name: 'Brambles Before Michaelmas', icon: '🫐',
    how: "Pick the last blackberries before Michaelmas (or Old Michaelmas, 10 October), and not one after: after that, the Devil has spoiled them.",
    outcomes: [
      'You get the last good basket the day before. They make a dark jam that tastes of the whole summer.',
      'You are a day late, and the berries are watery and sour. Whatever the Devil did, he did it.',
      'You leave the last ones on the bush, which is the safest thing; the birds can argue with the Devil.',
    ],
    lore: 'Not to eat blackberries after Michaelmas is a belief found all over Britain and Ireland. Threlkeld, in Ireland in 1727, wrote that "after Michaelmas the D—l casts his club over them"; in Sussex the Devil went round after Old Michaelmas Day and spat on them, in Scotland he threw his cloak over them. In Ireland the berries were good till Samhain, when "the pooka crawls on them". The berries are, in fact, poor by then: grey mould gets into over-ripe fruit "particularly in wet, humid and cool conditions".',
    tier: 'record',
    source: 'C. Threlkeld, Synopsis Stirpium Hibernicarum (1727) · 19th-century Sussex and Scottish records (Opie & Tatem, A Dictionary of Superstitions, 1989) · R. Folkard, Plant Lore, Legends, and Lyrics (1884), "Bramble" · R. Sexton, RTÉ Brainstorm (2025), from the Schools\' Collection',
  },
};

module.exports = { WHEEL_RITES };
