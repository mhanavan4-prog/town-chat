// Solitary seasonal observances (Tier 3.5 → Wheel of the Year).
//
// Where the coven keeps the big seasonal Rite together (data/rites.js), THIS is
// the solitary, intimate rite a witch keeps alone at a sabbat: lay down an
// offering in silence, name what you carry forward, and receive a gentle
// blessing in return. Samhain's is the Ancestor Altar & Dumb Supper — set a
// place for your dead and name a forebear's virtue.
//
// One observance per sabbat, chosen by the live season (seasonWindow().key).
// The server engine and the client panel are GENERIC — each sabbat is just a
// data entry in OBSERVANCES below, so adding the other seven is a data change,
// not a code change (same shape as the coven Rites in data/rites.js). Samhain
// is the first and only one populated so far.
//
// Each observance opens ONLY while its own season is live and may be kept once
// per day — a solemn rite, not a buff vending machine. The blessing is a long,
// gentle passive mapped onto an existing derived stat (the `ancestorBuff`
// account slot, so it stacks with a tea rather than overwriting it, and spans
// every character you play).

// A long watch — meant to last the evening's play, not a quick top-up.
const ANCESTOR_BLESSING_HOURS = 6;

// The dumb-supper plate. The altar accepts any ONE of these as the offering —
// food for the journey (healing herb), a token for the dead (raven's feather),
// protective salt for the threshold, or a precious draught poured out for a
// deeper remembrance. All are foragable or shop-stocked items already in the
// world (no new catalog entries), so the rite never depends on anything a
// player can't readily get.
const ANCESTOR_OFFERINGS = ['healing_herb', 'ravens_feather_plant', 'salt', 'moonwell_draught'];

// The virtues a forebear may pass on. Each maps to one existing derived stat
// (ancestorBuffContrib adds it), in the same gentle magnitudes as a witch path
// or a tea — small, flavorful, never build-defining.
const ANCESTOR_VIRTUES = [
  { id: 'courage',    name: 'Courage',    emoji: '🔥', stat: 'power',    amount: 0.08, line: 'They never flinched. Carry that into the dark. +8% power.' },
  { id: 'wisdom',     name: 'Wisdom',     emoji: '🦉', stat: 'xp',       amount: 0.10, line: 'They taught you to look twice and listen first. +10% XP.' },
  { id: 'protection', name: 'Protection', emoji: '🛡️', stat: 'guard',    amount: 0.08, line: 'They kept the threshold so you could sleep. +8% damage resist.' },
  { id: 'endurance',  name: 'Endurance',  emoji: '🌳', stat: 'vitality', amount: 20,   line: 'They outlasted every winter. +20 max health.' },
  { id: 'fortune',    name: 'Fortune',    emoji: '🍀', stat: 'forage',   amount: 0.10, line: 'Their hands were always full come harvest. +10% harvest luck.' },
  { id: 'swiftness',  name: 'Swiftness',  emoji: '🌬️', stat: 'swift',    amount: 0.08, line: 'They were gone down the lane before you looked up. +8% move speed.' },
];

