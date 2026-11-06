// ---------------------------------------------------------------------------
// The Tree Alphabet — ogham few-staves (blueprint proposal C).
//
// Ogham is a real Early Medieval Irish script (roughly 4th–6th century on
// standing stones). Its twenty letters (feda) fall in four groups (aicmí) of
// five, cut as strokes against a stem line. The medieval scholars' Ogam Tract
// and the Auraicept na n-Éces gloss most letters with a TREE, and the
// Bríatharogam ("word-ogham") give each a riddling kenning. Modern scholarship
// (Damian McManus, A Guide to Ogam, 1991) shows only some letter-names really
// were tree-names — beith (birch), fern (alder), sail (willow), dair (oak),
// coll (hazel) among them; others meant "field", "red", "sulphur", "earth".
//
// Honesty line, shown in game: ogham was a script for names and memorials.
// Casting ogham staves to read the future is a modern practice; the readings
// below are this game's, built on the medieval kennings and tree-lore. The
// "Celtic tree calendar" is a 20th-century invention (Robert Graves, 1948) and
// is not used here.
//
// What the game does with it: you CARVE a stave from wood you gathered — the
// tree decides the letter — and cast three from the staves you hold. Letters
// whose trees don't grow in the Wilds are in the Codex but can't be carved yet.
// Coll, the hazel, is Hazel's own letter: she gives you a hazel rod.
// ---------------------------------------------------------------------------

