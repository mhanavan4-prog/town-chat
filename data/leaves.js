// ---------------------------------------------------------------------------
// Reading the Leaves — tasseomancy (blueprint proposal E).
//
// Tea reached England in the mid-1600s; reading the dregs became a kitchen and
// parlour art, and the printed symbol dictionaries that fixed its vocabulary are
// Victorian and Edwardian. The method and meanings here follow one of the best
// known, A Highland Seer's "Tea-Cup Reading and Fortune-Telling by Tea Leaves"
// (New York: George Sully, c. 1920; now public domain), paraphrased:
//
//   • Drink until about half a teaspoon is left. Hold the cup by the handle in
//     the left hand, swirl it three times left to right, turn it over on the
//     saucer and let it drain.
//   • The HANDLE stands for the one who drank — signs near it come nearer home.
//   • Near the RIM is what comes soon; the SIDES, a little further off; the
//     BOTTOM, the more distant future.
//   • Weigh good signs against bad; a clear, large shape counts for more than a
//     faint or clouded one.
//
// Tier: folk tradition, set down in print. Nothing here pretends to be older.
// ---------------------------------------------------------------------------

// tone: 'good' | 'ill' | 'mixed' — the seer's own weighting, used for the
// cup's overall leaning. A few signs change with where they lie (byPlace) —
// the seer's dog is a faithful friend at the rim and a secret enemy at the
// bottom — and the reading gives the meaning for the place it fell.
const LEAF_SYMBOLS = [
  { key: 'anchor', glyph: '⚓', name: 'An anchor', meaning: 'Success in business and constancy in love — a lucky sign, unless it lies clouded.', tone: 'good' },
  { key: 'bird', glyph: '🐦', name: 'A bird', meaning: 'Lucky. Flying, it brings news; at rest, a fortunate journey.', tone: 'good' },
  { key: 'boat', glyph: '⛵', name: 'A boat', meaning: 'A friend is coming to visit.', tone: 'good' },
  { key: 'cat', glyph: '🐈', name: 'A cat', meaning: 'Difficulties caused by treachery.', tone: 'ill' },
  { key: 'clover', glyph: '☘️', name: 'A clover', meaning: 'Very lucky — happiness and plenty; the nearer the rim, the sooner.', tone: 'good' },
  { key: 'cross', glyph: '✝️', name: 'A cross', meaning: 'Trouble and delay.', tone: 'ill' },
  { key: 'dog', glyph: '🐕', name: 'A dog', meaning: 'Near the top, faithful friends; in the middle, friends not to be trusted; at the bottom, secret enemies.', tone: 'mixed',
    byPlace: { rim: { meaning: 'Faithful friends.', tone: 'good' }, side: { meaning: 'Friends who are not to be trusted.', tone: 'ill' }, bottom: { meaning: 'Secret enemies.', tone: 'ill' } } },
  { key: 'fish', glyph: '🐟', name: 'A fish', meaning: 'Good news from abroad.', tone: 'good' },
  { key: 'heart', glyph: '❤️', name: 'A heart', meaning: 'Pleasures coming — with money if dots surround it, a marriage if a ring is near.', tone: 'good' },
  { key: 'horseshoe', glyph: '🐴', name: 'A horseshoe', meaning: 'A lucky journey, or luck in choosing a partner.', tone: 'good' },
  { key: 'house', glyph: '🏠', name: 'A house', meaning: 'Success in business.', tone: 'good' },
  { key: 'key', glyph: '🗝️', name: 'A key', meaning: 'Money, growing trade, and a good partner.', tone: 'good' },
  { key: 'ladder', glyph: '🪜', name: 'A ladder', meaning: 'Travel.', tone: 'good' },
  { key: 'letter', glyph: '✉️', name: 'A square leaf — a letter', meaning: 'News is coming; with dots about it, there is money in it. Clouded, it is bad news.', tone: 'mixed' },
  { key: 'moon', glyph: '🌙', name: 'A crescent moon', meaning: 'Prosperity and fortune.', tone: 'good' },
  { key: 'owl', glyph: '🦉', name: 'An owl', meaning: 'An ill omen — sickness or want; begin nothing new for a while.', tone: 'ill' },
  { key: 'ring', glyph: '💍', name: 'A ring', meaning: 'Marriage. At the very bottom of the cup, a wedding that will not happen.', tone: 'mixed',
    byPlace: { rim: { meaning: 'Marriage.', tone: 'good' }, side: { meaning: 'Marriage.', tone: 'good' }, bottom: { meaning: 'A wedding that will not happen.', tone: 'ill' } } },
  { key: 'serpent', glyph: '🐍', name: 'A serpent', meaning: 'Spiteful enemies, ill luck.', tone: 'ill' },
  { key: 'star', glyph: '⭐', name: 'A star', meaning: 'Lucky; ringed with dots, wealth and honours.', tone: 'good' },
  { key: 'tree', glyph: '🌳', name: 'A tree', meaning: 'Prosperity and happiness; with dots, a fortune made in the country.', tone: 'good' },
  { key: 'umbrella', glyph: '☂️', name: 'An umbrella', meaning: 'Annoyance and trouble.', tone: 'ill' },
  { key: 'hourglass', glyph: '⏳', name: 'An hourglass', meaning: 'A peril close at hand — take care.', tone: 'ill' },
  { key: 'crown', glyph: '👑', name: 'A crown', meaning: 'Success and honour.', tone: 'good' },
  { key: 'kite', glyph: '🪁', name: 'A kite', meaning: 'Long journeys that end in honour.', tone: 'good' },
  { key: 'mountain', glyph: '⛰️', name: 'A mountain', meaning: 'Powerful friends — or, among many mountains, powerful enemies.', tone: 'mixed' },
  { key: 'spider', glyph: '🕷️', name: 'A spider', meaning: 'Money is coming to you.', tone: 'good' },
];

// Where in the cup a sign lies sets WHEN it comes.
const LEAF_PLACES = [
  { key: 'rim', label: 'near the rim', when: 'soon' },
  { key: 'side', label: 'on the side of the cup', when: 'not far off' },
  { key: 'bottom', label: 'at the bottom', when: 'in the more distant future' },
];

// How long the dregs wait to be read after a cup is drunk.
const CUP_WINDOW_MS = 2 * 3600 * 1000;
// Reading every sign once fills the Leaves page of the Almanac.
const LEAVES_SET_PURSE = 150;
const LEAVES_NEW_SIGN_XP = 10;

const LEAVES_LORE = {
  method: 'Swirl the last half-spoonful three times, left to right, holding the handle in your left hand; turn the cup over on the saucer to drain; then read. The handle is you — signs near it come close to home. Rim is soon, sides are later, the bottom is far off.',
  provenance: "Tea reached England in the 1650s and leaf-reading became a kitchen art; its printed symbol dictionaries are Victorian and Edwardian. These meanings follow A Highland Seer's Tea-Cup Reading and Fortune-Telling by Tea Leaves (New York, c. 1920).",
  tier: 'folk',
};

module.exports = { LEAF_SYMBOLS, LEAF_PLACES, CUP_WINDOW_MS, LEAVES_SET_PURSE, LEAVES_NEW_SIGN_XP, LEAVES_LORE };
