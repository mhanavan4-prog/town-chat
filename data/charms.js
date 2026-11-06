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
    use: 'Said over the burn, with bramble or dock leaves wetted in spring water laid on it.',
    lore: 'Robert Hunt took this down in Cornwall, where charmers were still consulted in his day. The pattern — angels from the east, fire driven out and frost brought in — turns up across Britain in slightly different words.',
    tier: 'record',
    source: 'Robert Hunt, Popular Romances of the West of England (1865), "Charms"',
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

module.exports = { CHARMS, WART_CHARM };
