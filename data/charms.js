// ---------------------------------------------------------------------------
// Spoken charms — the charmer's craft.
//
// The commonest cunning folk of all were charmers: someone in the parish who
// could "charm" a burn, stop blood or ease a toothache with a few memorised
// words, some for nothing and some for a fee. The words below are as recorded; a caller's
// working has you say a charm line by line, in order, on the Town Board.
//
// Honesty line: the game's callers pair every charm with the sound practical
// half of the cure (cold water on a scald, a tight binding and the surgeon for
// a wound) — the charm is lore, not medicine.
// ---------------------------------------------------------------------------
const CHARMS = {
  burn: {
    key: 'burn',
    name: 'the charm for a burn',
    icon: '🔥',
    title: 'For a Scald or Burn',
    lines: [
      'There came three angels out of the east,',
      'One brought fire and two brought frost;',
      'Out fire and in frost,',
      'In the name of the Father, Son, and Holy Ghost.',
    ],
    use: 'Said over the burn, with bramble or dock leaves wetted in spring water: "Bramble-leaves, or sometimes the leaves of the common dock, wetted with spring water, are employed in this charm" (Hunt, who ends it "Amen!").',
    lore: 'Robert Hunt took this down in Cornwall, where charmers were still consulted in his day. The pattern, angels from the east, fire driven out and frost brought in, turns up across the West Country in slightly different words: Bottrell (1873) and Courtney (1887) have "Three ladies come from the east, / One with fire and two with frost", and Courtney\'s charmer said it "nine times over a scald". The words were kept close: at Zennor "A man would not on any account tell his charm to a woman, or a woman communicate hers to a man", while Courtney heard that a charmer "must never communicate them to one of the same sex". Nor was it always done for nothing. Courtney\'s Uncle Will Jelbart "made a good income by charming warts, wildfire (erysipelas), cataracts, &c.", and a Penzance charmer "made a great deal of money by her profession".',
    tier: 'record',
    source: 'Robert Hunt, Popular Romances of the West of England, 2nd series (1865), §132 "For a Scald or Burn", p. 213, and §125 "The Zennor Charmers" · W. Bottrell, Traditions and Hearthside Stories of West Cornwall, vol. 2 (1873) · M. A. Courtney, "Cornish Folk-Lore", The Folk-Lore Journal 5 (1887), the basis of her Cornish Feasts and Folk-Lore (1890)',
  },
  blood: {
    key: 'blood',
    name: 'the blood charm',
    icon: '🩸',
    title: 'The Blood Verse',
    lines: [
      'And when I passed by thee,',
      'and saw thee polluted in thine own blood,',
      'I said unto thee when thou wast in thy blood,',
      'Live.',
    ],
    use: 'Ezekiel 16:6, said over the wound. American bloodstoppers say it three times with the bleeder\'s full name, and hand it on man to woman to man; the Cornish charmers of Zennor kept theirs from the other sex altogether.',
    lore: 'In American folk tradition the bloodstopper\'s charm is a single Bible verse, Ezekiel 16:6, "I said unto thee when thou wast in thy blood, Live", and the folklorist Richard Dorson, working in Michigan’s Upper Peninsula in 1946, still found people gifted, as his publisher puts it, "with the lifesaving power to stop the flow of blood". English charmers had their own words. In Cornwall, Hunt\'s Zennor charmers said "Christ was born in Bethlehem; / Baptized in the river Jordan" over a wound, naming the patient, and "A man would not on any account tell his charm to a woman, or a woman communicate hers to a man."',
    tier: 'record',
    source: 'Ezekiel 16:6 (King James Version) · Richard M. Dorson, Bloodstoppers and Bearwalkers (1952) · R. Hunt, Popular Romances of the West of England (1865; 3rd ed. 1903), "The Zennor Charmers"',
  },
  tooth: {
    key: 'tooth',
    name: 'the toothache charm',
    icon: '🦷',
    title: 'Peter on the Marble Stone',
    lines: [
      'In the name of the Lord God,',
      'Peter sat on a marble stone weeping.',
      'Christ came by, and asked him what ailed him, and healed him;',
      'and not only thee but all them that carries these lines for my sake shall never have the toothache.',
    ],
    use: 'Written out on paper and worn round the neck — a charm to carry rather than to say once.',
    lore: 'One of the most widespread charms of all, written out on scraps of paper and carried or worn. The oldest complete Latin texts are of the eleventh century; an English one, as Ķencis prints it from Roper, runs "Christus super marmoreum sedebat petrus tristes ante eum stabat". A Scottish example, made between 1860 and 1880 for a Mary McLeod, is in the Science Museum, mounted under glass; "this charm was to be worn around the neck". Harland and Wilkinson\'s Lancashire Folk-lore (1867) gives a section to "Charms for the Toothache", and Lady Wilde (1887) has an Irish rhyming version, "As Peter sat on a marble stone, / The Lord came to him all alone", "to be sewn on the clothes". Its first and last lines are given here as the Scottish paper has them; the dialogue between them is shortened.',
    tier: 'record',
    source: 'Science Museum Group, paper charm against toothache, Scotland, 1860–1880 (co106732) · J. Harland and T. T. Wilkinson, Lancashire Folk-lore (1867), "Charms for the Toothache", p. 75 · Lady Wilde, Ancient Legends, Mystic Charms, and Superstitions of Ireland (1887) · T. Ķencis, "St. Peter\'s Routes in Latvia: The Case of Super Petram Charm-Type", Incantatio 3 (2013), pp. 100–108',
  },
  sprain: {
    key: 'sprain',
    name: 'the sprain charm',
    icon: '🦶',
    title: 'For a Sprain: the Wresting Thread',
    lines: [
      'The Lord rade, and the foal slade;',
      'He lighted, and he righted,',
      'Set joint to joint, bone to bone, and sinew to sinew.',
      'Heal in the Holy Ghost\'s name.',
    ],
    use: 'Said low, so the bystanders cannot hear, while a thread of black wool cast with nine knots is tied round the sprained leg or arm.',
    lore: 'The New Statistical Account (1845) records it in Sandsting and Aithsting, Shetland: "a thread spun from black wool, on which are cast nine knots", tied round the sprain while the operator speaks "in such a tone of voice as not to be heard by the bystanders". In Orkney in 1616 Katherine Caray was tried for making "a wresting thread" in the name of the Trinity, which "wald mak ony wrest of man or beast haill" (Dalyell, from the Orkney records). Grimm, reading the wresting thread in Chambers (1842), set it beside the Second Merseburg Charm, a heathen spell written into a manuscript in the 10th century, where Phol and Wodan ride to the wood, Balder\'s foal sprains its foot, and the goddesses charm it and then Wodan, "so he uuola conda", as he well knew how: "ben zi bena, bluot zi bluoda, lid zi geliden, sose gelimida sin": bone to bone, blood to blood, limb to limb, as if glued. What was "told in a heathen spell in Thuringia before the tenth century", Grimm wrote, was still found "in conjuring formulas known to the country folk of Scotland and Denmark".',
    tier: 'record',
    source: 'New Statistical Account of Scotland, vol. 15 (1845), Sandsting and Aithsting · J. G. Dalyell, The Darker Superstitions of Scotland (1834) · Merseburg, Domstiftsbibliothek Cod. 136 (10th c.) · J. Grimm, Deutsche Mythologie (1835), in English as Teutonic Mythology',
  },
  cramp: {
    key: 'cramp',
    name: 'the cramp charm',
    icon: '🦵',
    title: 'For the Cramp',
    lines: [
      'The devil is tying a knot in my leg,',
      'Matthew, Mark, Luke, and John unloose it, I beg;',
      'Crosses three we make to ease us,',
      'Two for the thieves, and one for Christ Jesus.',
    ],
    use: 'Said with three crosses made over the leg. Schoolboys bathing in the Wear tied an eel-skin round the left leg as well.',
    lore: 'Coleridge, in his Table-Talk, recorded "the approved mode of procedure in Christ\'s Hospital": the boy would "get out of bed, stand firmly on the leg affected", and cross it, "thrice repeating this formula". Henderson printed it with the north-country cures: "For cramp our Durham remedy is to garter the left leg below the knee"; "An eel\'s skin worn about the naked leg is deemed a preventive too, especially by schoolboys"; and the "cramp-bone" of a leg of mutton, "the patella or knee-cap". Kings blessed cramp rings in silver and gold. Edward II\'s household already offered on Good Friday "to make rings to give for medicine to divers folk", and Borde wrote in 1542 that "The Kinges of Englande doth halowe euery yere Crampe rynges", worn on the finger; Mary I was the last to bless them.',
    tier: 'record',
    source: 'W. Henderson, Notes on the Folk-Lore of the Northern Counties (1879), chs. 1 and 5 (from Coleridge, Table-Talk) · A. Borde, The Fyrst Boke of the Introduction of Knowledge (1542), ch. 1 · H. Farquhar, "Royal Charities", British Numismatic Journal 12 (1916)',
  },
};