// aicme: 'B' strokes right of the stem · 'H' left · 'M' diagonal across ·
// 'A' notches across. n = stroke count (1–5). wood = the item you carve it from.
// kenning = a short English rendering of a Bríatharogam kenning (after the
// Auraicept / Morann mac Moín lists as translated by Calder and McManus).
const OGHAM = [
  // ── Aicme Beithe ──
  { key: 'beith', letter: 'B', aicme: 'B', n: 1, name: 'Beith', tree: 'Birch', wood: 'birch_bark', meaningOrig: 'birch', kenning: 'withered foot with fine hair', reading: 'A beginning — clean bark, a first mark on new ground.' },
  { key: 'luis', letter: 'L', aicme: 'B', n: 2, name: 'Luis', tree: 'Rowan', wood: 'rowan_berry', meaningOrig: 'uncertain — "blaze" or "herb"', kenning: 'delight of eye (for its berries)', reading: 'Protection and a quick eye — the witch-tree keeps watch.' },
  { key: 'fearn', letter: 'F', aicme: 'B', n: 3, name: 'Fearn', tree: 'Alder', wood: null, meaningOrig: 'alder', kenning: 'the van of the warrior-bands (shields were made of it)', reading: 'A shield raised — stand in front of what you love.' },
  { key: 'sail', letter: 'S', aicme: 'B', n: 4, name: 'Sail', tree: 'Willow', wood: 'willow_frond', meaningOrig: 'willow', kenning: 'colour of a lifeless one', reading: 'Bend, and do not break — the water knows the way.' },
  { key: 'nion', letter: 'N', aicme: 'B', n: 5, name: 'Nion', tree: 'Ash', wood: null, meaningOrig: 'uncertain — "fork" or "loft"', kenning: 'a check on peace (the ash spear-shaft)', reading: 'A link between things — the fork in the road is a choice.' },
  // ── Aicme hÚatha ──
  { key: 'huath', letter: 'H', aicme: 'H', n: 1, name: 'Úath', tree: 'Hawthorn', wood: null, meaningOrig: 'unclear — linked to "horror, fear"', kenning: 'a meet of hounds', reading: 'A thorn at the threshold — something must wait.' },
  { key: 'dair', letter: 'D', aicme: 'H', n: 2, name: 'Dair', tree: 'Oak', wood: 'hex_acorn', meaningOrig: 'oak', kenning: 'higher than bushes', reading: 'Strength and a door — what is rooted holds.' },
  { key: 'tinne', letter: 'T', aicme: 'H', n: 3, name: 'Tinne', tree: 'Holly', wood: 'wood', meaningOrig: 'perhaps "bar of metal, ingot"', kenning: 'a third of a wheel (holly for the chariot)', reading: 'Iron in the hand — meet the trouble, it is smaller up close.' },
  { key: 'coll', letter: 'C', aicme: 'H', n: 4, name: 'Coll', tree: 'Hazel', wood: 'hazel_rod', meaningOrig: 'hazel', kenning: 'fairest of trees (all eat of its nuts)', reading: 'Wisdom — the hazel over the well, the salmon that ate its nuts.' },
  { key: 'ceirt', letter: 'Q', aicme: 'H', n: 5, name: 'Ceirt', tree: 'Apple', wood: null, meaningOrig: 'uncertain — "bush"', kenning: 'a wild hind', reading: 'A choice offered — sweet now, or sweeter later.' },
  // ── Aicme Muine ──
  { key: 'muin', letter: 'M', aicme: 'M', n: 1, name: 'Muin', tree: 'Vine (bramble)', wood: 'bramble_vine', meaningOrig: 'ambiguous — "neck", "ruse" or "love"', kenning: 'strongest in effort', reading: 'What climbs and binds — keep what is worth keeping close.' },
  { key: 'gort', letter: 'G', aicme: 'M', n: 2, name: 'Gort', tree: 'Ivy', wood: null, meaningOrig: 'field', kenning: 'greener than pastures', reading: 'Patience — the ivy goes round, and gets there.' },
  { key: 'ngetal', letter: 'NG', aicme: 'M', n: 3, name: 'nGétal', tree: 'Broom or fern', wood: 'fern_frond', meaningOrig: 'uncertain — perhaps "killing"', kenning: "a leech's sustenance", reading: 'Healing that takes cutting first.' },
  { key: 'straif', letter: 'ST', aicme: 'M', n: 4, name: 'Straif', tree: 'Blackthorn', wood: 'blackthorn', meaningOrig: 'sulphur', kenning: 'the hedge of a stream', reading: 'A hard thing that cannot be stepped around — go through.' },
  { key: 'ruis', letter: 'R', aicme: 'M', n: 5, name: 'Ruis', tree: 'Elder', wood: null, meaningOrig: 'red, redness', kenning: 'the redness of shame', reading: 'An ending that clears ground — let the old thing go.' },
  // ── Aicme Ailme ──
  { key: 'ailm', letter: 'A', aicme: 'A', n: 1, name: 'Ailm', tree: 'Pine', wood: 'pine_pitch', meaningOrig: 'uncertain — perhaps "pine"', kenning: 'loudest of groans', reading: 'Clear sight from a height — look further than the next step.' },
  { key: 'onn', letter: 'O', aicme: 'A', n: 2, name: 'Onn', tree: 'Gorse', wood: null, meaningOrig: 'ash tree', kenning: 'helper of horses', reading: 'Gold in a thorny place — the hard path pays.' },
  { key: 'ur', letter: 'U', aicme: 'A', n: 3, name: 'Úr', tree: 'Heather', wood: null, meaningOrig: 'earth, clay, soil', kenning: 'propagation of plants', reading: 'Home ground — the luck is where your feet are.' },
  { key: 'edad', letter: 'E', aicme: 'A', n: 4, name: 'Edad', tree: 'Aspen', wood: null, meaningOrig: 'unknown', kenning: 'discerning tree', reading: 'A trembling that warns — listen to the small unease.' },
  { key: 'idad', letter: 'I', aicme: 'A', n: 5, name: 'Idad', tree: 'Yew', wood: null, meaningOrig: 'unknown — perhaps a form of "yew"', kenning: 'oldest of woods', reading: 'The long view — what outlasts you, and what you leave.' },
];

const OGHAM_CARVE_QTY = 2; // pieces of the wood to carve one stave (a hazel rod is one)
const OGHAM_CAST = 3;      // staves drawn in a cast
const OGHAM_LORE = {
  provenance: 'Ogham is an Early Medieval Irish script (c. 4th–6th century), cut on standing stones. The tree-names come from the medieval Ogam Tract and the Auraicept na n-Éces; the riddling kennings are the Bríatharogam. Only some letter-names were really trees — McManus (A Guide to Ogam, 1991) gives the probable originals. Casting ogham to read the future is a modern practice: these readings are the game\'s, built on the old kennings. The "Celtic tree calendar" is Robert Graves\'s invention (1948) and is not used here.',
  coll: 'Coll, the hazel, is the letter of wisdom: the hazels over Connla\'s Well dropped their nuts into the water, and the salmon that ate them held all knowledge. Your brewing teacher wears its name.',
  tier: 'revival',
};

module.exports = { OGHAM, OGHAM_CARVE_QTY, OGHAM_CAST, OGHAM_LORE };