// ── The Wheel of the Year — one solitary observance per sabbat ──────────────
// Keyed by season (seasonWindow().key). `text` holds the panel's flavor so the
// one generic modal reads right for each sabbat; `{hours}` in `hint` is filled
// in server-side. The other seven sabbats drop in here as data (Wheel of the
// Year roadmap item) — each with its own altar name, offerings, blessings and
// flavor — and go live automatically when their season arrives.
const OBSERVANCES = {
  samhain: {
    seasonKey: 'samhain',
    altarName: 'Ancestor Altar',
    glyph: '🕯️',
    blessingHours: ANCESTOR_BLESSING_HOURS,
    offerings: ANCESTOR_OFFERINGS,
    virtues: ANCESTOR_VIRTUES,
    text: {
      hint: 'Set a place at the table for your dead. Lay down an offering in silence — the dumb supper — name a forebear and the virtue you carry forward, and receive their blessing (lasts {hours}h). Once a day.',
      closed: 'The veil is not yet thin. The Ancestor Altar wakes only at Samhain, when the dead walk closer to the torchlight.',
      keptToday: 'You have set a place today, and kept the silence. Return tomorrow to keep the rite again.',
      setButton: '🕯️ Set a place & keep the silence',
      offeringLabel: 'The offering',
      virtueLabel: 'The virtue you carry forward',
      namePlaceholder: 'a name to remember (optional)',
      // toast on a successful keeping; {forWhom} = " for <name>" or ""
      toast: 'You set a place{forWhom} and keep the silence.',
    },
  },

  // ── Yule — the winter solstice, the sun reborn from the longest night ──────
  yule: {
    seasonKey: 'yule', altarName: 'The Long Watch', glyph: '🕯️', blessingHours: ANCESTOR_BLESSING_HOURS,
    offerings: ['rowan_berry', 'rue', 'salt'],
    virtues: [
      { id: 'rekindling',  name: 'Rekindling',  emoji: '🔥', stat: 'vitality', amount: 20,   line: 'The sun is reborn from the longest night. +20 max health.' },
      { id: 'steadfast',   name: 'Steadfast',   emoji: '🛡️', stat: 'guard',    amount: 0.08, line: 'Hold the dark until the light returns. +8% damage resist.' },
      { id: 'hearthlight', name: 'Hearthlight', emoji: '🦉', stat: 'xp',       amount: 0.10, line: 'The long nights are for learning by the fire. +10% XP.' },
    ],
    text: {
      hint: 'Keep one candle lit through the longest night. Lay down an offering, name what you carry into the turning year, and receive the Long Watch’s blessing (lasts {hours}h). Once a day.',
      closed: 'The nights are not yet longest. The Long Watch keeps only at Yule, when the sun turns back toward the light.',
      keptToday: 'You have kept the watch today. Return tomorrow to light the candle again.',
      setButton: '🕯️ Light the candle & keep the watch',
      offeringLabel: 'The offering', virtueLabel: 'The blessing you carry into the year',
      namePlaceholder: 'an intention for the year (optional)',
      toast: 'You light the candle{forWhom} and keep the long watch.',
    },
  },

  // ── Imbolc — first stirrings, Brigid's hearth, purification ────────────────
  imbolc: {
    seasonKey: 'imbolc', altarName: "Brigid's Hearth", glyph: '🌱', blessingHours: ANCESTOR_BLESSING_HOURS,
    offerings: ['cleansing_clover', 'calendula', 'lavender'],
    virtues: [
      { id: 'quickening', name: 'Quickening', emoji: '🌱', stat: 'xp',    amount: 0.10, line: 'The first green stirs under the snow. +10% XP.' },
      { id: 'kindling',   name: 'Kindling',   emoji: '🔥', stat: 'power', amount: 0.08, line: "Brigid's forge-fire catches. +8% power." },
      { id: 'cleansing',  name: 'Cleansing',  emoji: '🛡️', stat: 'guard', amount: 0.08, line: 'The hearth is swept, the year made clean. +8% damage resist.' },
    ],
    text: {
      hint: 'Sweep the hearth and bless the first seeds. Lay down an offering, name what you would see quicken, and receive Brigid’s blessing (lasts {hours}h). Once a day.',
      closed: 'The first stirrings have not come. Brigid’s Hearth wakes only at Imbolc, when the year begins to turn green.',
      keptToday: 'You have tended the hearth today. Return tomorrow to kindle it again.',
      setButton: '🌱 Tend the hearth',
      offeringLabel: 'The offering', virtueLabel: 'The blessing you would quicken',
      namePlaceholder: 'what you would see grow (optional)',
      toast: 'You tend Brigid’s hearth{forWhom} and bless the first seeds.',
    },
  },

  // ── Ostara — the spring equinox, balance, green growth ─────────────────────
  ostara: {
    seasonKey: 'ostara', altarName: 'The Equinox Altar', glyph: '🥚', blessingHours: ANCESTOR_BLESSING_HOURS,
    offerings: ['rainbow_petal', 'featherleaf', 'cleansing_clover'],
    virtues: [
      { id: 'greening', name: 'Greening', emoji: '🍀', stat: 'forage', amount: 0.10, line: 'The whole wood comes back to green. +10% harvest luck.' },
      { id: 'balance',  name: 'Balance',  emoji: '🛡️', stat: 'guard',  amount: 0.08, line: 'Day equals night; you stand even. +8% damage resist.' },
      { id: 'thaw',     name: 'Thaw',     emoji: '🌬️', stat: 'swift',  amount: 0.08, line: 'The quickening earth carries you. +8% move speed.' },
    ],
    text: {
      hint: 'Sow at the balance of the year. Lay down an offering, name what you would set growing, and receive the Equinox blessing (lasts {hours}h). Once a day.',
      closed: 'The year is not yet in balance. The Equinox Altar wakes only at Ostara, when day and night stand even.',
      keptToday: 'You have sown today. Return tomorrow to sow again.',
      setButton: '🥚 Sow at the equinox',
      offeringLabel: 'The offering', virtueLabel: 'The blessing you would set growing',
      namePlaceholder: 'what you would set growing (optional)',
      toast: 'You sow{forWhom} at the balance of the year.',
    },
  },

  // ── Beltane — fire, flowering, the height of spring ────────────────────────
  beltane: {
    seasonKey: 'beltane', altarName: 'The May Fire', glyph: '🔥', blessingHours: ANCESTOR_BLESSING_HOURS,
    offerings: ['calendula', 'rainbow_petal', 'swift_root'],
    virtues: [
      { id: 'passion',  name: 'Passion',  emoji: '🔥', stat: 'power',    amount: 0.08, line: 'Leap the bonfire; the blood runs high. +8% power.' },
      { id: 'blooming', name: 'Blooming', emoji: '🌳', stat: 'vitality', amount: 20,   line: 'Life at its fullest flower. +20 max health.' },
      { id: 'ardor',    name: 'Ardor',    emoji: '🌬️', stat: 'swift',    amount: 0.08, line: 'The dance quickens your feet. +8% move speed.' },
    ],
    text: {
      hint: 'Leap the May fire. Lay down an offering, name the fire you carry, and receive the Beltane blessing (lasts {hours}h). Once a day.',
      closed: 'The fires are not yet lit. The May Fire burns only at Beltane, at the height of the flowering spring.',
      keptToday: 'You have leapt the fire today. Return tomorrow to leap it again.',
      setButton: '🔥 Leap the May fire',
      offeringLabel: 'The offering', virtueLabel: 'The fire you carry',
      namePlaceholder: 'the fire you carry (optional)',
      toast: 'You leap the May fire{forWhom} at the height of spring.',
    },
  },

  // ── Litha — the summer solstice, the sun at its zenith ─────────────────────
  litha: {
    seasonKey: 'litha', altarName: "The Sun's Height", glyph: '☀️', blessingHours: ANCESTOR_BLESSING_HOURS,
    offerings: ['st_johns_wort', 'vervain', 'yarrow'],
    virtues: [
      { id: 'zenith',    name: 'Zenith',    emoji: '🔥', stat: 'power', amount: 0.08, line: 'The sun stands at its highest. +8% power.' },
      { id: 'radiance',  name: 'Radiance',  emoji: '🛡️', stat: 'guard', amount: 0.08, line: 'Clothed in the long light, unafraid. +8% damage resist.' },
      { id: 'longlight', name: 'Longlight', emoji: '🦉', stat: 'xp',    amount: 0.10, line: 'The longest day holds the most to learn. +10% XP.' },
    ],
    text: {
      hint: 'Gather the sun-herbs at midsummer noon. Lay down an offering, name what you would bring into the light, and receive the solstice blessing (lasts {hours}h). Once a day.',
      closed: 'The sun has not yet reached its height. The Sun’s Height wakes only at Litha, the longest day.',
      keptToday: 'You have gathered in the sun today. Return tomorrow to gather again.',
      setButton: '☀️ Gather the sun-herbs',
      offeringLabel: 'The offering', virtueLabel: 'What you bring into the light',
      namePlaceholder: 'what you bring into the light (optional)',
      toast: 'You gather the sun-herbs{forWhom} at the height of the year.',
    },
  },

  // ── Lughnasadh — the first harvest, Lugh the many-skilled ──────────────────
  lughnasadh: {
    seasonKey: 'lughnasadh', altarName: 'The First Sheaf', glyph: '🌾', blessingHours: ANCESTOR_BLESSING_HOURS,
    offerings: ['yarrow', 'comfrey', 'rowan_berry'],
    virtues: [
      { id: 'firstfruits',  name: 'Firstfruits',  emoji: '🍀', stat: 'forage',   amount: 0.10, line: 'The first grain comes in heavy. +10% harvest luck.' },
      { id: 'manyskilled',  name: 'Many-Skilled', emoji: '🦉', stat: 'xp',       amount: 0.10, line: 'Lugh mastered every craft; so may you. +10% XP.' },
      { id: 'provision',    name: 'Provision',    emoji: '🌳', stat: 'vitality', amount: 20,   line: 'The barn fills against the lean months. +20 max health.' },
    ],
    text: {
      hint: 'Offer the first-cut sheaf. Lay down an offering, name the craft you would master, and receive the harvest blessing (lasts {hours}h). Once a day.',
      closed: 'The first grain is not yet cut. The First Sheaf is offered only at Lughnasadh, the opening of the harvest.',
      keptToday: 'You have offered the first sheaf today. Return tomorrow to offer again.',
      setButton: '🌾 Offer the first sheaf',
      offeringLabel: 'The offering', virtueLabel: 'The craft you would master',
      namePlaceholder: 'the craft you would master (optional)',
      toast: 'You offer the first sheaf{forWhom} at the opening of the harvest.',
    },
  },

  // ── Mabon — the autumn equinox, the second harvest, thanksgiving ───────────
  mabon: {
    seasonKey: 'mabon', altarName: 'The Reckoning', glyph: '🍂', blessingHours: ANCESTOR_BLESSING_HOURS,
    offerings: ['rowan_berry', 'calendula', 'wormwood'],
    virtues: [
      { id: 'gratitude',   name: 'Gratitude',   emoji: '🍀', stat: 'forage',   amount: 0.10, line: 'Give thanks for the full harvest. +10% harvest luck.' },
      { id: 'equilibrium', name: 'Equilibrium', emoji: '🛡️', stat: 'guard',    amount: 0.08, line: 'The scales come even as the light fails. +8% damage resist.' },
      { id: 'plenty',      name: 'Plenty',      emoji: '🌳', stat: 'vitality', amount: 20,   line: 'The stores are laid in deep. +20 max health.' },
    ],
    text: {
      hint: 'Weigh the year’s harvest and give thanks. Lay down an offering, name what you are grateful for, and receive the Reckoning’s blessing (lasts {hours}h). Once a day.',
      closed: 'The scales are not yet even. The Reckoning is kept only at Mabon, the balance before the dark.',
      keptToday: 'You have given thanks today. Return tomorrow to weigh the year again.',
      setButton: '🍂 Give thanks & weigh the year',
      offeringLabel: 'The offering', virtueLabel: 'What you give thanks for',
      namePlaceholder: 'what you are grateful for (optional)',
      toast: 'You give thanks{forWhom} and weigh the year’s harvest.',
    },
  },
};

// The observance for a given season key, or null off-season / for a sabbat not
// yet populated. The server passes seasonWindow().key; kept here (not reading
// the calendar itself) so this stays pure data with no lib dependency.
function observanceForSeason(seasonKey) {
  return (seasonKey && OBSERVANCES[seasonKey]) || null;
}

module.exports = {
  ANCESTOR_BLESSING_HOURS, ANCESTOR_OFFERINGS, ANCESTOR_VIRTUES,
  OBSERVANCES, observanceForSeason,
};