// Charming warts — not words but a working: a knot for every wart, the thread
// thrown away or buried, and the warts go as it rots. Worked as a caller's
// 'knots' step (one knot per wart); remembered in charmsSaid as 'warts'.
const WART_CHARM = {
  key: 'warts',
  name: 'the wart charm',
  icon: '🪢',
  title: 'Charming Warts',
  use: 'Count the warts; tie as many knots in a hair or a thread, touching a wart with each; then throw it away or bury it — as it rots, they go.',
  lore: 'Henderson\'s Northumbrian schoolboy had "the choice of several modes of relief": "as many knots in a hair as there are warts on the hands", thrown away; a large black snail rubbed on them and thrown against a thorn hedge; an apple cut in two, rubbed on, tied together and buried, "confident that as the apple decays the warts will disappear", and "This, too, is done in Devonshire". In Cornwall, Hunt found, the knots were tied in a string, "each wart being carefully touched with the knot dedicated to it", and the string was buried. The honest secret of every wart charm is that warts usually go away on their own, though it can take months or even years, so the charm nearly always "worked".',
  tier: 'record',
  source: 'W. Henderson, Notes on the Folk-Lore of the Northern Counties of England and the Borders (1866; 1879 ed.), ch. V · R. Hunt, Popular Romances of the West of England (1865; 3rd ed. 1903), "Cures for Warts" · F. Bacon, Sylva Sylvarum (1626), no. 997, as Henderson quotes it · Cochrane review CD001781 (2003, as "Local treatments for cutaneous warts"; 2012, Kwok et al.) · NHS, "Warts and verrucas"',
};

