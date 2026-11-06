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
    lore: "Nearly two hundred witch bottles are recorded in Britain, most from the 1500s to the 1700s, buried under or beside the hearth — the chimney being the way a witch was thought to get in — or at a door or window. The bent pins were meant to snare the witch, the heat of the fire to torment her until the spell was broken. The Greenwich bottle, a stoneware bellarmine jar found in 2004, still held iron nails, one driven through a leather heart, brass pins, hair and nail parings.",
    tier: 'record',
    source: 'Greenwich witch bottle (found 2004) · JSTOR Daily, "Is There a Witch Bottle in Your House?"',
  },
  hexafoil: {
    name: 'Daisy Wheel',
    icon: '✡',
    where: 'over the door',
    blurb: 'A permanent ward on the threshold.',
    lore: 'Hexafoils — "daisy wheels" — were drawn with a pair of compasses: one circle, then six arcs of the same radius, each set from where the last crossed the circle. They are found by the thousand on doorways, windows, fireplaces, barns and church porches, from the medieval period into the 1800s. Historic England notes their purpose is debated, but ritual protection is the most widely accepted reading — one idea is that a spirit would follow the endless line and be caught in it.',
    tier: 'record',
    source: "Historic England, 'Discovering Witches' Marks'",
  },
  shoe: {
    name: 'Concealed Shoe',
    icon: '👞',
    where: 'hidden by the chimney',
    blurb: 'A permanent ward. One per house — choose a worn shoe from your pack.',
    lore: "Well over a thousand worn shoes have been found hidden in the fabric of old buildings, recorded in the concealed-shoe index kept at Northampton Museum since the 1950s. The chimney and hearth are the commonest place, then under floors and in walls; most date from the 1600s to the 1800s, the earliest from Winchester Cathedral's choir stalls of 1308. Almost always a single shoe, almost always well worn — the shoe held the shape of its wearer.",
    tier: 'record',
    source: 'June Swann, "Shoes Concealed in Buildings" · Northampton Museum concealed-shoe index',
  },
  // Not a protection — nobody who wrote about it thought so. Honest to the
  // museum's own label (milk drawn from the neighbours' cows), in the game it
  // draws a little of the neighbours' plenty: harvest luck, not guard.
  ladder: {
    name: "Witch's Ladder",
    icon: '🪶',
    where: 'hung in the roof space',
    blurb: "Not a ward at all, as far as anyone knows. Tie cock's feathers into a length of cord and hang it in the rafters; it draws a little of the neighbours' plenty — harvest luck.",
    lore: "In 1878–9 workmen pulling down an old house in Wellington, Somerset, found in the roof space a cord about a metre and a half long with cock's feathers worked into it, along with brooms and an old chair. Dr Abraham Colles wrote it up as \"A Witches' Ladder\" in 1887, and it is now in the Pitt Rivers Museum. What it was for is honestly unknown: the workmen said it was a ladder for witches to cross the roof; the museum's label says for getting milk away from neighbours' cows; at the British Association that same year two men said it was a sewel, hung to turn deer in a hunt; and a local woman said it was a string of feathers to scare birds off the peas. Tylor, who showed it there, wrote in 1891 that opinion alone could not settle it.",
    tier: 'record',
    source: 'Pitt Rivers Museum 1911.32.7 · A. Colles, "A Witches\' Ladder", The Folk-Lore Journal (1887)',
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
