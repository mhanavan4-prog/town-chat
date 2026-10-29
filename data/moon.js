// The Moon — Thornreach's living lunar cycle (Tier 3.5, the keystone of the
// witchcraft layer). Real witchcraft is lunar before it is anything else: a
// witch tracks the moon's phase day to day and holds the esbat at the full
// moon. The town already had a day/night clock and a 13-night blood moon, but
// no waxing/waning/full/new cycle — this file adds the eight phases and what
// each one favors.
//
// Which phase is "live" is derived purely from the wall clock (UTC) by
// moonPhaseWindow() in lib/calendar.js — the same no-scheduler approach as the
// seasons, festival and blood-moon windows, so every restart and every client
// agrees. See LUNAR_MONTH_MS there for the (tunable) compressed month length.
//
// `effects` are the phase's intended gameplay tie-ins. forageBonus is wired live
// now (added to a forager's bonus-yield chance, same path as the season bonus);
// seanceBonus and chargesMoonWater are read by the séance and the (incoming)
// moon-water system. Flavor (name/glyph/intention/blurb) ships live for display.
//
// Order runs new → waxing → full → waning → back to new; index 4 is the full
// moon (moonPhaseWindow keys off that). A blood moon night overrides the live
// phase to a Blood (full) Moon — see the reconcile note in lib/calendar.js.

const MOON_PHASES = [
  {
    key: 'new', name: 'New Moon', glyph: '🌑',
    intention: 'intentions & fresh starts',
    blurb: "The dark of the moon — a clean page. Witches set intentions and plant the seeds of what they mean to grow.",
    effects: { seanceBonus: 0.15 }
  },
  {
    key: 'waxing_crescent', name: 'Waxing Crescent', glyph: '🌒',
    intention: 'growth & drawing in',
    blurb: "The first sliver returns. A time for beginnings to take root and for drawing what you want toward you.",
    effects: { forageBonus: 0.05 }
  },
  {
    key: 'first_quarter', name: 'First Quarter', glyph: '🌓',
    intention: 'decisions & building',
    blurb: "Half-lit and climbing. The moon of momentum — push through resistance and build on what you began.",
    effects: {}
  },
  {
    key: 'waxing_gibbous', name: 'Waxing Gibbous', glyph: '🌔',
    intention: 'refining & attraction',
    blurb: "Almost full. Energy gathers to a point — refine the work and let what you're drawing in come close.",
    effects: { forageBonus: 0.10 }
  },
  {
    key: 'full', name: 'Full Moon', glyph: '🌕',
    intention: 'power, charging & divination',
    blurb: "The moon at her height. Her power peaks — the night of the esbat, when water is charged and the sight runs clear.",
    effects: { forageBonus: 0.15, seanceBonus: 0.25, chargesMoonWater: true, esbat: true }
  },
  {
    key: 'waning_gibbous', name: 'Waning Gibbous', glyph: '🌖',
    intention: 'gratitude & release',
    blurb: "The light begins to ebb. A time of gratitude, of sharing what you've gathered, and of beginning to let go.",
    effects: {}
  },
  {
    key: 'last_quarter', name: 'Last Quarter', glyph: '🌗',
    intention: 'banishing & cleansing',
    blurb: "Half-dark and falling. The moon of release — banish what weighs on you and cleanse what clings.",
    effects: { cleanseBonus: 0.20 }
  },
  {
    key: 'waning_crescent', name: 'Waning Crescent', glyph: '🌘',
    intention: 'rest & deep divination',
    blurb: "The last thin light before the dark. A time for rest, for shadow-work, and for the deepest divination.",
    effects: { seanceBonus: 0.20 }
  },
];

// Index of the full moon within MOON_PHASES (keep in sync with the array above).
const FULL_MOON_INDEX = 4;

module.exports = { MOON_PHASES, FULL_MOON_INDEX };
