// Coven Rites — a seasonal, coven-only questline keyed to the Wheel of the Year
// (data/seasons.js). One Rite per sabbat; the live one is chosen from the
// current season (lib/calendar.js seasonWindow().key) and rotates automatically
// at each sabbat boundary. The engine (lib/rites.js) and the server wiring are
// generic — this file is just the content, so adding the other seven sabbats
// later is a data change, not a code change.
//
// A Rite is a handful of PHASES done in order. Each phase unlocks a real-time
// "attunement" gate after the PREVIOUS phase completes (the first opens at the
// sabbat start), which is what paces a Rite to roughly a day and stops one
// hyper-active player from blitzing it solo in an hour. Within a phase the
// objectives are CUMULATIVE across the whole coven — everyone's kills/harvests
// pool together — so it scales with participation.
//
// Anti-exploit baked into the shape:
//   • targets scale with coven size: target = base + perMember * memberScale,
//     where memberScale is snapshotted at Rite start (members joining later can
//     still contribute, but the goal doesn't lurch).
//   • maxShare caps how much of one objective a single member may bank
//     (0.5 = nobody does more than half), structurally forcing co-op.
//   • minContributors: a phase won't complete until that many DISTINCT members
//     have banked something toward it.
//   • the candle phase is distinct-by-construction: each member lights their own.

// How long each gated phase waits after the prior one finishes. Overridable for
// playtests/tests via TC_RITE_GATE_HOURS (e.g. a fraction like 0.001 to fast-
// forward); unset in production, where it's the real 8 hours.
const GATE_HOURS = (() => {
  const v = parseFloat(process.env.TC_RITE_GATE_HOURS);
  return Number.isFinite(v) && v >= 0 ? v : 8;
})();

