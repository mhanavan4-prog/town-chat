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
  { day: 1, planet: 'The Moon', stat: 'forage',   glyph: '☽', theme: 'waters, growth & the harvest' },
  { day: 2, planet: 'Mars',     stat: 'power',    glyph: '♂', theme: 'strength, courage & the edge' },
  { day: 3, planet: 'Mercury',  stat: 'swift',    glyph: '☿', theme: 'swiftness, wit & the quick road' },
  { day: 4, planet: 'Jupiter',  stat: 'xp',       glyph: '♃', theme: 'fortune, plenty & good luck' },
  { day: 5, planet: 'Venus',    stat: 'leech',    glyph: '♀', theme: 'love, friendship & life drawn back' },
  { day: 6, planet: 'Saturn',   stat: 'guard',    glyph: '♄', theme: 'binding, endurance & the ward' },
];

const TEAS = [
  // Each herb sits on the day of the planet Culpeper gives it (The English
  // Physitian, 1652; the same rulers as CULPEPER_RULERS in data/practices.js),
  // and a tea carries its day's stat. Ids are stable (they are on accounts).
  // ── ☉ Sunday · The Sun — vitality ─────────────────────────────────────────
  { id: 'hearthmoon_tea', name: 'Hearthmoon Tea', emoji: '🍵', herbs: [{ id: 'healing_herb', qty: 1 }], stat: 'vitality', amount: 15,   hours: 1,   day: 0, lore: "The hearth-witch's first brew — the Sun's warmth drawn into the cup.",            blurb: '+15 max health · the Sun’s warmth in a cup.' },
  { id: 'chamomile_tea',  name: 'Chamomile Tea',  emoji: '🌼', herbs: [{ id: 'chamomile', qty: 1 }],    stat: 'vitality', amount: 12,   hours: 1,   day: 0, lore: 'Calm, sleep and gentle healing; Culpeper puts it under the Sun.',                  blurb: '+12 max health · calm and gentle mending.' },
  { id: 'calendula_tea',  name: 'Calendula Tea',  emoji: '🧡', herbs: [{ id: 'calendula', qty: 1 }],    stat: 'vitality', amount: 20,   hours: 1.5, day: 0, lore: 'Marigold — "the herb of the Sun", says Culpeper; a skin-healer of the cottage.',   blurb: '+20 max health · the marigold’s solar strength.' },
  { id: 'stjohnswort_tea',name: "St. John’s Wort Tea", emoji: '🌞', herbs: [{ id: 'st_johns_wort', qty: 1 }], stat: 'vitality', amount: 22, hours: 1.5, day: 0, lore: "Fuga daemonum, the devil-chaser, gathered on St John's Eve; Culpeper gives it to the Sun.", blurb: '+22 max health · the sun-herb of midsummer.' },
  { id: 'rue_tea',        name: 'Rue Tea',        emoji: '🛡️', herbs: [{ id: 'rue', qty: 1 }],          stat: 'vitality', amount: 18,   hours: 1.5, day: 0, lore: 'The herb of grace, the old ward against the evil eye; "an herb of the Sun", says Culpeper.', blurb: '+18 max health · the herb of grace.' },
  // ── ☽ Monday · The Moon — forage / harvest luck ───────────────────────────
  { id: 'mugwort_tea',    name: 'Water-Lily Tea', emoji: '🪷', herbs: [{ id: 'meditation_lotus', qty: 1 }], stat: 'forage', amount: 0.12, hours: 1, day: 1, lore: 'The lotus of our ponds, the water-lily: cooling and calming, and the Moon\'s own herb in Culpeper.', blurb: '+12% harvest luck · the Moon’s cool water-herb.' },
  // ── ♂ Tuesday · Mars — power ───────────────────────────────────────────────
  { id: 'gingerroot_tea', name: 'Gingerroot Tea', emoji: '🫚', herbs: [{ id: 'swift_root', qty: 1 }],   stat: 'power',    amount: 0.08, hours: 1,   day: 2, lore: 'Hot and quickening. Culpeper has no ginger; later herbals give its fire to Mars.',  blurb: '+8% power · a hot, quickening root.' },
  { id: 'wormwood_tea',   name: 'Wormwood Tea',   emoji: '🌿', herbs: [{ id: 'wormwood', qty: 1 }],     stat: 'power',    amount: 0.12, hours: 1.5, day: 2, lore: 'Bitterest of the herbs, and "an herb of Mars" in Culpeper; strewn against fleas and moths.', blurb: '+12% power · a bitter, iron resolve.' },
  // ── ☿ Wednesday · Mercury — swift ──────────────────────────────────────────
  { id: 'lavender_tea',   name: 'Lavender Tea',   emoji: '💜', herbs: [{ id: 'lavender', qty: 1 }],     stat: 'swift',    amount: 0.09, hours: 1,   day: 3, lore: '"Mercury owns the herb," says Culpeper; sweet-smelling, for the head and for the linen press.', blurb: '+9% move speed · Mercury’s sweet herb.' },
  { id: 'clovermint_tea', name: 'Clovermint Tea', emoji: '🍀', herbs: [{ id: 'cleansing_clover', qty: 1 }], stat: 'swift', amount: 0.10, hours: 1,   day: 3, lore: 'Meadow trefoil, which Culpeper puts under Mercury; and a four-leaved one is luck.',  blurb: '+10% move speed · Mercury’s meadow herb.' },
  // ── ♃ Thursday · Jupiter — xp / fortune ───────────────────────────────────
  { id: 'lemonbalm_tea',  name: 'Lemon Balm Tea', emoji: '🍋', herbs: [{ id: 'lemon_balm', qty: 1 }],   stat: 'xp',       amount: 0.12, hours: 1,   day: 4, lore: '"An herb of Jupiter," says Culpeper, that "causeth the mind and heart to become merry".', blurb: '+12% XP · a merry heart.' },
  { id: 'rowan_tea',      name: 'Rowan Berry Tea', emoji: '🔴', herbs: [{ id: 'rowan_berry', qty: 1 }], stat: 'xp',       amount: 0.15, hours: 2,   day: 4, lore: "The witch-tree's ward and blessing. Culpeper gives the rowan no planet; it keeps Jupiter's day here for its luck.", blurb: '+15% XP · the witch-tree turns luck your way.' },
  // ── ♀ Friday · Venus — leech / life drawn back ────────────────────────────
  { id: 'yarrow_tea',     name: 'Yarrow Tea',     emoji: '🩸', herbs: [{ id: 'yarrow', qty: 1 }],       stat: 'leech',    amount: 0.06, hours: 1,   day: 5, lore: "Achilles' herb, soldiers' woundwort, that staunches a wound; Culpeper gives it to Venus.", blurb: '+6% life drawn on each hit · the wound-herb.' },
  { id: 'vervain_tea',    name: 'Vervain Tea',    emoji: '✨', herbs: [{ id: 'vervain', qty: 1 }],      stat: 'leech',    amount: 0.06, hours: 1,   day: 5, lore: 'Herba sacra, the holy herb of the Romans; Culpeper puts it under Venus.',            blurb: '+6% life drawn on each hit · the holy herb.' },
  { id: 'feverfew_tea',   name: 'Feverfew Tea',   emoji: '🌸', herbs: [{ id: 'feverfew', qty: 1 }],     stat: 'leech',    amount: 0.05, hours: 1,   day: 5, lore: 'Fever, headache and the warding of sickness; "Venus commands this herb," says Culpeper.', blurb: '+5% life drawn on each hit · a soothing ward.' },
  // ── ♄ Saturday · Saturn — guard / warding ─────────────────────────────────
  { id: 'comfrey_tea',    name: 'Comfrey Tea',    emoji: '🤍', herbs: [{ id: 'comfrey', qty: 1 }],      stat: 'guard',    amount: 0.10, hours: 1.5, day: 6, lore: 'Knitbone, for broken bones; "an herb of Saturn", says Culpeper. (Taken inwardly it is now known to harm the liver.)', blurb: '+10% defense · knitbone, Saturn’s herb.' },

  // ── Greater brews — two herbs, a stronger and longer draught. Steeped on the
  // same planetary day as their family (so the day-bonus still applies). ──
  { id: 'suns_blessing',    name: "The Sun’s Blessing", emoji: '🌻', herbs: [{ id: 'chamomile', qty: 1 }, { id: 'calendula', qty: 1 }], stat: 'vitality', amount: 28,   hours: 2, day: 0, greater: true, lore: 'Chamomile and marigold together — the whole hearth’s warmth in one cup.',        blurb: '+28 max health · a greater Sun-day draught.' },
  { id: 'dreamers_draught', name: "The Dreamer’s Draught", emoji: '🌙', herbs: [{ id: 'meditation_lotus', qty: 1 }, { id: 'lavender', qty: 1 }], stat: 'forage', amount: 0.20, hours: 2, day: 1, greater: true, lore: 'Water-lily and lavender — cool and sweet; a sleeping draught, steeped on the Moon’s day for the lily.', blurb: '+20% harvest luck · a greater Moon-day draught.' },
  { id: 'ironblood_tea',    name: 'Ironblood Tea',  emoji: '⚔️', herbs: [{ id: 'yarrow', qty: 1 }, { id: 'wormwood', qty: 1 }], stat: 'power', amount: 0.18, hours: 2, day: 2, greater: true, lore: 'Yarrow and wormwood — a wound-herb and the bitterest herb, steeped strong on the day of wormwood’s Mars.',         blurb: '+18% power · a greater Mars-day draught.' },

  // ── The capstone — The Witches' Brew. Belongs to no single day; it is the
  // craft entire. Locked until you have steeped a tea from each of the seven
  // planetary days (`requires: 'allPlanets'`), then brews from a signature trio.
  { id: 'witches_brew',     name: "The Witches’ Brew", emoji: '🔮', herbs: [{ id: 'meditation_lotus', qty: 1 }, { id: 'yarrow', qty: 1 }, { id: 'rue', qty: 1 }], stat: 'xp', amount: 0.22, hours: 3, day: null, requires: 'allPlanets', lore: 'The Moon’s lily, Venus’s yarrow and the Sun’s rue in one cup — the whole Hearth Path distilled. The master brew of the kitchen witch.', blurb: '+22% XP · the master brew, the craft entire.' },

  // ── 🎡 The Wheel of the Year — a brew for each sabbat, steepable ONLY while
  // its season turns. A reason to come back to the kettle each turn of the year.
  // `sabbat` gates availability to that season (see seasonWindow); `day: null`
  // keeps them out of the planetary families.
  { id: 'imbolc_tea',      name: 'Brigid’s Quickening', emoji: '🌱', herbs: [{ id: 'lemon_balm', qty: 1 }], stat: 'forage', amount: 0.16, hours: 2, day: null, sabbat: 'imbolc', lore: 'Imbolc — the first stirring; Brigid’s flame wakes the quickening earth.',         blurb: '+16% harvest luck · the first stirring of spring.' },
  { id: 'ostara_tea',      name: 'Ostara Bloom Tea',   emoji: '🥚', herbs: [{ id: 'calendula', qty: 1 }],  stat: 'vitality', amount: 22,  hours: 2, day: null, sabbat: 'ostara', lore: 'The spring equinox, new green and new light in equal measure. (The name Ostara was given in the 1970s, after the goddess Ēostre whom only Bede mentions.)', blurb: '+22 max health · the balance of spring.' },
  { id: 'beltane_tea',     name: 'Beltane Fire Tea',   emoji: '🔥', herbs: [{ id: 'swift_root', qty: 1 }], stat: 'power',    amount: 0.14, hours: 2, day: null, sabbat: 'beltane', lore: 'Beltane — the bright fire; the year leaps up in flame and the blood runs high.', blurb: '+14% power · the bright fire of Beltane.' },
  { id: 'litha_tea',       name: 'Litha Sun Tea',      emoji: '☀️', herbs: [{ id: 'st_johns_wort', qty: 1 }], stat: 'xp',    amount: 0.16, hours: 2, day: null, sabbat: 'litha', lore: 'Midsummer, the Sun at its height. (Bede names the summer months Līða; the name was given to the solstice in the 1970s.)',    blurb: '+16% XP · the Sun at its very height.' },
  { id: 'lughnasadh_tea',  name: 'Lammas Grain Tea',   emoji: '🌾', herbs: [{ id: 'cleansing_clover', qty: 1 }], stat: 'forage', amount: 0.18, hours: 2, day: null, sabbat: 'lughnasadh', lore: 'Lughnasadh — the first harvest; the grain cut, the first bread broken.',   blurb: '+18% harvest luck · the first harvest.' },
  { id: 'mabon_tea',       name: 'Mabon Mead Tea',     emoji: '🍂', herbs: [{ id: 'rowan_berry', qty: 1 }], stat: 'forage',   amount: 0.20, hours: 2, day: null, sabbat: 'mabon', lore: 'The autumn equinox; the balance tips toward the dark. (Named Mabon in the 1970s, after the Welsh Mabon ap Modron.)',      blurb: '+20% harvest luck · the second harvest.' },
  { id: 'samhain_tea',     name: 'Samhain Veil Tea',   emoji: '🕯️', herbs: [{ id: 'meditation_lotus', qty: 1 }, { id: 'wormwood', qty: 1 }], stat: 'xp', amount: 0.20, hours: 3, day: null, sabbat: 'samhain', lore: 'Samhain, the start of winter in old Ireland, when the tales say the hollow hills stood open. (Calling it the Witches’ New Year is modern.)', blurb: '+20% XP · the veil thin, the dead close.' },
  { id: 'yule_tea',        name: 'Yule Hearth Tea',    emoji: '❄️', herbs: [{ id: 'chamomile', qty: 1 }, { id: 'comfrey', qty: 1 }], stat: 'vitality', amount: 25, hours: 3, day: null, sabbat: 'yule', lore: 'Yule — the longest night; the hearth held against the dark until the light turns back.',  blurb: '+25 max health · the hearth against the longest night.' },
];

