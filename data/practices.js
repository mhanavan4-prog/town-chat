// ---------------------------------------------------------------------------
// The Witch Paths' practices — giving each path a verb (folk-magic blueprint,
// "the through-line"). Hearth Witches ward the house (data/wards.js); Sea
// Witches sell the wind (data/cords.js). These are the other four:
//
//   🌿 Green Witch   — wort-cunning: gather a herb in its planet's hour
//   🌕 Lunar Witch   — draw down the moon
//   🦉 Hedge Witch   — ride the hedge, and bring something back
//   🍞 Kitchen Witch — cross the loaf and bake it at your own hearth
//
// Every practice is open to every witch; walking its path makes it stronger,
// as with the wards and the wind. Each names its tier and source.
// ---------------------------------------------------------------------------

// ── Green: Culpeper's planetary rulers ──────────────────────────────────────
// Nicholas Culpeper, The Complete Herbal (1653), gives most herbs a ruling
// planet. Only herbs he (or the herbal tradition he codified) clearly assigns
// are listed; garden herbs with no clear ruler simply have none.
// Values are weekday numbers, matching data/teas.js and data/planetaryHours.js
// (0 Sun · 1 Moon · 2 Mars · 3 Mercury · 4 Jupiter · 5 Venus · 6 Saturn).
const CULPEPER_RULERS = {
  chamomile: 0, calendula: 0, st_johns_wort: 0, rue: 0,
  comfrey: 6, belladonna: 6, henbane: 6, hemlock: 6, black_hellebore: 6,
  lemon_balm: 4, betony: 4, chervil: 4,
  feverfew: 5, mugwort: 5, vervain: 5, yarrow: 5, foxglove: 5, plantain: 5, crab_apple: 5,
  lavender: 3, fennel: 3,
  wormwood: 2, nettle: 2,
};
const GREEN_HOUR_BONUS = 1;          // extra herbs for a harvest in the ruler's hour
const GREEN_HOUR_BONUS_PATH = 2;     // …for a Green Witch

// ── Lunar: drawing down the moon ────────────────────────────────────────────
const DRAW_DOWN = { xp: 0.15, xpPath: 0.25, fullMoonMult: 2, ms: 30 * 60000 };

// ── Hedge: riding the hedge ─────────────────────────────────────────────────
// A trance draught to cross on, taken at night at the edge of things (the Wilds).
const HEDGE_DRAUGHTS = ['mugwort_draught', 'flying_ointment'];
const HEDGE_GIFTS = 1;               // cuttings brought back from the other side
const HEDGE_GIFTS_PATH = 2;          // …by a Hedge Witch
const HEDGE_VISIONS = [
  'You ride out over the hedge and the Wilds lie below you like a map someone forgot to finish.',
  'An owl flies level with you for a while, then turns its head and is gone.',
  'Down in the dark a fire burns that nobody in the town has lit.',
  'You pass over the barrows. Something there looks up, and lets you pass.',
  'The wind on the other side smells of rain that has not fallen yet.',
  'You see your own cottage from above, very small, its hearth the only light.',
  'A white hare runs the hedge-line beneath you all the way to the river.',
];

// ── Kitchen: the crossed loaf ───────────────────────────────────────────────
const LOAVES_PER_DAY = 1;
const LOAVES_PER_DAY_PATH = 2;

