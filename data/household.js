// ---------------------------------------------------------------------------
// The house and the hive — household customs of the British and Irish record,
// worked as caller rites (any time of year): telling the bees, silver water for
// the evil eye, rowan and red thread on the byre, the hagstone, and the
// customs when someone is dying in the house. `how` follows the sources; the
// outcomes are the game's readings of what people looked for. Ids are stable.
//
// Sources were checked against: Chambers, Book of Days (1864); Notes and
// Queries (1851); J. G. Campbell, Witchcraft and Second Sight in the Highlands
// (1902); the Carmichael Watson papers; the Pitt Rivers Museum (1884.56.3);
// T. F. Thiselton Dyer, Domestic Folk-Lore (1881) and The Ghost World (1893);
// M. Martin, A Description of the Western Islands of Scotland (1703); J. G.
// Frazer, Balder the Beautiful (1913); the Indiculus superstitionum (8th c.);
// R. Kirk, The Secret Common-Wealth (1691); Pitcairn (1833) for Isobel Gowdie;
// M. Dowd, "Bewitched by an Elf Dart" (2018).
// ---------------------------------------------------------------------------
// `against: true` marks counter-magic: what people did against a witch they
// believed had harmed them. Those are written into the Charm Book's own
// chapter, Against the Witch, whose intro names what it could cost.
const HOUSEHOLD_RITES = {
  telling_bees: {
    key: 'telling_bees', name: 'Telling the Bees', icon: '🐝',
    how: 'Go to every hive, knock on it with the house key, and tell the bees who has died; pin a piece of black crape to each, and ask them to the funeral.',
    outcomes: [
      'The hum rises at your knock, then settles low and steady. They have heard, and they will stay.',
      'A single bee walks out onto the crape and sits a while. The old folk would call that an answer.',
      'Nothing for a long moment; then, deep in the hive, the hum begins again. They are in mourning too.',
    ],
    lore: 'In Suffolk, Chambers wrote in 1864, people would "formally impart the fact to the bees", invite them to the funeral and "fix a piece of crape upon their hives"; bees bought at a dead man\'s sale sickened until someone put them in mourning. In Yorkshire the funeral messenger asked the bees too (1851), and in Devon in 1790 the hives were turned round as the coffin left. Untold, they would leave or die.',
    tier: 'record',
    source: 'R. Chambers, The Book of Days (1864), 7 June · Notes and Queries (25 October 1851)',
  },
  // The king's evil: scrofula, touched by the monarch till Queen Anne, and in
  // the villages by the seventh son. The practical half is the milk.
  kings_evil: {
    key: 'kings_evil', name: "The Seventh Son's Touch", icon: '🪙',
    how: "Bring the seventh son to stroke the swelling with his hand, and hang the old touch-piece round the child's neck on its ribbon, as the kings and queens did.",
    outcomes: [
      'He strokes the swelling three times, red to the ears. The child laughs at him.',
      'The old gold angel goes round her neck on its ribbon. Her mother breathes as if a weight has gone.',
      'Nothing to see and nothing to feel; the swelling is as it was. Her mother holds the coin tight.',
    ],
    lore: 'The king\'s evil was scrofula, "swollen and discharging tuberculous lymph glands of the neck". For centuries the kings and queens of England touched for it: the sufferer knelt, the monarch touched the swelling and hung a gold angel, "pierced and threaded on a ribbon", round their neck. Charles II is reckoned to have touched over 105,000 people. Queen Anne was the last; the Hanoverians did not touch. Samuel Johnson, not yet three, was taken to London on a physician\'s advice and "actually touched by Queen Anne"; he kept "a confused, but somehow a sort of solemn recollection of a lady in diamonds, and a long black hood". "This touch, however, was without any effect." The gift was said to pass to the seventh son as well: a 17th-century note says the kings of England and France cure the evil by touching, "and so doth the seaventh sonne".',
    tier: 'record',
    source: 'Royal College of Physicians, "Touching for \'the King\'s evil\': a short history" (2019) · Royal Collection Trust, RCIN 443149 · J. Boswell, Life of Johnson (1791), ed. G. B. Hill (1887), vol. I · Notes and Queries (22 February 1851)',
  },
  silver_water: {
    key: 'silver_water', name: 'Silver Water', icon: '🥈',
    how: 'Fill a bowl with clean water and put a silver sixpence in it. If the coin sticks to the bowl, the eye has been on the child. Sprinkle the child three times with the silver water.',
    outcomes: [
      'The sixpence slides free when you tip the bowl. No eye has been on her; it will be her teeth.',
      'The coin will not slide; it clings to the bottom. Overlooked, they say. You sprinkle her three times.',
      'The water clouds a little as the coin goes in. You sprinkle her three times, to be sure.',
    ],
    lore: 'In the Highlands a child or a cow that sickened might be "forspoken" or overlooked: harmed by a look or by too much praise. The test, as J. G. Campbell gives it: "She fills a bowl with clean water, into which she puts a silver sixpence"; if it sticks, "the child is the victim of an evil eye". In Barra the cure was to "place silver in the dish & sprinkle this 3 times".',
    tier: 'record',
    source: 'J. G. Campbell, Witchcraft and Second Sight in the Highlands (1902) · A. Carmichael, notes (John Cameron of Barra)',
  },
  // The changeling wife: the old test, "who are you?", asked once and gently,
  // and the 1895 death of Bridget Cleary, which is what the belief could do.
  // Nothing harmful is ever done in the game.
  changeling_wife: {
    key: 'changeling_wife', against: true, name: 'Ask Her Name', icon: '🧚',
    how: 'Sit by her bed in daylight, with the door open and her mother there, and ask her plainly who she is. Ask once. Nothing else is done.',
    outcomes: [
      '"I\'m Kathleen Doyle, and who else would I be?" she says, and asks for a drink of water.',
      'She answers to her name, hoarse with the cough, and turns her face to the wall, worn out.',
      'She laughs at the question, coughs, and laughs again. "Is it himself put you up to this?"',
    ],
    lore: 'Changelings: the fairies were believed to take people, young wives and children above all, and leave something in their place that was sickly and not itself. The test was to ask in God\'s name who they were, and some went further, with herbs, threats and fire. In March 1895, at Ballyvadlea in Co. Tipperary, Bridget Cleary, a dressmaker of twenty-six who kept hens, fell ill with bronchitis. The doctor found "nervous excitement and a slight bronchitis" and nothing likely to cause death. Her husband Michael came to believe she was a fairy. She was forced to take herbs from a fairy doctor, held over the fire and asked "Are you Bridget Cleary, wife of Michael Cleary, in the name of the Father, Son, and Holy Ghost?", and on the night of 15 March he set her clothes alight and she died. He said she would come riding out of the fort at Kylenagranagh among the fairies. He was convicted of manslaughter and given twenty years. Tipperary children made a rhyme of it: "are you a witch, or are you a fairy, or are you the wife of Michael Cleary?"',
    tier: 'record',
    source: 'A. Bourke, "Cleary, Bridget", Dictionary of Irish Biography (2009) · M. J. F. McCarthy, Five Years in Ireland, 1895–1900 (1901) · National Folklore Collection, Schools\' Collection, vol. 0583, p. 161 · A. Bourke, The Burning of Bridget Cleary (1999)',
  },
  rowan_thread: {
    key: 'rowan_thread', name: 'Rowan and Red Thread', icon: '🔴',
    how: 'Bind a sprig of rowan with red thread and hang it over the byre door; tie another into the cow\'s tail.',
    outcomes: [
      'The red thread shows bright against the dark wood of the door. Nothing ill will cross under it.',
      'The cow flicks her tail and the rowan stays put. She lets down her milk like a lamb.',
      'A neighbour passing sees the red thread over the door and says nothing at all, which tells you plenty.',
    ],
    lore: '"Rowan-tree and red thread / Put the witches to their speed," the Scottish rhyme ran; in the Highlands it "gars a\' the witches dance to dead". The rowan and red thread were the gentle cure. The other was a crime: "scoring above the breath", cutting the suspected witch\'s forehead to draw her blood. A man was tried for it in 1700, and a woman was cut so in 1831.',
    tier: 'record',
    source: 'Popular Science Monthly, vol. 34 (1889) · J. G. Campbell (1902) · Kelso Chronicle (10 July 1863)',
  },
  // Dried cats: found sealed in walls, floors and roofs. The finds are real and
  // in museums; why they were put there nobody wrote down.
  dried_cat: {
    key: 'dried_cat', name: 'The Dried Cat', icon: '🐈',
    how: 'Look at how it lay and which way it faced, mark the place exactly, and lay it back under the stone as it was found. Do not clean it.',
    outcomes: [
      'It lay curled toward the hearth, a rat between its teeth. You mark the place, and it goes back under the stone.',
      'Only a cat, flat as old leather, no rat and no sign of hands. Perhaps it crept in; perhaps not. It goes back.',
      'Its legs are set out as if it were stalking, which no cat does dying. Somebody placed it. It goes back.',
    ],
    lore: 'Dried cats turn up in the walls, under the floors and in the roofs of old buildings: well over a hundred are on record, and many more are told of. In 1951 Margaret Howard weighed three reasons: a sacrifice for the building, a scare for the rats and mice, or a cat that crept into a cavity and died. Some certainly crept in; one at Worcester seems to have crawled in to give birth. Others were posed after death as if hunting, which no cat does by itself: Sir John Soane kept two cats and a rat in a glass case, one cat from a house at Lothbury pulled down in 1803. At the Mill Hotel in Sudbury a cat found in 1971 was put back in 1975 "after four years of eventful absence". Nobody wrote down why a cat was put in a wall. That is the honest gap.',
    tier: 'record',
    source: 'M. M. Howard, "Dried Cats", Man 51 (1951) · B. Hoggard, Magical House Protection (2019) · Sir John Soane\'s Museum, BL1 · Mill Hotel, Sudbury, plaque (1975)',
  },
  hagstone: {
    key: 'hagstone', name: 'The Hagstone', icon: '🪨',
    how: 'Find a stone with a hole worn right through it and hang it on a nail by the stable door, or over the bed, so that the hag cannot ride the horses, or you, by night.',
    outcomes: [
      'In the morning the horses are dry and calm, their manes untangled. The stone turns a little on its nail.',
      'One mare is still sweating at dawn. You hang a second stone, and a horseshoe besides.',
      'You sleep the whole night through without the weight on your chest. The stone stays.',
    ],
    lore: 'A horse found sweating and tangle-maned in the morning had been ridden in the night by the hag, the mare that also sat on sleepers\' chests. A "self-holed" stone kept her off. Aubrey (1696) has the flint "with a hole in it (naturally)" hung "by the Manger" to keep "the Hag from riding their Horses, who will sometimes sweat all Night". One "found fixed on a nail to the cottage-door" of a carter at Rushmore, on the Wiltshire–Dorset border, "to keep away witches", was collected in 1880–81 and is in the Pitt Rivers Museum. Witch balls are later: nobody called them protective in print until the 1930s.',
    tier: 'record',
    source: 'Pitt Rivers Museum, 1884.56.3 (Rushmore, 1880–81) · J. Aubrey, Miscellanies (1696), ch. XIII · S. Butler, Hudibras ("sickle, horse-shoe, hollow flint")',
  },
  // The pinned heart: Somerset counter-magic against a witch blamed for dead
  // beasts (Elworthy, 1895), told with the harm it led to and what really
  // kills a run of pigs.
  pinned_heart: {
    key: 'pinned_heart', against: true, name: 'The Pinned Heart', icon: '📌',
    how: 'Stick the heart full of pins and white thorns, as Elworthy\'s Somerset people did, and hang it up the chimney to wither in the smoke.',
    outcomes: [
      'The heart goes up the chimney on a nail. Nobody comes to the door that night, or the next.',
      'Old Mrs Hext does come by, for the loan of some salt. Ellen goes white. You give the woman her salt.',
      'The thorns go in hard. Ellen says the words her grandmother said over it, then sits down and cries.',
    ],
    lore: 'Somerset counter-magic, as F. T. Elworthy recorded it in 1895: when beasts died and a witch was blamed, the heart of one of them was "stuck full of pins and white thorns" and put up the chimney, "in the belief that as the heart dried and withered so would that of the malignant person". Others threw it on the fire and sat waiting for the witch to come and ask why they were hurting her; on Mendip a sheep\'s heart was roasted with "It is not this heart I mean to burn, / But the person\'s heart I wish to turn". One was found in a chimney at Ashbrittle in 1882, and the county museum at Taunton had "more than one heart, said to be those of pigs". The Pitt Rivers keeps a sheep\'s heart stuck with pins and nails, a model of those used in South Devon for "breaking evil spells".',
    tier: 'record',
    source: 'F. T. Elworthy, The Evil Eye (1895), ch. II · Pitt Rivers Museum 1911.75.1',
  },
  death_house: {
    key: 'death_house', name: 'Opening the Door', icon: '🕯️',
    how: 'When the dying are struggling, unfasten every lock and bolt and set the doors open; when they are gone, set a plate of salt on the breast, stop the clock and cover the looking-glass.',
    outcomes: [
      'You draw the last bolt and the house goes quiet. A little after, the breathing stops, easy.',
      'The door stands open to the night air. The family sit up together till morning, and the clock says nothing.',
      'The salt on its plate, the glass covered with a cloth. The house holds still, as it should.',
    ],
    lore: 'If a dying person "struggled hard and long", Napier wrote of the west of Scotland in 1879, "it was therefore customary, under these circumstances, for the attendants to open every lock in the house, that the spell might be broken, and the spirit let loose." In Exeter in 1850 "any bolt or lock fastened was supposed to cause uneasiness to, and hinder the departure of the soul" (Notes and Queries), and Thiselton Dyer called it "a superstition common in France, Germany, Spain, and England" (1893). After the death "The clock was stopped, the looking-glass was covered with a cloth", by many "without their knowing the reason why" (Napier); at a Border lykewake the glass was shrouded "to intimate that all vanity, all care for earthly beauty, are over with the deceased", and the clock "to show that with him time is over" (Henderson, 1879). When the body was laid out a plate of salt went on the breast, "ostensibly to prevent the body swelling" (Napier), or "to keep the evil spirits away" (Gregor, 1881); Pennant reported a wooden platter of salt and earth in the Highlands (1771). The notion that the glass might catch the soul is a scholar\'s: Frazer\'s, in 1890.',
    tier: 'record',
    source: 'J. Napier, Folk Lore, or Superstitious Beliefs in the West of Scotland (1879), ch. IV · Notes and Queries (16 March 1850) · T. F. Thiselton Dyer, The Ghost World (1893) and Domestic Folk-Lore (1881) · W. Henderson, Notes on the Folk-Lore of the Northern Counties (1879) · W. Gregor, Notes on the Folk-Lore of the North-East of Scotland (1881), ch. XXVII · T. Pennant, A Tour in Scotland (1771) · J. G. Frazer, The Golden Bough (1890)',
  },
  // The second sight (taibhsearachd): M. Martin, "An Account of the Second-Sight"
  // (1703); R. Kirk (1691); S. Johnson, Journey to the Western Islands (1775).
  second_sight: {
    key: 'second_sight', name: 'The Second Sight', icon: '👁️',
    how: 'Hear the seer out, and do not scoff. Ask where the shroud reached: below the middle, Martin says, no death is looked for within the year; up toward the head, within days. Then counsel her to keep it to herself.',
    outcomes: [
      'She saw it to his knee and no higher. By the old reckoning, a year and more. She will keep it to herself.',
      'It was only a mist about him at the peat-stack, she says now. Not a shroud. Not yet anything at all.',
      'The vision fades as she tells it. She cries a little, and says it is a relief to have told someone.',
    ],
    lore: 'The second sight, Martin wrote in 1703, "is a singular faculty of seeing an otherwise invisible object, without any previous means used by the person that sees it". "When a shroud is perceived about one, it is a sure prognostic of death": below the middle, not within the year; toward the head, within days. It did not run in families, he found, and could not be passed on. A seer (taibhsear) often wanted rid of it; Kirk says one would be "glaid … quite of such, for the hideous Spectacles". Samuel Johnson went looking for it in 1773 and "came away at last only willing to believe."',
    tier: 'record',
    source: 'M. Martin, A Description of the Western Islands of Scotland (1703), "An Account of the Second-Sight" · R. Kirk, The Secret Common-Wealth (1691) · S. Johnson, A Journey to the Western Islands of Scotland (1775)',
  },
  // The shewstone: scrying in a stone, glass or water, from Dee's obsidian
  // mirror to the village cunning man's glass, and the harm a name could do.
  shewstone: {
    key: 'shewstone', against: true, name: 'The Shewstone', icon: '🔮',
    how: 'Set the glass on a dark cloth by one candle, and let the one who asks look into it, not you. Say nothing, and ask only: what do you see?',
    outcomes: [
      'She sees a face in the glass, and it is the face she came in suspecting. She has the name out before you can stop her.',
      'Only the candle, and her own eyes looking back. She is angry at first, then quiet.',
      'A shape like a woman in a shawl, that could be anyone in the parish. She wants it to be one woman.',
    ],
    lore: 'Scrying is looking into a stone, glass or water until something shows. John Dee\'s "shew-stone", a polished mirror of black obsidian, is in the British Museum: it was made in Mexico, of obsidian from Pachuca, and Horace Walpole labelled it "The Black Stone into which Dr Dee used to call his Spirits". Dee did not look himself; his scryers did, Edward Kelley above all. Reginald Scot (1584) copied out "How to enclose a spirit in a christall stone" only to expose it. Village cunning folk used a mirror, a crystal or a bowl of water and let the client look, so the client saw the culprit and they never had to name anyone. Finding lost or stolen goods by such arts was an offence under the Witchcraft Acts from 1542; from 1736 it was punished as a pretence.',
    tier: 'record',
    source: 'British Museum 1966,1001.1 · S. Campbell et al., Antiquity 95 (2021) · R. Scot, The Discoverie of Witchcraft (1584), XV.12 · O. Davies, Cunning-Folk (2003) · Witchcraft Acts 1542, 1563, 1604 and 1736',
  },
  need_fire: {
    key: 'need_fire', name: 'The Need-Fire', icon: '🔥',
    how: 'Put out every fire in the township, your own hearth too. Rub two planks together, the men taking turns, until the wood catches; drive the sick cattle through the smoke, and carry the new fire home to light every hearth again.',
    outcomes: [
      'The planks smoke, then catch. The cattle go through the reek, the sick ones twice, and every hearth is lit anew.',
      'Three changes of men before the wood catches. Then the beasts are driven through, and embers carried home in pots.',
      'The fire comes fast. The smoke lies low over the byres, and the children carry new fire home in a clay pot.',
    ],
    lore: 'The need-fire, in Gaelic tein-éigin, was "a forced fire, or fire of necessity" against plague or murrain (Martin, 1703). Every fire in the parish was put out; eighty-one married men, by turns, rubbed two planks together till they kindled; each family took new fire home, and water heated on it was sprinkled on the sick people and cattle. Frazer gathered cases from Scotland, England, Ireland and Germany into the 19th century; on Mull a sick heifer was cut in pieces and burnt in it. The word is old: "nodfyr" stands in a list of pagan practices from the 740s.',
    tier: 'record',
    source: 'M. Martin, A Description of the Western Islands of Scotland (1703) · J. G. Frazer, Balder the Beautiful (1913), vol. 1 · Indiculus superstitionum, no. 15',
  },
  // Witch posts: carved oak heck posts of the North York Moors. The objects are
  // real and in museums; what they were for is honestly not known, and the
  // stories of the witch and the crooked sixpence were written down late.
  witch_post: {
    key: 'witch_post', against: true, name: 'The Witch Post', icon: '🪵',
    how: 'Wash the last of the lime off the post by the hearth, read what is cut in it, the cross and whatever else, and put the crooked sixpence back in its hole.',
    outcomes: [
      'A cross like St Andrew\'s, three bands under it, and a worn date. The sixpence goes back in its hole, bent as it came.',
      'Under the lime, oak gone black with three hundred years of smoke. The cross is there, and the coin.',
      'The cross, a heart below it, and the hole. The family stand round the hearth and nobody says anything.',
    ],
    lore: 'Witch posts are oak posts beside the hearth in old farmhouses of the North York Moors: the heck post, at the end of the screen by the fire, which carried the smoke hood, carved at the top with a St Andrew\'s cross. Only about twenty are known, nearly all from the Moors and Cleveland; Ryedale Folk Museum has three. One at Postgate Farm, Glaisdale, was dated 1664. The Pitt Rivers Museum took one from near Scarborough in 1884, carved, its entry says, with a cross, a heart stuck with pins and phases of the moon, "for the purpose of keeping off fairies". Later tellers said a witch could not pass the cross, and that a crooked sixpence kept in a hole in the post was dug out and dropped in the churn when the butter would not come. What they were really for is not known: some think them the marks of Catholic households in the 1600s, others plain decoration.',
    tier: 'folk',
    source: 'Ryedale Folk Museum, "Witch Posts" (2020) · Pitt Rivers Museum 1884.56.1 · Whitby Museum, "The Witch Post" (2020) · Historic England, list entry 1148581 (Postgate Farmhouse, Glaisdale)',
  },
  elf_shot: {
    key: 'elf_shot', name: 'Elf-Shot', icon: '🏹',
    how: 'Find the hole in the hide with your finger, as Kirk says the cure is. Then drop the elf-arrow, a little flint arrowhead turned up in the field, into a bowl of water, and give the beast the water to drink.',
    outcomes: [
      'Your finger finds no hole, only hot, tight skin. The cow drinks the elf-water slowly, then lows once.',
      'There is a little sore on her flank, as if from a dart. She drinks the arrow-water and gets to her feet.',
      'The flint goes into the bowl with a click. The heifer drinks it all, and the household breathes again.',
    ],
    lore: 'A beast that dropped suddenly was "Elf-shot": the fairies\' arrows, Kirk wrote in 1691, were "solid earthly Bodies, nothing of Iron, but much of Stone, like to yellow soft Flint Spa, shaped like a barbed Arrow-head". Isobel Gowdie confessed in 1662 that "we haw no bow to shoot with, but spang them from the naillis of our thowmbes." The cure was to find the hole, or touch the beast with an elf-arrow, or make it drink water one had been dipped in; some were set in silver as amulets. The arrows were real: Neolithic and Bronze Age flint arrowheads, turned up by the plough. "Ylfa gescot", elves\' shot, is already in an Old English charm.',
    tier: 'record',
    source: 'R. Kirk, The Secret Common-Wealth (1691) · I. Gowdie (1662), in R. Pitcairn, Ancient Criminal Trials, vol. 3 (1833) · T. Pennant, A Tour in Scotland (1771) · M. Dowd, Cambridge Archaeological Journal 28 (2018) · Lacnunga (c. AD 1000), "Wið færstice"',
  },
  // The toadman's bone: East Anglian horsemen's magic, gathered by George Ewart
  // Evans from the last of the horsemen, with the Scots Horseman's Word beside
  // it. Tier "folk": it comes to us from living memory, written down in the
  // 20th century. The working secret, most think, was the horse's nose.
  toad_bone: {
    key: 'toad_bone', name: "The Toadman's Bone", icon: '🐸',
    how: "Take the bone from the twist of cloth the old horseman left, rub a little of his oil on your palm, and stand at the mare's head, quiet, with your hand where she can smell it.",
    outcomes: [
      'The mare blows at your hand, smells the oil, and stands. Tom lets out the breath he was holding.',
      'She throws her head and backs; then, slowly, puts her nose to your palm and lets you take the collar.',
      'Nothing at first. Then her ears come round to you, and she leans her head on your shoulder.',
    ],
    lore: 'The toadmen of East Anglia had power over horses by a bone. A toad was killed and left on a whitethorn or an anthill till it was picked clean, and the bones were put in a running stream at midnight: "All will sink but one single bone and that will swim up stream" (Rolfe, 1935). Whoever kept it must not look away, whatever noises came. Carried, or ground and mixed with oils, it could stop a horse dead or draw it. In the north-east of Scotland the Society of the Horseman\'s Word took lads in by night, usually at Martinmas, gave them the Word, "Both in One", and a shake of "the Devil\'s hand", a stick covered with hairy skin. Most who have looked at it since George Ewart Evans, who talked to the last horsemen, think the working secret was the horse\'s nose: scents to draw it, smells to stop it.',
    tier: 'folk',
    source: 'G. E. Evans, The Pattern Under the Plough (1966) and Horse Power and Magic (1979) · F. Rolfe, I Walked by Night, ed. L. Rider Haggard (1935) · J. Porter, "Popular Traditions in the Modern Period", Northern Folk (Elphinstone Institute, Aberdeen) · Museum of English Rural Life (2021)',
  },
};

module.exports = { HOUSEHOLD_RITES };
