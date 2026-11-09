// ---------------------------------------------------------------------------
// Threshold & Hearth — apotropaic housecraft (blueprint proposal B).
//
// The Hearth Witch's blurb promised "your threshold is warded and your home
// holds" and delivered a damage-resist number. These are the things English
// householders actually did to ward a house — every one of them is found,
// physically, in old buildings — made into a practice at your own cottage:
//
//   🍶 The witch bottle — a stoneware jug of bent pins and iron nails, buried
//      under the hearth to catch a curse and turn it back. It holds a few
//      curses, then it is spent and must be replaced.
//   ✡ The daisy wheel — a compass-drawn hexafoil scratched over the door.
//      You draw it yourself: one circle, six arcs, one radius.
//   👞 The concealed shoe — one worn shoe of your own, hidden by the chimney.
//      Permanent; one per house.
//
// Each carries its provenance tier and source line, as everywhere in the
// folk-magic layer (docs/blueprints/folk-magic-deepening.md §4).
// ---------------------------------------------------------------------------

const WARDS = {
  bottle: {
    name: 'Witch Bottle',
    icon: '🍶',
    where: 'beneath the hearth',
    blurb: 'Turns the next hostile curse back on its sender. Holds a few, then it is spent.',
    lore: "Some two to two and a half hundred witch bottles are recorded, mostly in England, and most of them from the mid-to-late 1600s: \"most bottles post-date the Restoration of Charles II in 1660\". Half are found about the hearth and a quarter beneath thresholds. The bent pins were meant to snare the witch, the heat of the fire to torment her until the spell was broken. The Greenwich bottle, a late 17th-century stoneware jar found by builders in the mid-2000s, still held urine, twelve iron nails, \"one of which was driven through a leather heart\", eight brass pins, hair and fingernail clippings. If you find one in an old house: leave it where it is, don't take the stopper out, since it may still hold its contents, photograph it in place, and tell your local Finds Liaison Officer.",
    tier: 'record',
    source: "B. Hoggard, Apotropaios, \"Witch-bottles\" · MOLA, \"Bottles Concealed and Revealed\", British Archaeology (September 2019) · A. Massey, British Archaeology 107 (2009), the Greenwich bottle · JSTOR Daily, \"Is There a Witch Bottle in Your House?\" (2019)",
  },
  hexafoil: {
    name: 'Daisy Wheel',
    icon: '✡',
    where: 'over the door',
    blurb: 'A permanent ward on the threshold.',
    lore: "Hexafoils — \"daisy wheels\" — were drawn with a pair of compasses: one circle, then six arcs of the same radius, each set from where the last crossed the circle. They are very common on doorways, windows, fireplaces, barns and church porches, \"from the early medieval period, up into the 19th century\". \"The purpose of hexafoils is disputed\", Historic England says, but \"their interpretation as a ritual protection mark is the most widely accepted theory at present\": one idea is that a spirit would follow the \"single, endless line\" and be caught in it. Others read them as masons' practice in drawing with compasses. If you find one, record it and leave it be: removing marks from a listed building usually needs consent.",
    tier: 'record',
    source: "Historic England, 'Discovering Witches' Marks' · Historic England, \"Help hunt for witches' marks\" · Historic England, Graffiti on Historic Buildings (2018) · J. Alexander, in The Guardian (2026)",
  },
  shoe: {
    name: 'Concealed Shoe',
    icon: '👞',
    where: 'hidden by the chimney',
    blurb: 'A permanent ward. One per house — choose a worn shoe from your pack.',
    lore: "Nearly three thousand finds of worn shoes hidden in the fabric of old buildings are now recorded in the concealed-shoe index kept at Northampton Museum since the late 1950s. The chimney and hearth are the commonest place, then floors, walls and roofs; most date from the 1500s to the 1900s, and the earliest was found behind Winchester Cathedral's choir stalls, installed in 1308. Usually a single shoe, almost always well worn (\"all but twenty\" of June Swann's first 1,550), and about two in five of those that can be sized a child's. If you find one, report it to the museum; finders often put it back where it was.",
    tier: 'record',
    source: "J. Swann, \"Shoes Concealed in Buildings\", Costume 30 (1996) · Northampton Museum concealed-shoe index",
  },
  // Not a protection — nobody who wrote about it thought so. Honest to the
  // museum's own label (milk drawn from the neighbours' cows), in the game it
  // draws a little of the neighbours' plenty: harvest luck, not guard.
  ladder: {
    name: "Witch's Ladder",
    icon: '🪶',
    where: 'hung in the roof space',
    blurb: "Not a ward at all, as far as anyone knows. Tie cock's feathers into a length of cord and hang it in the rafters; it draws a little of the neighbours' plenty — harvest luck.",
    lore: "In 1878–9 workmen pulling down an old house in Wellington, Somerset, found in the roof space a cord about a metre and a half long with cock's feathers worked into it, along with brooms and an old chair. Dr Abraham Colles wrote it up as \"A Witches' Ladder\" in 1887, and it is now in the Pitt Rivers Museum. What it was for is honestly unknown: the workmen said it was a ladder for witches to cross the roof; the museum's label says for getting milk away from neighbours' cows, \"and for causing people's deaths\"; when Tylor showed it at the British Association in 1887, two of his audience said it was a sewel, hung to turn deer in a hunt; and in 1893 Marianne Voader, a woman reputed a witch, told Sabine Baring-Gould it was \"nothing but a string set with feathers to frighten birds from a line of peas\". Tylor told the Folk-Lore Congress in 1891 that \"unsupported opinion does not suffice\".",
    tier: 'record',
    source: "Pitt Rivers Museum 1911.32.7 · A. Colles, \"A Witches' Ladder\", The Folk-Lore Journal 5 (1887) · E. B. Tylor, International Folk-Lore Congress, Papers and Transactions (1892)",
  },
};

// The ladder's pull: harvest luck while it hangs (more for a Hearth Witch).
const LADDER_FORAGE = 0.05;
const LADDER_FORAGE_HEARTH = 0.08;
const LADDER_PARTS = [{ id: 'hemp_cord', qty: 1 }, { id: 'cock_feathers', qty: 1 }];

// The ingredients a cunning person would have put in. (The bottle's other
// contents — the householder's own hair, nail parings and urine — are the
// player's to imagine; the game does not inventory them.)
const WITCH_BOTTLE_PARTS = ['bellarmine_jug', 'bent_pins', 'iron_nails'];

const BOTTLE_CHARGES = 3;           // curses a buried bottle turns before it is spent
const BOTTLE_CHARGES_HEARTH = 5;    // …for a Hearth Witch, whose practice this is
const WARD_GUARD = 0.03;            // damage resist from each permanent ward
const WARD_GUARD_HEARTH = 0.05;     // …for a Hearth Witch
const BOTTLE_TURN_GRACE_MS = 10000; // once a curse is turned, the house holds for a breath

// Curses a witch bottle can turn: the hostile statuses one player (or a hex
// trap) can lay on another. Self-buffs are never touched.
const TURNABLE_CURSES = ['wither', 'stumble', 'shrink', 'toad', 'gibberish', 'wolfmark', 'bloodcurse', 'reversed', 'rooted'];

module.exports = { WARDS, WITCH_BOTTLE_PARTS, BOTTLE_CHARGES, BOTTLE_CHARGES_HEARTH, WARD_GUARD, WARD_GUARD_HEARTH, BOTTLE_TURN_GRACE_MS, TURNABLE_CURSES, LADDER_FORAGE, LADDER_FORAGE_HEARTH, LADDER_PARTS };