const PRACTICES = [
  {
    id: 'green', path: 'green', icon: '🌿', name: 'Wort-Cunning',
    verb: 'Gather a herb in its planet\'s hour',
    how: "Harvest a garden bed in the hour of that herb's ruling planet (the ⏳ chip shows the hour) and it yields more. Each herb's ruler is shown on its bed.",
    lore: "Nicholas Culpeper's English Physitian (1652; the Complete Herbal of 1653 and after) gives nearly every herb a ruling planet: St John's wort is \"under the celestial sign Leo, and the dominion of the Sun\", and his first catalogue puts chamomile under the Sun too; mugwort and yarrow are Venus's; comfrey and henbane Saturn's, though of henbane he wonders \"how astrologers could take on them to make this an herb of Jupiter\". And he says to \"Gather all leaves in the hour of that planet that governs them.\" Far older, Pliny's Natural History (1st century AD) reports, half mocking, the rules of the Druids and the magicians: selago gathered \"without the use of iron, the right hand being passed... through the left sleeve of the tunic\", samolus \"gathered fasting with the left hand\", and a plant \"gathered before sunrise on the banks of a stream\".",
    tier: 'record', source: 'N. Culpeper, The English Physitian (1652), "A Catalogue of the Herbs" · N. Culpeper, The Complete Herbal (1653), entries and "Directions" · Pliny, Natural History 24.62–63, 24.107, tr. J. Bostock & H. T. Riley (1856)',
  },
  {
    id: 'lunar', path: 'lunar', icon: '🌕', name: 'Drawing Down the Moon',
    verb: 'Draw down the moon',
    how: 'Under the open sky at night, once each night: the moon\'s light settles on you and you learn faster for half an hour — twice as much under a full moon.',
    lore: "Among the oldest witch-figures of Greek literature (Homer's Circe is older still) are the Thessalian women who \"draw down the moon\". In Aristophanes' Clouds (423 BC) the debtor Strepsiades dreams: \"If I were to purchase a Thessalian witch, and draw down the moon by night, and then shut it up... If the moon were to rise no longer anywhere, I should not pay the interest\", for money was lent by the month. Plato's Gorgias speaks of \"the creatures who would draw down the moon, the hags of Thessaly\", and of the price it costs them. The \"Drawing Down the Moon\" of modern Wicca, a priestess invoking the Goddess, is a 20th-century rite that took the ancient name; Margot Adler's book of that title (1979) made it widely known.",
    tier: 'record', source: "Aristophanes, Clouds 749–756 (423 BC), tr. W. J. Hickie · Plato, Gorgias 513a, tr. W. R. M. Lamb · Homer, Odyssey 10 · M. Adler, Drawing Down the Moon (1979)",
  },
  {
    id: 'hedge', path: 'hedge', icon: '🦉', name: 'Riding the Hedge',
    verb: 'Ride the hedge',
    how: 'At night in the Wilds, take a trance draught — Mugwort Draught or Flying Ointment — and cross over. You come back with a vision and a cutting of a hedge herb from the other side. Once a night.',
    lore: "The hedge was the boundary between the village and the wild, and so between this world and the other. In the Old Norse Hávamál (st. 155) Odin knows a charm for when he sees túnriður \"play in the air\", so that they go astray, lost from their own shapes and their own minds; Cleasby and Vigfússon gloss the word \"hedge-rider\", a witch or ghost, for they \"were thought to ride on hedges and the tops of houses during the night\" (Bellows has \"house-riders\"). Flying ointments first appear in 15th-century writers such as Johannes Hartlieb (1455–6), whose \"vngentum pharelis\" was rubbed on a bench or broom to fly. \"Hedge witch\" as a name for a solitary practitioner is modern, made popular by Rae Beth's Hedge Witch (1990).",
    tier: 'record', source: 'Hávamál st. 155 (Poetic Edda), tr. H. A. Bellows (1923; his st. 156) · R. Cleasby & G. Vigfússon, An Icelandic-English Dictionary (1874), "tún-riða" · J. Hartlieb, Buch aller verbotenen Kunst (1455–6), in J. Grimm, Deutsche Mythologie · R. Beth, Hedge Witch (1990)',
  },
  {
    id: 'kitchen', path: 'kitchen', icon: '🍞', name: 'The Crossed Loaf',
    verb: 'Cross a loaf and bake it',
    how: 'At your own hearth: cut a cross in the dough and bake a Hearth Loaf, once a day. It heals, and travels in a pack like any other bread.',
    lore: "Cutting a cross into a loaf before it went into the oven was ordinary household custom: in 1881 \"many a housewife still marks the sign of the cross upon her loaf before placing it in the oven… to protect it against the injurious influence of witchcraft\" (Thiselton-Dyer); in Yorkshire it was \"crossing the witches out\", and elsewhere to keep the Devil out. In Ireland, children told the Folklore Commission in the 1930s, the cross went on the soda bread \"so that the fairies wouldn't touch it during the night\", or so it would rise and not burst. In Cornwall \"Bread baked on this day never gets mouldy\" on Good Friday, and the Good Friday bun \"is hung up in the kitchen from one year to the other\" against sickness (Courtney, 1890); Hone's Good Friday cake hung from the ceiling \"preserves the house from fire\".",
    tier: 'folk', source: 'T. F. Thiselton-Dyer, Domestic Folk-Lore (1881) · I. Opie & M. Tatem, A Dictionary of Superstitions (1989), "bread" · Schools\' Collection, Galway (1937–39) · M. A. Courtney, Cornish Feasts and Folk-Lore (1890) · W. Hone, The Every-Day Book (1826–27), Good Friday',
  },
];

module.exports = {
  PRACTICES, CULPEPER_RULERS, GREEN_HOUR_BONUS, GREEN_HOUR_BONUS_PATH,
  DRAW_DOWN, HEDGE_DRAUGHTS, HEDGE_GIFTS, HEDGE_GIFTS_PATH, HEDGE_VISIONS,
  LOAVES_PER_DAY, LOAVES_PER_DAY_PATH,
};