// Charming a stye — another counted working (like the wart knots): stroke it
// with the tail of a black cat nine times, as they did in Cornwall; gold was
// the older cure. Remembered in charmsSaid as 'stye'.
const STYE_CHARM = {
  key: 'stye',
  name: 'the stye charm',
  icon: '🐈‍⬛',
  title: 'Charming a Stye',
  use: 'Pass the tail of a black cat nine times over the stye (a tom cat\'s is surer); or, the older way, rub it with gold.',
  lore: 'Hunt, in Cornwall: "Those little gatherings which occur on the eye-lids of children, locally called \'wilks,\' are cured by passing a black cat\'s tail nine times over the place. If a ram cat, the cure is more certain." Gold is older. In Fletcher\'s Mad Lover, played at court in January 1617, the Fool angles for a coin: "I have a Stye here, Chilax." Chilax, who has gold in his purse, won\'t take the hint: "I have no Gold to cure it, not a penny."',
  tier: 'record',
  source: 'R. Hunt, Popular Romances of the West of England (1865), "The Black Cat\'s Tail" · J. Fletcher, The Mad Lover (acted 1617; Beaumont and Fletcher folio, 1647), Act V',
};

// The counted workings (a 'knots' caller step names its `charm`; a wart step
// without one is the wart charm).
const WORKINGS = { warts: WART_CHARM, stye: STYE_CHARM, sprain: null };

module.exports = { CHARMS, WART_CHARM, STYE_CHARM, WORKINGS };
