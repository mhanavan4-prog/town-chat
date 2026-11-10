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
  { key: 'fearn', letter: 'F', aicme: 'B', n: 3, name: 'Fearn', tree: 'Alder', wood: 'alder_bark', meaningOrig: 'alder', kenning: 'the van of the warrior-bands (shields were made of it)', reading: 'A shield raised — stand in front of what you love.' },
  { key: 'sail', letter: 'S', aicme: 'B', n: 4, name: 'Sail', tree: 'Willow', wood: 'willow_frond', meaningOrig: 'willow', kenning: 'colour of a lifeless one', reading: 'Bend, and do not break — the water knows the way.' },
  { key: 'nion', letter: 'N', aicme: 'B', n: 5, name: 'Nion', tree: 'Ash', wood: 'ash_key', meaningOrig: 'uncertain — "fork" or "loft"', kenning: 'establishing of peace', reading: 'A link between things — the fork in the road is a choice.' },
  // ── Aicme hÚatha ──
  { key: 'huath', letter: 'H', aicme: 'H', n: 1, name: 'Úath', tree: 'Hawthorn', wood: 'haw', meaningOrig: 'unclear — linked to "horror, fear"', kenning: 'a meet of hounds', reading: 'A thorn at the threshold — something must wait.' },
  { key: 'dair', letter: 'D', aicme: 'H', n: 2, name: 'Dair', tree: 'Oak', wood: 'hex_acorn', meaningOrig: 'oak', kenning: 'higher than bushes', reading: 'Strength and a door — what is rooted holds.' },
  { key: 'tinne', letter: 'T', aicme: 'H', n: 3, name: 'Tinne', tree: 'Holly', wood: 'wood', meaningOrig: 'perhaps "bar of metal, ingot"', kenning: 'a third of a wheel (holly for the chariot)', reading: 'Iron in the hand — meet the trouble, it is smaller up close.' },
  { key: 'coll', letter: 'C', aicme: 'H', n: 4, name: 'Coll', tree: 'Hazel', wood: 'hazel_rod', meaningOrig: 'hazel', kenning: 'fairest of trees (all eat of its nuts)', reading: 'Wisdom — the hazel over the well, the salmon that ate its nuts.' },
  { key: 'ceirt', letter: 'Q', aicme: 'H', n: 5, name: 'Ceirt', tree: 'Apple', wood: 'crab_apple', meaningOrig: 'uncertain — "bush"', kenning: 'shelter of a hind', reading: 'A choice offered — sweet now, or sweeter later.' },
  // ── Aicme Muine ──
  { key: 'muin', letter: 'M', aicme: 'M', n: 1, name: 'Muin', tree: 'Vine', wood: 'bramble_vine', meaningOrig: 'ambiguous — "neck", "ruse" or "love"', kenning: 'strongest in effort', reading: 'What climbs and binds — keep what is worth keeping close.' },
  { key: 'gort', letter: 'G', aicme: 'M', n: 2, name: 'Gort', tree: 'Ivy', wood: 'ivy_leaf', meaningOrig: 'field', kenning: 'greener than pastures', reading: 'Patience — the ivy goes round, and gets there.' },
  { key: 'ngetal', letter: 'NG', aicme: 'M', n: 3, name: 'nGétal', tree: 'Broom or fern', wood: 'fern_frond', meaningOrig: 'uncertain — perhaps "killing"', kenning: "a leech's sustenance", reading: 'Healing that takes cutting first.' },
  { key: 'straif', letter: 'ST', aicme: 'M', n: 4, name: 'Straif', tree: 'Blackthorn', wood: 'blackthorn', meaningOrig: 'sulphur', kenning: 'strongest of reddening (dye)', reading: 'A hard thing that cannot be stepped around — go through.' },
  { key: 'ruis', letter: 'R', aicme: 'M', n: 5, name: 'Ruis', tree: 'Elder', wood: 'elderberry', meaningOrig: 'red, redness', kenning: 'the redness of shame', reading: 'An ending that clears ground — let the old thing go.' },
  // ── Aicme Ailme ──
  { key: 'ailm', letter: 'A', aicme: 'A', n: 1, name: 'Ailm', tree: 'Pine', wood: 'pine_pitch', meaningOrig: 'uncertain — perhaps "pine"', kenning: 'loudest of groans', reading: 'Clear sight from a height — look further than the next step.' },
  { key: 'onn', letter: 'O', aicme: 'A', n: 2, name: 'Onn', tree: 'Gorse', wood: 'gorse_bloom', meaningOrig: 'ash tree', kenning: 'wounder of horses', reading: 'Gold in a thorny place — the hard path pays.' },
  { key: 'ur', letter: 'U', aicme: 'A', n: 3, name: 'Úr', tree: 'Heather', wood: 'heather_sprig', meaningOrig: 'earth, clay, soil', kenning: 'propagation of plants', reading: 'Home ground — the luck is where your feet are.' },
  { key: 'edad', letter: 'E', aicme: 'A', n: 4, name: 'Edad', tree: 'Aspen', wood: 'aspen_leaf', meaningOrig: 'unknown', kenning: 'discerning tree', reading: 'A trembling that warns — listen to the small unease.' },
  { key: 'idad', letter: 'I', aicme: 'A', n: 5, name: 'Idad', tree: 'Yew', wood: 'yew_wood', meaningOrig: 'unknown — perhaps a form of "yew"', kenning: 'oldest of woods', reading: 'The long view — what outlasts you, and what you leave.' },
];