const RITES = {
  // ── Samhain — the Witches' New Year, the veil at its thinnest ──────────────
  samhain: {
    id: 'rite_samhain',
    seasonKey: 'samhain',
    name: 'The Hollow Vigil',
    glyph: '🕯️',
    blurb: "Samhain thins the veil to nothing. The coven keeps the old vigil — gather the offering, light the watch, and hold the dead at the threshold until dawn.",
    // Coven-wide reward: the Samhain blessing (its seasons.js effects) held for
    // the REST of the season, earned rather than merely dated. Granted once, to
    // the whole coven, on completion.
    seasonBuff: true,
    // Per-contributor reward (anyone who banked toward any phase). Scaled by the
    // Rite's member snapshot so a big coven's share isn't diluted to nothing.
    reward: {
      xpBase: 400, xpPerMember: 60,
      goldBase: 250, goldPerMember: 40,
      titleId: 'hollow_vigil'
    },
    phases: [
      {
        id: 'offering', title: 'Gather the Offering', glyph: '🌾',
        gateHours: 0, // opens the moment the sabbat begins
        blurb: "The dead are owed a gift. Bring down the carrion-birds that circle the barrows, and gather raven's-feather for the altar.",
        minContributors: 2,
        objectives: [
          { key: 'crows', kind: 'kill_creature', match: 'gravewing_crow',
            label: 'Gravewing crows felled', base: 8, perMember: 6, maxShare: 0.5 },
          { key: 'feathers', kind: 'harvest_specific', match: 'ravens_feather_plant',
            label: "Raven's-feather gathered", base: 6, perMember: 4, maxShare: 0.5 }
        ]
      },
      {
        id: 'watch', title: 'Light the Watch', glyph: '🕯️',
        gateHours: GATE_HOURS,
        blurb: "Each witch must stand their own watch. Light a candle at the séance altar in the Phantom Parlor — the circle is only as strong as the hands that keep it.",
        // Distinct-contributor phase: a candle per member, no one can light two.
        candles: true,
        label: 'Candles lit at the séance altar',
        candleBase: 2, candlePerMember: 0.5 // target = clamp(round(base+per*scale), 2, scale)
      },
      {
        id: 'veil', title: 'Hold the Veil', glyph: '👻',
        gateHours: GATE_HOURS,
        blurb: "Something is pushing back through. Silence the Fen Hexers in the Delve before their chant tears the seal wide.",
        minContributors: 2,
        objectives: [
          { key: 'hexers', kind: 'kill_creature', match: 'fen_hexer',
            label: 'Fen Hexers silenced', base: 7, perMember: 5, maxShare: 0.5 }
        ]
      }
    ]
  },

  // ── Yule — the Longest Night, the sun dying and reborn ─────────────────────
  yule: {
    id: 'rite_yule',
    seasonKey: 'yule',
    name: 'The Sunreturn Vigil',
    glyph: '❄️',
    blurb: "On the longest night the sun gutters low. The coven banks the hearthfire, keeps the watch through the dark, and at the turning drives back the gathered dead so the new sun can climb.",
    seasonBuff: true,
    reward: {
      xpBase: 400, xpPerMember: 60,
      goldBase: 250, goldPerMember: 40,
      titleId: 'sunreturn'
    },
    phases: [
      {
        id: 'hearth', title: 'Bank the Hearthfire', glyph: '🔥',
        gateHours: 0,
        blurb: "Lay in warmth against the dark. Gather hearth-herbs, and thin the gloom-bats that smother the last of the light.",
        minContributors: 2,
        objectives: [
          { key: 'herbs', kind: 'harvest_specific', match: 'healing_herb',
            label: 'Hearth-herbs gathered', base: 6, perMember: 4, maxShare: 0.5 },
          { key: 'bats', kind: 'kill_creature', match: 'gloom_bat',
            label: 'Gloom-bats scattered', base: 8, perMember: 6, maxShare: 0.5 }
        ]
      },
      {
        id: 'longnight', title: 'Hold the Longest Night', glyph: '🕯️',
        gateHours: GATE_HOURS,
        blurb: "The night is at its deepest. Each witch keeps a flame at the séance altar in the Phantom Parlor until the dark begins to turn.",
        candles: true,
        label: 'Vigil-flames kept at the altar',
        candleBase: 2, candlePerMember: 0.5
      },
      {
        id: 'sunrise', title: 'Kindle the Returning Sun', glyph: '☀️',
        gateHours: GATE_HOURS,
        blurb: "As the light climbs back, the restless dead claw at the dawn. Put the barrow-wights down so the new sun rises clean.",
        minContributors: 2,
        objectives: [
          { key: 'wights', kind: 'kill_creature', match: 'barrow_wight',
            label: 'Barrow-wights laid to rest', base: 7, perMember: 5, maxShare: 0.5 }
        ]
      }
    ]
  },

  // ── Imbolc — the First Stirring, Brigid's returning flame ──────────────────
  imbolc: {
    id: 'rite_imbolc', seasonKey: 'imbolc', name: "Brigid's Kindling", glyph: '🌱',
    blurb: "The first green stirs beneath the snow. The coven purifies the thawing ground, kindles Brigid's flame, and clears the shadows so the new growth can wake.",
    seasonBuff: true,
    reward: { xpBase: 400, xpPerMember: 60, goldBase: 250, goldPerMember: 40, titleId: 'first_flame' },
    phases: [
      {
        id: 'cleanse', title: 'Cleanse the Thaw', glyph: '🌧️', gateHours: 0,
        blurb: "Grave-mites wake in the softening earth. Thin them, and gather the first still-blooms for the purifying smoke.",
        minContributors: 2,
        objectives: [
          { key: 'lotus', kind: 'harvest_specific', match: 'meditation_lotus', label: 'First-blooms gathered', base: 6, perMember: 4, maxShare: 0.5 },
          { key: 'mites', kind: 'kill_creature', match: 'rot_swarm', label: 'Grave-mites cleared', base: 8, perMember: 6, maxShare: 0.5 }
        ]
      },
      { id: 'flame', title: "Kindle Brigid's Flame", glyph: '🕯️', gateHours: GATE_HOURS,
        blurb: "Each witch carries a light to the séance altar in the Phantom Parlor — Brigid's flame is passed hand to hand.",
        candles: true, label: "Flames kindled at the altar", candleBase: 2, candlePerMember: 0.5 },
      {
        id: 'firstgreen', title: 'Wake the First Green', glyph: '🌱', gateHours: GATE_HOURS,
        blurb: "Shadows still smother the tender shoots. Scatter the shade-stalkers so the green can climb to the light.",
        minContributors: 2,
        objectives: [
          { key: 'shades', kind: 'kill_creature', match: 'shade_stalker', label: 'Shade-stalkers scattered', base: 7, perMember: 5, maxShare: 0.5 }
        ]
      }
    ]
  },

  // ── Ostara — the Balance of Spring, blossom and fertility ──────────────────
  ostara: {
    id: 'rite_ostara', seasonKey: 'ostara', name: 'The Blossom Rite', glyph: '🥚',
    blurb: "Day and night stand equal and the world wakes. The coven quickens the fields, keeps the balance, and clears the bramble so spring runs free.",
    seasonBuff: true,
    reward: { xpBase: 400, xpPerMember: 60, goldBase: 250, goldPerMember: 40, titleId: 'spring_equinox' },
    phases: [
      {
        id: 'quicken', title: 'Quicken the Fields', glyph: '🌸', gateHours: 0,
        blurb: "Gather the first petals, and thin the thistlehogs rooting up the new growth before it can bloom.",
        minContributors: 2,
        objectives: [
          { key: 'petals', kind: 'harvest_specific', match: 'rainbow_petal', label: 'Spring petals gathered', base: 6, perMember: 4, maxShare: 0.5 },
          { key: 'hogs', kind: 'kill_creature', match: 'thistlehog', label: 'Thistlehogs driven off', base: 8, perMember: 6, maxShare: 0.5 }
        ]
      },
      { id: 'balance', title: 'Keep the Balance', glyph: '⚖️', gateHours: GATE_HOURS,
        blurb: "Day equals night. Each witch sets a candle at the séance altar to hold the poise of the turning year.",
        candles: true, label: 'Candles set in balance', candleBase: 2, candlePerMember: 0.5 },
      {
        id: 'bramble', title: 'Clear the Bramble', glyph: '🌿', gateHours: GATE_HOURS,
        blurb: "Bramble-boars trample the young blossoms flat. Put them down so the fields can flower.",
        minContributors: 2,
        objectives: [
          { key: 'boars', kind: 'kill_creature', match: 'bramble_boar', label: 'Bramble-boars felled', base: 7, perMember: 5, maxShare: 0.5 }
        ]
      }
    ]
  },

  // ── Beltane — the Bright Fire, the veil thin again ─────────────────────────
  beltane: {
    id: 'rite_beltane', seasonKey: 'beltane', name: 'The Bale-Fire Rite', glyph: '🔥',
    blurb: "Bel's fires leap and the veil thins. The coven gathers the green, lights the bale-fire, and guards the thinning veil until the dawn.",
    seasonBuff: true,
    reward: { xpBase: 400, xpPerMember: 60, goldBase: 250, goldPerMember: 40, titleId: 'bright_fire' },
    phases: [
      {
        id: 'greenwood', title: 'Gather the Green', glyph: '🌼', gateHours: 0,
        blurb: "Cut green for the garlands, and scatter the will-o'-wisps — wild fire-sprites that would steal the bale-fire's spark.",
        minContributors: 2,
        objectives: [
          { key: 'green', kind: 'harvest_specific', match: 'healing_herb', label: 'Green gathered for garlands', base: 6, perMember: 4, maxShare: 0.5 },
          { key: 'wisps', kind: 'kill_creature', match: 'will_o_wisp', label: "Will-o'-wisps scattered", base: 8, perMember: 6, maxShare: 0.5 }
        ]
      },
      { id: 'balefire', title: 'Leap the Bale-Fire', glyph: '🔥', gateHours: GATE_HOURS,
        blurb: "Light the great fire. Each witch leaps it and sets a flame at the séance altar — the bale-fire burns in every hearth.",
        candles: true, label: 'Bale-fire flames lit', candleBase: 2, candlePerMember: 0.5 },
      {
        id: 'veilguard', title: 'Guard the Thinning Veil', glyph: '👁️', gateHours: GATE_HOURS,
        blurb: "On Beltane eve the veil thins and things cross over. Put down the night-howlers before they reach the fires.",
        minContributors: 2,
        objectives: [
          { key: 'howlers', kind: 'kill_creature', match: 'night_howler', label: 'Night-howlers put down', base: 7, perMember: 5, maxShare: 0.5 }
        ]
      }
    ]
  },

  // ── Litha — the Sun at its Height, midsummer ───────────────────────────────
  litha: {
    id: 'rite_litha', seasonKey: 'litha', name: 'The Midsummer Crown', glyph: '☀️',
    blurb: "The longest day, the sun at full power. The coven hoards the long light, crowns the sun, and holds the height against the deep things that hate it.",
    seasonBuff: true,
    reward: { xpBase: 400, xpPerMember: 60, goldBase: 250, goldPerMember: 40, titleId: 'midsummer_crown' },
    phases: [
      {
        id: 'longlight', title: 'Hoard the Long Light', glyph: '☀️', gateHours: 0,
        blurb: "Gather sun-charged roots at their peak, and catch the ember-moths that swarm to the solstice blaze.",
        minContributors: 2,
        objectives: [
          { key: 'root', kind: 'harvest_specific', match: 'swift_root', label: 'Sun-root gathered', base: 6, perMember: 4, maxShare: 0.5 },
          { key: 'moths', kind: 'kill_creature', match: 'embermoth', label: 'Ember-moths caught', base: 8, perMember: 6, maxShare: 0.5 }
        ]
      },
      { id: 'crown', title: 'Crown the Sun', glyph: '👑', gateHours: GATE_HOURS,
        blurb: "At the sun's height each witch lights a midsummer flame at the séance altar to crown the longest day.",
        candles: true, label: 'Midsummer flames lit', candleBase: 2, candlePerMember: 0.5 },
      {
        id: 'height', title: 'Hold the Height', glyph: '⚔️', gateHours: GATE_HOURS,
        blurb: "The deep things loathe the long light and come up snapping. Drive the barrow-maws back into the dark.",
        minContributors: 2,
        objectives: [
          { key: 'maws', kind: 'kill_creature', match: 'barrow_maw', label: 'Barrow-maws driven back', base: 7, perMember: 5, maxShare: 0.5 }
        ]
      }
    ]
  },

  // ── Lughnasadh — the First Harvest, Lugh's games ───────────────────────────
  lughnasadh: {
    id: 'rite_lughnasadh', seasonKey: 'lughnasadh', name: "Lugh's Reaping", glyph: '🌾',
    blurb: "The first grain is cut. The coven reaps the first fruits, lights the Lugh-fire, and proves its strength in the god's own games.",
    seasonBuff: true,
    reward: { xpBase: 400, xpPerMember: 60, goldBase: 250, goldPerMember: 40, titleId: 'first_harvest' },
    phases: [
      {
        id: 'reaping', title: 'Reap the First Grain', glyph: '🌾', gateHours: 0,
        blurb: "Gather the first hale growth, and make the harvest hunt among the duskfawn that graze the ripening fields.",
        minContributors: 2,
        objectives: [
          { key: 'grain', kind: 'harvest_specific', match: 'healing_herb', label: 'First growth reaped', base: 6, perMember: 4, maxShare: 0.5 },
          { key: 'fawn', kind: 'kill_creature', match: 'duskfawn', label: 'Harvest hunt taken', base: 8, perMember: 6, maxShare: 0.5 }
        ]
      },
      { id: 'lughfire', title: 'Light the Lugh-Fire', glyph: '🔥', gateHours: GATE_HOURS,
        blurb: "Each witch lights a fire at the séance altar in thanks for the first fruits of the year's labor.",
        candles: true, label: 'Thanks-fires lit', candleBase: 2, candlePerMember: 0.5 },
      {
        id: 'games', title: "Win Lugh's Games", glyph: '🏅', gateHours: GATE_HOURS,
        blurb: "Lugh's festival is a trial of skill and strength. Best the bog-brutes in the god's own contest.",
        minContributors: 2,
        objectives: [
          { key: 'brutes', kind: 'kill_creature', match: 'bog_brute', label: 'Bog-brutes bested', base: 7, perMember: 5, maxShare: 0.5 }
        ]
      }
    ]
  },

  // ── Mabon — the Second Harvest, the year turning inward ────────────────────
  mabon: {
    id: 'rite_mabon', seasonKey: 'mabon', name: 'The Reckoning Harvest', glyph: '🍂',
    blurb: "Day and night balance again as the last harvest is gathered. The coven brings in the final sheaves, weighs the scales, and releases what will not survive the coming dark.",
    seasonBuff: true,
    reward: { xpBase: 400, xpPerMember: 60, goldBase: 250, goldPerMember: 40, titleId: 'second_harvest' },
    phases: [
      {
        id: 'sheaves', title: 'Gather the Last Sheaves', glyph: '🍂', gateHours: 0,
        blurb: "Gather the autumn caps before the frost, and thin the mire-fowl gorging in the harvest marsh.",
        minContributors: 2,
        objectives: [
          { key: 'caps', kind: 'harvest_specific', match: 'toadstool', label: 'Autumn caps gathered', base: 6, perMember: 4, maxShare: 0.5 },
          { key: 'fowl', kind: 'kill_creature', match: 'mirefowl', label: 'Mire-fowl thinned', base: 8, perMember: 6, maxShare: 0.5 }
        ]
      },
      { id: 'scales', title: 'Weigh the Scales', glyph: '⚖️', gateHours: GATE_HOURS,
        blurb: "Day equals night once more. Each witch sets a candle at the séance altar, giving thanks and weighing the year.",
        candles: true, label: 'Candles set on the scales', candleBase: 2, candlePerMember: 0.5 },
      {
        id: 'release', title: 'Release to the Dark', glyph: '🌑', gateHours: GATE_HOURS,
        blurb: "What cannot last the winter must be let go. Lay the ancient mossbacks to their long rest as the year turns inward.",
        minContributors: 2,
        objectives: [
          { key: 'mossbacks', kind: 'kill_creature', match: 'mossback_tortoise', label: 'Ancient mossbacks released', base: 7, perMember: 5, maxShare: 0.5 }
        ]
      }
    ]
  }
};

// Member-scale clamp: even a duo can attempt a Rite (floor 2), and it never
// scales past a full coven (cap 8, the max roster).
const RITE_MEMBER_FLOOR = 2;
const RITE_MEMBER_CAP = 8;

// Consolation when a Rite expires unfinished at the sabbat's end: contributors
// get this fraction of the per-contributor reward, times the share of phases
// completed, so effort isn't wholly wasted. No season buff on expiry.
const RITE_CONSOLATION_FRACTION = 0.25;

module.exports = { RITES, GATE_HOURS, RITE_MEMBER_FLOOR, RITE_MEMBER_CAP, RITE_CONSOLATION_FRACTION };
