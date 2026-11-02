// Kitchen witchcraft — The Hearth Path. Teas brewed and sipped with intention,
// the hearth witch's craft: steep a herb into a gentle, long buff. The catalogue
// is organised by the SEVEN PLANETARY DAYS of the witch's week — each day ruled
// by a planet that governs a kind of working. Brew a tea on its planetary day
// and it steeps truer: the buff lasts half again as long (TEA_DAY_BONUS).
//
// This is the kitchen-witch parallel to the garden's Green Path: most of the new
// teas brew from the REAL witch-herbs you grow there (chamomile, lavender,
// yarrow, rue…), so the garden finally feeds the kettle. `stat` maps onto an
// existing derived stat (teaBuffContrib adds it); `hours` is the base duration,
// multiplied by TEA_DAY_BONUS on the tea's `day`. `lore` is the folklore line for
// the Teas Almanac; `blurb` is the gameplay effect. Baneful Poison-Path herbs are
// deliberately never brewed here — you don't drink nightshade.

const TEA_DAY_BONUS = 1.5;

// The planetary days (0 Sun … 6 Sat). Each rules one correspondence, which is the
// stat its teas carry — so "brew on Mars-day for strength" is a real throughline.
const PLANETS = [
  { day: 0, planet: 'The Sun',  stat: 'vitality', glyph: '☉', theme: 'warmth, vitality & healing' },
  { day: 1, planet: 'The Moon', stat: 'forage',   glyph: '☽', theme: 'intuition, dreams & the harvest' },
  { day: 2, planet: 'Mars',     stat: 'power',    glyph: '♂', theme: 'strength, courage & the edge' },
  { day: 3, planet: 'Mercury',  stat: 'swift',    glyph: '☿', theme: 'swiftness, wit & the quick road' },
  { day: 4, planet: 'Jupiter',  stat: 'xp',       glyph: '♃', theme: 'fortune, plenty & good luck' },
  { day: 5, planet: 'Venus',    stat: 'leech',    glyph: '♀', theme: 'love, mending & life drawn back' },
  { day: 6, planet: 'Saturn',   stat: 'guard',    glyph: '♄', theme: 'warding, binding & protection' },
];