const OGHAM_CARVE_QTY = 2; // pieces of the wood to carve one stave (a hazel rod is one)
const OGHAM_CAST = 3;      // staves drawn in a cast
const OGHAM_LORE = {
  provenance: 'Ogham is an Early Medieval Irish script (c. 4th–6th century), cut on standing stones. The tree-names come from the medieval Ogam Tract and the Auraicept na n-Éces; the riddling kennings are the Bríatharogam. Only some letter-names were really trees — McManus (A Guide to Ogam, 1991) gives the probable originals. Casting ogham to read the future is a modern practice: these readings are the game\'s, built on the old kennings. The "Celtic tree calendar" is Robert Graves\'s invention (1948) and is not used here.',
  coll: 'Coll, the hazel, is the letter of wisdom: the hazels over Connla\'s Well dropped their nuts into the water, and the salmon that ate them held all knowledge. Your brewing teacher wears its name.',
  tier: 'revival',
};

// ── Carving a stave yourself ────────────────────────────────────────────────
// The board is a stave 120 wide and 300 tall; its arris (the stem) runs up the
// middle at x = 60. As on the stones, the B group is cut to the right of the
// edge, the H group to the left, the M group slants across it, and the vowels
// are notches on the edge (or, in the manuscripts, short strokes straight
// across). The server classifies each cut and checks the letter against it.
const OGHAM_STEM_X = 60;
const OGHAM_BOARD = { w: 120, h: 300, stemX: OGHAM_STEM_X, top: 20, bottom: 280 };
function classifyOghamCut(c) {
  if (!c || typeof c !== 'object') return 'stray';
  const x1 = Number(c.x1), y1 = Number(c.y1), x2 = Number(c.x2), y2 = Number(c.y2);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return 'stray';
  if ([y1, y2].some((y) => y < OGHAM_BOARD.top - 6 || y > OGHAM_BOARD.bottom + 6)) return 'stray';
  const a = x1 - OGHAM_STEM_X, b = x2 - OGHAM_STEM_X;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (len < 6) return Math.abs(a) <= 6 && Math.abs(b) <= 6 ? 'notch' : 'stray';
  // From the edge out to one side.
  const near = Math.min(Math.abs(a), Math.abs(b)), far = Math.abs(a) > Math.abs(b) ? a : b;
  if (near <= 6 && Math.abs(far) >= 14 && Math.abs(dy) <= 0.5 * Math.abs(dx)) return far > 0 ? 'right' : 'left';
  // Right across the edge.
  if (a * b < 0 && Math.min(Math.abs(a), Math.abs(b)) >= 4) {
    return Math.abs(dy) >= 0.3 * Math.abs(dx) ? 'across' : 'straight';
  }
  return 'stray';
}
const OGHAM_CUT_FOR = { B: ['right'], H: ['left'], M: ['across'], A: ['notch', 'straight'] };
const OGHAM_CUT_WORDS = { B: 'to the right of the edge', H: 'to the left of the edge', M: 'slanting right across the edge', A: 'as notches on the edge' };
// Returns null if the cuts make this letter, else a reason the carver can act on.
function oghamProblem(aicme, n, cuts) {
  if (!OGHAM_CUT_FOR[aicme]) return 'No such letter.';
  if (!Array.isArray(cuts) || !cuts.length) return 'Cut the letter against the edge first.';
  if (cuts.length > 12) return 'Too many cuts for one letter.';
  const kinds = cuts.map(classifyOghamCut);
  if (kinds.includes('stray')) return 'A cut wandered off the edge: every stroke starts on it, crosses it, or is a notch in it.';
  const ok = OGHAM_CUT_FOR[aicme];
  if (kinds.some((k) => !ok.includes(k))) return `This letter's strokes go ${OGHAM_CUT_WORDS[aicme]}.`;
  if (aicme === 'A' && new Set(kinds).size > 1) return 'Keep the vowel one way: all notches, or all short strokes across.';
  if (cuts.length !== n) return `${n} stroke${n === 1 ? '' : 's'} for this letter, not ${cuts.length}.`;
  if (n > 1) {
    const ys = cuts.map((c) => (Number(c.y1) + Number(c.y2)) / 2).sort((p, q) => p - q);
    const gaps = ys.slice(1).map((y, i) => y - ys[i]);
    if (Math.min(...gaps) < 5) return 'Two strokes run into each other: space them out.';
    if (Math.max(...gaps) > 45 || Math.max(...gaps) > 2.2 * Math.min(...gaps)) return 'Space the strokes evenly, close together, so they read as one letter.';
    if (aicme !== 'A') {
      const ang = cuts.map((c) => { const dx = Number(c.x2) - Number(c.x1), dy = Number(c.y2) - Number(c.y1); let t = Math.atan2(dy, dx); if (t > Math.PI / 2) t -= Math.PI; if (t <= -Math.PI / 2) t += Math.PI; return t; }); // a line's direction, either way along it
      if (Math.max(...ang) - Math.min(...ang) > 0.45) return 'Keep the strokes parallel.';
    }
  }
  return null;
}

