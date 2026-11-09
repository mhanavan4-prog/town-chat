// ---------------------------------------------------------------------------
// Hallowe'en rites — the love divinations of a Scottish Hallowe'en night.
//
// Robert Burns wrote "Halloween" in 1785 (Kilmarnock edition, 1786) and gave
// it his own prose notes explaining each "charm", because, he said, they
// were the customs of the peasantry in the west of Scotland. The five rites
// here are the ones those notes describe; the descriptions follow Burns's
// notes, the outcomes are the game's readings of what each sign meant.
//
// They are worked as a caller step ('rite'), and the callers who bring them
// come to the door only in the Samhain season.
// ---------------------------------------------------------------------------
const BURNS_SOURCE = 'Robert Burns, "Halloween" (1785; Kilmarnock edition 1786), with his own notes';

const HALLOWEEN_RITES = {
  nuts: {
    key: 'nuts', name: 'Burning the Nuts', icon: '🌰',
    how: 'Name a lad and a lass to two nuts and lay them side by side in the fire.',
    outcomes: [
      'The two nuts burn quietly together, side by side — the courtship will go well.',
      'One nut starts from the other with a crack and jumps the hearth — that match will not last.',
      'They smoulder a long while and then catch together — slow, but sure.',
    ],
    lore: 'Burns: as the nuts burn quietly together or start from beside one another, so the course and issue of the courtship will be.',
  },
  kail: {
    key: 'kail', name: 'Pulling the Kail Stocks', icon: '🥬',
    how: 'Go out hand in hand with your eyes shut and pull the first kail stalk you meet.',
    outcomes: [
      'A big straight stalk with plenty of earth at the root — a tall one, and a tocher (dowry) with them.',
      'A little crooked stalk, clean of earth — a small one, and no money; but the heart of it is sweet.',
      'A fine stalk with a bitter heart — handsome, and a temper to go with it.',
    ],
    lore: 'Burns: its being big or little, straight or crooked, foretells the size and shape of your future spouse; earth at the root means a tocher, and the taste of the heart, the temper.',
  },
  apple: {
    key: 'apple', name: 'The Apple at the Glass', icon: '🍎',
    how: 'Take a candle, go alone to a looking-glass, eat an apple before it, and comb your hair.',
    outcomes: [
      'For a moment a face looks over your shoulder in the glass — then the candle gutters and it is gone.',
      'Nothing but your own face and the candle — whoever it is, they are not thinking of you tonight.',
      'A shape behind you that might be a face, or might be the coat on the door.',
    ],
    lore: 'Burns: "Take a candle, and go, alone, to a looking glass: eat an apple before it, and some traditions say you should comb your hair all the time: the face of your conjugal companion, to be, will be seen in the glass, as if peeping over your shoulder."',
  },
  clue: {
    key: 'clue', name: 'The Blue Clue', icon: '🧶',
    how: 'Go alone to the kiln, throw a clue of blue yarn into the pot, and wind it into a new clue; near the end, something will hold the thread.',
    outcomes: [
      'Near the end the thread holds fast. "Wha hauds?" you ask — and from the pot a name comes back, low.',
      'The thread runs free to the very end. Nobody holds it; not this year.',
      'Something holds it — and lets go before you can ask.',
    ],
    lore: 'Burns: demand "Wha hauds?" — an answer will be returned from the kiln-pot, naming the Christian and surname of your future spouse.',
  },
  luggies: {
    key: 'luggies', name: 'The Three Luggies', icon: '🥣',
    how: 'Three dishes on the hearth — clean water, foul water, and empty. Blindfolded, dip your left hand; the dishes are moved and you try three times.',
    outcomes: [
      'Your fingers find the clean water — the one you marry will come to you a maid.',
      'Your fingers find the foul water — the one you marry will have been widowed before.',
      'Your fingers find the empty dish — no marriage at all, which some call luck.',
    ],
    lore: 'Burns: if the left hand finds the clean water, "the future (husband or) wife will come to the bar of matrimony a maid"; the foul, a widow; the empty dish "foretells, with equal certainty, no marriage at all." "It is repeated three times, and every time the arrangement of the dishes is altered."',
  },
};
for (const r of Object.values(HALLOWEEN_RITES)) { r.tier = 'record'; r.source = BURNS_SOURCE; }

module.exports = { HALLOWEEN_RITES, BURNS_SOURCE };
