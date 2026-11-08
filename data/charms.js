// ---------------------------------------------------------------------------
// Spoken charms — the charmer's craft.
//
// The commonest cunning folk of all were charmers: someone in the parish who
// could "charm" a burn, stop blood or ease a toothache with a few memorised
// words, usually for no fee. The words below are as recorded; a caller's
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
      'One brought fire and two brought frost.',
      'Out fire and in frost,',
      'In the name of the Father, Son, and Holy Ghost.',
    ],
    use: 'Said over the burn, with bramble or dock leaves wetted in spring water passed over it: "Bramble-leaves, or sometimes the leaves of the common dock, wetted with spring water, are employed in this charm" (Hunt).',
    lore: 'Robert Hunt took this down in Cornwall, where charmers were still consulted in his day. The pattern, angels from the east, fire driven out and frost brought in, turns up across Britain in slightly different words: Courtney (1890) has "Three ladies (or virgins) come from the east", "often said nine times over a scald", and Wright (1913) "Three wise men came from the east" in Shropshire, Devon and Cornwall. The words were kept close: at Zennor "A man would not on any account tell his charm to a woman, or a woman communicate hers to a man", while Courtney heard that a charmer "must never communicate them to one of the same sex". Charmers traditionally took no money, though Courtney knew a Penzance charmer who "made a great deal of money by her profession".',
    tier: 'record',
    source: 'Robert Hunt, Popular Romances of the West of England, 2nd series (1865), §132 "For a Scald or Burn", p. 213, and §125 · M. A. Courtney, Cornish Feasts and Folk-Lore (1890), pp. 146–56 · J. Wright, Rustic Speech and Folk-Lore (1913)',
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
    use: 'Ezekiel 16:6, said over the wound — by tradition the gift was passed on only to someone of the opposite sex.',
    lore: 'The best-known bloodstopping charm in English is a single Bible verse. The folklorist Richard Dorson still found bloodstoppers using it in the lumber country of Michigan’s Upper Peninsula in the 1940s.',
    tier: 'record',
    source: 'Ezekiel 16:6 (King James Version) · Richard M. Dorson, Bloodstoppers and Bearwalkers (1952)',
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
      'and whoever carries these lines shall never have the toothache.',
    ],
    use: 'Written out on paper, folded, and worn round the neck — a charm to carry rather than to say once.',
    lore: 'One of the commonest charms in Britain and Ireland, written out on scraps of paper and carried or worn. A Scottish example, made between 1860 and 1880, is in the Science Museum, mounted under glass. Its first and last lines are given here as written; the dialogue between them is shortened.',
    tier: 'record',
    source: 'Science Museum Group, paper charm against toothache, Scotland, 1860–1880 (co106732)',
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
    lore: 'The Shetland minister of Sandsting and Aithsting set it down about 1841; Orkney records call the thread a "wresting threed" in 1616. Grimm saw in it the oldest charm in German: the Second Merseburg Charm, written in the 10th century, where Wodan heals Balder\'s foal with "ben zi bena, bluot zi bluoda, lid zi geliden": bone to bone, blood to blood, limb to limb, as if glued.',
    tier: 'record',
    source: 'New Statistical Account of Scotland, vol. 15 (1845), Sandsting and Aithsting · Merseburg, Domstiftsbibliothek Cod. 136 (10th c.) · J. Grimm, Deutsche Mythologie (1835), in English as Teutonic Mythology',
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
    lore: 'Coleridge remembered the schoolboys of Christ\'s Hospital saying it; Henderson printed it with the north-country cures, the eel-skin garter and the "cramp-bone" (a sheep\'s knee-cap) carried in the pocket. Kings did it in gold: from Edward II to Mary I, English monarchs blessed cramp rings on Good Friday, "ye whyche rynges worne on ones finger doth helpe them whyche hath the Crampe".',
    tier: 'record',
    source: 'W. Henderson, Notes on the Folk-Lore of the Northern Counties (1879), ch. 5 (from Coleridge, Table-Talk) · Andrew Borde (1542), on the cramp rings',
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
  lore: 'Henderson set down a whole page of wart cures from the north of England: a knot in a hair for every wart, thrown away; in Devonshire an apple cut in two, rubbed on the wart, tied together again and buried, the warts going as the apple rots; a black snail rubbed on them and stuck on a thorn. The honest secret of every wart charm is that most common warts go away on their own in a year or two — so the charm nearly always "worked".',
  tier: 'record',
  source: 'William Henderson, Notes on the Folk-Lore of the Northern Counties of England and the Borders (1866; 1879 ed.), ch. 5',
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
  lore: 'In Cornwall, Hunt found, the little gatherings on children\'s eyelids were cured by the black cat\'s tail passed nine times over the place, "if a ram cat, the cure is more certain". Gold is older: Beaumont and Fletcher\'s lover complains, about 1617, "I have a sty here, Chilax, / I have no gold to cure it."',
  tier: 'record',
  source: 'R. Hunt, Popular Romances of the West of England (1865), "The Black Cat\'s Tail" · Beaumont & Fletcher, The Mad Lover (c. 1617), Act V',
};

// The counted workings (a 'knots' caller step names its `charm`; a wart step
// without one is the wart charm).
const WORKINGS = { warts: WART_CHARM, stye: STYE_CHARM, sprain: null };

module.exports = { CHARMS, WART_CHARM, STYE_CHARM, WORKINGS };
