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