const TEAS = [
  // ── ☉ Sunday · The Sun — vitality ─────────────────────────────────────────
  { id: 'hearthmoon_tea', name: 'Hearthmoon Tea', emoji: '🍵', herbs: [{ id: 'healing_herb', qty: 1 }], stat: 'vitality', amount: 15,   hours: 1,   day: 0, lore: "The hearth-witch's first brew — the Sun's warmth drawn into the cup.",            blurb: '+15 max health · the Sun’s warmth in a cup.' },
  { id: 'chamomile_tea',  name: 'Chamomile Tea',  emoji: '🌼', herbs: [{ id: 'chamomile', qty: 1 }],    stat: 'vitality', amount: 12,   hours: 1,   day: 0, lore: 'Calm, sleep and gentle healing; the kindest herb in the cottage garden.',          blurb: '+12 max health · calm and gentle mending.' },
  { id: 'calendula_tea',  name: 'Calendula Tea',  emoji: '🧡', herbs: [{ id: 'calendula', qty: 1 }],    stat: 'vitality', amount: 20,   hours: 1.5, day: 0, lore: "Marigold — the Sun's own flower; skin-healing and solar protection.",               blurb: '+20 max health · the marigold’s solar strength.' },
  // ── ☽ Monday · The Moon — forage / harvest luck ───────────────────────────
  { id: 'mugwort_tea',    name: 'Mugwort Tea',    emoji: '🫖', herbs: [{ id: 'meditation_lotus', qty: 1 }], stat: 'forage', amount: 0.10, hours: 1, day: 1, lore: 'The traveller’s herb; dreams, divination and the inner eye.',                        blurb: '+10% harvest luck · the Moon sharpens the inner eye.' },
  { id: 'lavender_tea',   name: 'Lavender Dream Tea', emoji: '💜', herbs: [{ id: 'lavender', qty: 1 }],  stat: 'forage',   amount: 0.12, hours: 1,   day: 1, lore: 'Peace, cleansing and sleep; the scent that opens the dreaming moon.',               blurb: '+12% harvest luck · a dreaming, cleansing calm.' },
  { id: 'lemonbalm_tea',  name: 'Lemon Balm Tea', emoji: '🍋', herbs: [{ id: 'lemon_balm', qty: 1 }],   stat: 'forage',   amount: 0.14, hours: 1,   day: 1, lore: 'Uplift, ease and clarity; the heart gladdened, the sight cleared.',                 blurb: '+14% harvest luck · a clear and gladdened eye.' },
  // ── ♂ Tuesday · Mars — power ───────────────────────────────────────────────
  { id: 'yarrow_tea',     name: 'Yarrow Courage Tea', emoji: '🩸', herbs: [{ id: 'yarrow', qty: 1 }],   stat: 'power',    amount: 0.08, hours: 1,   day: 2, lore: 'Courage and warding; the herb that staunches a wound and steadies a hand.',         blurb: '+8% power · courage steeped for the fight.' },
  { id: 'wormwood_tea',   name: 'Wormwood Tea',   emoji: '🌿', herbs: [{ id: 'wormwood', qty: 1 }],     stat: 'power',    amount: 0.12, hours: 1.5, day: 2, lore: 'Bitter protection; the sight, the calling of spirits, the iron will.',               blurb: '+12% power · a bitter, iron resolve.' },
  // ── ☿ Wednesday · Mercury — swift ──────────────────────────────────────────
  { id: 'gingerroot_tea', name: 'Gingerroot Tea', emoji: '🫚', herbs: [{ id: 'swift_root', qty: 1 }],   stat: 'swift',    amount: 0.08, hours: 1,   day: 3, lore: 'Fire and quickening; Mercury’s heat that hurries the blood and the step.',          blurb: '+8% move speed · Mercury quickens the step.' },
  { id: 'vervain_tea',    name: 'Vervain Tea',    emoji: '✨', herbs: [{ id: 'vervain', qty: 1 }],      stat: 'swift',    amount: 0.11, hours: 1,   day: 3, lore: 'The all-heal and enchanter’s herb; protection, eloquence, the quick road.',         blurb: '+11% move speed · the enchanter’s quick road.' },
  // ── ♃ Thursday · Jupiter — xp / fortune ───────────────────────────────────
  { id: 'clovermint_tea', name: 'Clovermint Tea', emoji: '🍀', herbs: [{ id: 'cleansing_clover', qty: 1 }], stat: 'xp',   amount: 0.10, hours: 1,   day: 4, lore: 'Jupiter’s fortune, steeped and sipped; luck drawn to the one who drinks.',          blurb: '+10% XP · Jupiter’s fortune in a cup.' },
  { id: 'stjohnswort_tea',name: "St. John’s Wort Tea", emoji: '🌞', herbs: [{ id: 'st_johns_wort', qty: 1 }], stat: 'xp', amount: 0.13, hours: 1.5, day: 4, lore: "The Sun's guard against the dark; gathered at midsummer for light and luck.",       blurb: '+13% XP · the sun-herb’s midsummer luck.' },
  { id: 'rowan_tea',      name: 'Rowan Berry Tea', emoji: '🔴', herbs: [{ id: 'rowan_berry', qty: 1 }], stat: 'xp',       amount: 0.15, hours: 2,   day: 4, lore: "The witch-tree's ward and blessing; the rowan turns ill luck to good.",            blurb: '+15% XP · the witch-tree turns luck your way.' },
  // ── ♀ Friday · Venus — leech / mending ────────────────────────────────────
  { id: 'comfrey_tea',    name: 'Comfrey Tea',    emoji: '🤍', herbs: [{ id: 'comfrey', qty: 1 }],      stat: 'leech',    amount: 0.06, hours: 1,   day: 5, lore: 'Knitbone — mending bone and flesh; life drawn gently back into the body.',           blurb: '+6% life drawn on each hit · the mending herb.' },
  { id: 'feverfew_tea',   name: 'Feverfew Tea',   emoji: '🌸', herbs: [{ id: 'feverfew', qty: 1 }],     stat: 'leech',    amount: 0.05, hours: 1,   day: 5, lore: 'Fever, headache and the warding of sickness; Venus’s soothing hand.',               blurb: '+5% life drawn on each hit · a soothing ward.' },
  // ── ♄ Saturday · Saturn — guard / warding ─────────────────────────────────
  { id: 'rue_tea',        name: 'Rue Ward Tea',   emoji: '🛡️', herbs: [{ id: 'rue', qty: 1 }],          stat: 'guard',    amount: 0.10, hours: 1.5, day: 6, lore: 'The herb of grace; banishing, breaking curses, the old ward against ill.',          blurb: '+10% defense · the herb of grace, warding ill.' },

  // ── Greater brews — two herbs, a stronger and longer draught. Steeped on the
  // same planetary day as their family (so the day-bonus still applies). ──
  { id: 'suns_blessing',    name: "The Sun’s Blessing", emoji: '🌻', herbs: [{ id: 'chamomile', qty: 1 }, { id: 'calendula', qty: 1 }], stat: 'vitality', amount: 28,   hours: 2, day: 0, greater: true, lore: 'Chamomile and marigold together — the whole hearth’s warmth in one cup.',        blurb: '+28 max health · a greater Sun-day draught.' },
  { id: 'dreamers_draught', name: "The Dreamer’s Draught", emoji: '🌙', herbs: [{ id: 'meditation_lotus', qty: 1 }, { id: 'lavender', qty: 1 }], stat: 'forage', amount: 0.20, hours: 2, day: 1, greater: true, lore: 'Mugwort and lavender — the flying ointment’s gentler cousin; the dreaming road.', blurb: '+20% harvest luck · a greater Moon-day draught.' },
  { id: 'ironblood_tea',    name: 'Ironblood Tea',  emoji: '⚔️', herbs: [{ id: 'yarrow', qty: 1 }, { id: 'wormwood', qty: 1 }], stat: 'power', amount: 0.18, hours: 2, day: 2, greater: true, lore: 'Yarrow and wormwood — courage and iron will, steeped bitter and strong.',         blurb: '+18% power · a greater Mars-day draught.' },

  // ── The capstone — The Witches' Brew. Belongs to no single day; it is the
  // craft entire. Locked until you have steeped a tea from each of the seven
  // planetary days (`requires: 'allPlanets'`), then brews from a signature trio.
  { id: 'witches_brew',     name: "The Witches’ Brew", emoji: '🔮', herbs: [{ id: 'meditation_lotus', qty: 1 }, { id: 'yarrow', qty: 1 }, { id: 'rue', qty: 1 }], stat: 'xp', amount: 0.22, hours: 3, day: null, requires: 'allPlanets', lore: 'Dream, courage and ward in one cup — the whole Hearth Path distilled. The master brew of the kitchen witch.', blurb: '+22% XP · the master brew, the craft entire.' },
];

module.exports = { TEAS, TEA_DAY_BONUS, PLANETS };