// What carving is, as the record has it (shown on the carving board).
const OGHAM_CARVING_LORE = {
  text: "Ogham was cut on standing stones in Ireland and western Britain from about the fourth century: strokes and notches \"relative to a stemline, generally the natural angle or edge of the stone\", read \"vertically up one side, across the top and down the other\" (White). The B group sits to the right of the edge, the H group to the left; the M group slants across; the vowels are notches on the edge itself. Nearly every stone carries a name, \"X MAQI Y\", \"of X son of Y\". The tree-names came later, from medieval scholars; the Book of Ballymote copy is of about 1390. Cut ogham only in your own new wood: in Ireland \"defacement or damage to a designated monument\" is an offence, and in Wales \"it is a criminal offence to destroy or damage a scheduled monument without scheduled monument consent\".",
  tier: 'record',
  source: 'N. White, "The 360 stones which show off the earliest writing in Ireland", Maynooth University · D. Hayden, "Ogam script in the RIA Library collections", Royal Irish Academy (Book of Ballymote, RIA MS 23 P 12) · D. McManus, A Guide to Ogam (1991) · National Monuments Service · Cadw, "Damage to scheduled monuments"',
};

module.exports = { OGHAM, OGHAM_CARVE_QTY, OGHAM_CAST, OGHAM_LORE, OGHAM_BOARD, classifyOghamCut, oghamProblem, OGHAM_CARVING_LORE };