// ── The Hearth Path — a brewing questline (parallel to the garden's Green Path).
// Seven chapters that walk a new kitchen witch from her first steeping to the
// master brew, voiced by Old Mabel, the town's hearth-witch. Chapters auto-
// advance as you brew; each grants herbs (so the garden keeps feeding the
// kettle) and the finale earns the Hearthfire aura. Objective types:
//   brew            — steep any tea
//   brew_greater    — steep a greater (two-herb) draught
//   brew_sabbat     — steep a sabbat tea (in its season)
//   brew_capstone   — steep The Witches' Brew
//   planets         — have brewed a tea under this many distinct planetary days
const HEARTH_PATH = [
  {
    id: 'hp1', title: 'The Kettle’s First Song', band: 'hearth', requiresLevel: 1,
    objective: { type: 'brew', target: 1, label: 'Steep and sip any tea' },
    outro: 'Steam curls up, and from her stool by the fire Old Mabel cracks one eye. "Hah — the kettle sings for you. Good. Here, child, for the next." She tips a twist of chamomile into your hand.',
    xpReward: 30, goldReward: 15, itemRewards: [{ itemId: 'chamomile', qty: 3 }]
  },
  {
    id: 'hp2', title: 'Steeped with Intention', band: 'hearth', requiresLevel: 3,
    objective: { type: 'brew', target: 3, label: 'Brew three teas' },
    outro: '"Three brews, and already your hands know the way of it," says Mabel. "A tea is a spell you can drink, remember that." She presses calendula and lavender on you — "the sun’s flower and the dreaming herb."',
    xpReward: 60, goldReward: 30, itemRewards: [{ itemId: 'calendula', qty: 3 }, { itemId: 'lavender', qty: 3 }]
  },
  {
    id: 'hp3', title: 'Under Three Planets', band: 'hearth', requiresLevel: 6,
    objective: { type: 'planets', target: 3, label: 'Brew teas ruled by three different planets' },
    outro: '"Each day has its planet, and each planet its working — you’re feeling it now," Mabel nods. "Mars for the edge, Mercury for the quick road." She gives you yarrow and vervain to carry them.',
    xpReward: 100, goldReward: 50, itemRewards: [{ itemId: 'yarrow', qty: 3 }, { itemId: 'vervain', qty: 3 }]
  },
  {
    id: 'hp4', title: 'A Greater Draught', band: 'hedge', requiresLevel: 9,
    objective: { type: 'brew_greater', target: 1, label: 'Brew a greater, two-herb draught' },
    outro: '"Two herbs in one pot — now you’re brewing proper," says Mabel, pleased. "Wormwood for the bitter will, comfrey to knit what’s torn. Strong things, the both of them."',
    xpReward: 150, goldReward: 75, itemRewards: [{ itemId: 'wormwood', qty: 3 }, { itemId: 'comfrey', qty: 3 }]
  },
  {
    id: 'hp5', title: 'The Turning of the Year', band: 'hedge', requiresLevel: 12,
    objective: { type: 'brew_sabbat', target: 1, label: 'Brew a sabbat tea, in its season' },
    outro: '"You caught the sabbat on the wing — that’s the hearth-witch’s whole art, brewing with the turning wheel," Mabel says softly. "Rowan to bless it, rue to ward it. The old protection."',
    xpReward: 200, goldReward: 100, itemRewards: [{ itemId: 'rowan_berry', qty: 3 }, { itemId: 'rue', qty: 3 }]
  },
  {
    id: 'hp6', title: 'The Whole Week', band: 'hedge', requiresLevel: 15,
    objective: { type: 'planets', target: 7, label: 'Brew a tea under all seven planets' },
    outro: '"All seven, Sun to Saturn — you’ve walked the whole week now," says Mabel, and there’s respect in it. "One thing left. The brew that is all of them at once." She gives you St. John’s Wort and the dreaming lotus for it.',
    xpReward: 280, goldReward: 140, itemRewards: [{ itemId: 'st_johns_wort', qty: 3 }, { itemId: 'meditation_lotus', qty: 3 }]
  },
  {
    id: 'hp7', title: "The Witches' Brew", band: 'master', requiresLevel: 18,
    objective: { type: 'brew_capstone', target: 1, label: 'Steep The Witches’ Brew — the master draught' },
    outro: '"There," breathes Old Mabel as the master brew settles. "Dream and courage and ward, all in the one cup. There’s nothing left I can teach you, child — the hearth is yours now, and the whole turning year with it. A kitchen witch true." She sets the Hearthfire upon you.',
    xpReward: 500, goldReward: 250, itemRewards: []
  }
];

module.exports = { TEAS, TEA_DAY_BONUS, PLANETS, HEARTH_PATH };
