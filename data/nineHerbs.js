// ---------------------------------------------------------------------------
// The Nine Herbs Charm (blueprint proposal G) — the Cottage Garden's capstone.
//
// From the Lacnunga ("Remedies"), an Old English medical collection of about
// AD 1000 (British Library, Harley MS 585): a metrical charm against poison and
// infection that names nine herbs, tells how Woden "took nine glory-twigs" and
// struck the serpent into nine pieces, and ends with a recipe — the herbs
// pounded to dust and worked into a salve with soap and apple juice. It is
// recited as well as compounded: the words are part of the cure.
//
// The herbs, as most modern translations give them. Several identifications are
// genuinely uncertain and are flagged; the Old English names are kept so the
// player can see what the scribe wrote.
//
// The game's Green Path capstone is the baneful Draught (belladonna, henbane,
// mandrake). This is its gentle twin: grown, not gathered from the dark.
// The lines below are short renderings of the Old English, not quotations of
// any modern translation.
// ---------------------------------------------------------------------------

const NINE_HERBS = [
  { id: 'mugwort', oe: 'Mucgwyrt', name: 'Mugwort', line: 'Remember, Mugwort, what you made known — Una you are called, oldest of herbs, strong against three and against thirty.' },
  { id: 'plantain', oe: 'Wegbrade', name: 'Waybread (Plantain)', line: 'And you, Waybread, mother of herbs — carts creaked over you, queens rode over you, and you withstood them all.' },
  { id: 'lambs_cress', oe: 'Stune', name: "Lamb's Cress", uncertain: true, line: 'This herb is called Stune; she grew on a stone, she stands against poison, she strikes against pain.' },
  { id: 'nettle', oe: 'Stiðe', name: 'Nettle', uncertain: true, line: 'Stiðe it is called; it drives out the hostile one, it casts out the venom.' },
  { id: 'betony', oe: 'Attorlaðe', name: 'Betony', uncertain: true, line: 'Venom-loather, this is the herb that fought against the serpent.' },
  { id: 'chamomile', oe: 'Mægðe', name: 'Chamomile (Mayweed)', line: 'Remember, Mayweed, what you made known, what you brought about at Alorford.' },
  { id: 'crab_apple', oe: 'Wergulu', name: 'Crab Apple', uncertain: true, line: 'This is the one the seal sent over the sea\'s back, to right the harm of other poison.' },
  { id: 'chervil', oe: 'Fille', name: 'Chervil', line: 'Chervil and Fennel, two very mighty ones — the wise Lord shaped them, holy in the heavens.' },
  { id: 'fennel', oe: 'Finule', name: 'Fennel', line: 'He set them in the seven worlds, for the wretched and the fortunate, a help to all.' },
];

// Woden's lines — recited between the herbs and the recipe.
const WODEN_LINES = [
  'A serpent came crawling; it tore a man apart.',
  'Then Woden took nine glory-twigs, and struck the adder so that it flew into nine.',
  'These nine have power against nine poisons.',
];

// The seven herbs new to the garden (mugwort and chamomile were already here).
const NEW_GARDEN_HERBS = ['plantain', 'lambs_cress', 'nettle', 'betony', 'crab_apple', 'chervil', 'fennel'];
const LACNUNGA_SEEDS_PER_HERB = 2;

const NINE_HERBS_LORE = {
  text: "From the Lacnunga, an Old English book of remedies of about AD 1000 (British Library, Harley MS 585). The Nine Herbs Charm names nine herbs against poison and infection, tells how Woden took nine glory-twigs and struck the serpent into nine, and ends in a recipe: pound the herbs to dust, mix them with old soap and apple juice into a salve. It was spoken as well as made. Some of the nine — Stune, Stiðe, Attorlaðe, Wergulu — are uncertain identifications; the names here follow common modern translations.",
  tier: 'record',
  source: 'Lacnunga, British Library Harley MS 585 (c. AD 1000)',
};

module.exports = { NINE_HERBS, WODEN_LINES, NEW_GARDEN_HERBS, LACNUNGA_SEEDS_PER_HERB, NINE_HERBS_LORE };
