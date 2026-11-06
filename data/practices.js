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
    lore: "Nicholas Culpeper's Complete Herbal (1653) gives nearly every herb a ruling planet — chamomile and St John's wort the Sun's, mugwort and yarrow Venus's, comfrey and henbane Saturn's — and astrological herbalists gathered a herb in its own planet's hour. Far older, Pliny's Natural History (1st century AD) records herbs that had to be gathered with ceremony: before sunrise, fasting, without iron, with the left hand.",
    tier: 'record', source: 'N. Culpeper, The Complete Herbal (1653) · Pliny, Natural History bk. 24',
  },
  {
    id: 'lunar', path: 'lunar', icon: '🌕', name: 'Drawing Down the Moon',
    verb: 'Draw down the moon',
    how: 'Under the open sky at night, once each night: the moon\'s light settles on you and you learn faster for half an hour — twice as much under a full moon.',
    lore: "The oldest witches in European literature are the Thessalian women who 'draw down the moon'. In Aristophanes' Clouds (423 BC) a debtor plans to hire one so the month will never end and his debts never fall due; Plato's Gorgias names them too. The 'Drawing Down the Moon' of modern Wicca — a priestess invoking the Goddess — is a 20th-century rite that took the ancient name.",
    tier: 'record', source: "Aristophanes, Clouds (423 BC) · Plato, Gorgias 513a",
  },
  {
    id: 'hedge', path: 'hedge', icon: '🦉', name: 'Riding the Hedge',
    verb: 'Ride the hedge',
    how: 'At night in the Wilds, take a trance draught — Mugwort Draught or Flying Ointment — and cross over. You come back with a vision and a cutting of a hedge herb from the other side. Once a night.',
    lore: "The hedge was the boundary between the village and the wild, and so between this world and the other. The Old Norse Hávamál (st. 155) speaks of the túnriður — 'fence-riders', witches riding the roofs and hedges — and of the charm that sends them astray. Flying ointments appear in 15th-century writers such as Johannes Hartlieb (1456). 'Hedge witch' as a name for a solitary practitioner is modern, from the 1990s.",
    tier: 'record', source: 'Hávamál st. 155 (Poetic Edda) · J. Hartlieb, Book of All Forbidden Arts (1456)',
  },
  {
    id: 'kitchen', path: 'kitchen', icon: '🍞', name: 'The Crossed Loaf',
    verb: 'Cross a loaf and bake it',
    how: 'At your own hearth: cut a cross in the dough and bake a Hearth Loaf, once a day. It heals, and travels in a pack like any other bread.',
    lore: "Cutting a cross into a loaf before it went into the oven — 'to let the devil out', or in Ireland to let the fairies out of the soda bread — was ordinary household custom across Britain and Ireland, recorded into the 20th century. Bread baked on Good Friday was said never to go mouldy, and a Good Friday bun was kept hanging in the kitchen for the year against fire and sickness.",
    tier: 'folk', source: 'S. Roud, The Penguin Guide to the Superstitions of Britain and Ireland (2003)',
  },
];

module.exports = {
  PRACTICES, CULPEPER_RULERS, GREEN_HOUR_BONUS, GREEN_HOUR_BONUS_PATH,
  DRAW_DOWN, HEDGE_DRAUGHTS, HEDGE_GIFTS, HEDGE_GIFTS_PATH, HEDGE_VISIONS,
  LOAVES_PER_DAY, LOAVES_PER_DAY_PATH,
};
