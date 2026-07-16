// The Wheel of the Year — Thornreach's living seasons (Tier 3.5).
//
// Eight sabbats of the pagan Wheel of the Year, each opening a ~6–7 week season
// that runs until the next sabbat begins. Which one is "live" is derived purely
// from the calendar date (UTC) by seasonWindow() in lib/calendar.js — the same
// no-scheduler, wall-clock-derived approach as the festival + blood-moon
// windows, so every restart and every client agrees.
//
// `month`/`day` are the sabbat's start date (month is 1–12 for readability; the
// solstice/equinox dates are the conventional fixed observances). Ordered around
// the wheel; the list wraps (Yule → Imbolc across the New Year).
//
// `effects` are DECLARED here as the season's intended gameplay tie-in. They are
// intentionally NOT yet applied to combat/XP/forage math in this slice: those
// paths are covered by deterministic pacing tests, and an always-on seasonal
// multiplier would make the suite depend on which sabbat is live when CI runs.
// A follow-up wires them on test-isolated paths. Flavor (name/epithet/glyph/
// blurb/blessing) ships live now and is broadcast to clients for display.

const SABBATS = [
  {
    key: 'imbolc', name: 'Imbolc', epithet: 'the First Stirring', glyph: '🌱',
    month: 2, day: 1,
    blurb: "The first green stirs beneath the snow. Sacred to Brigid of healing, poetry and the forge — a season of quickening, purification and the returning hearth-light.",
    blessing: "🌱 Imbolc stirs beneath Thornreach's frost — Brigid's first green breaks the snow, and healing quickens in the cold.",
    effects: { forageBonus: 0.10, regenBonus: 0.8 }
  },
  {
    key: 'ostara', name: 'Ostara', epithet: 'the Balance of Spring', glyph: '🥚',
    month: 3, day: 20,
    blurb: "Day and night stand equal as spring surges. Eggs, hares and blossoms — the world wakes and multiplies. A season of renewal, fertility and fresh beginnings.",
    blessing: "🥚 Ostara balances Thornreach — day equals night and the world blooms awake. The Wilds grow green and generous.",
    effects: { forageBonus: 0.15 }
  },
  {
    key: 'beltane', name: 'Beltane', epithet: 'the Bright Fire', glyph: '🔥',
    month: 5, day: 1,
    blurb: "Bel's fires blaze and life runs at full flood. Fertility, passion and the leap over the flame into summer — one of the two nights the veil also thins.",
    blessing: "🔥 Beltane blazes over Thornreach — Bel's bright fire leaps, and every living thing burns brighter. Summer is coming in.",
    effects: { xpMult: 1.10, fireBonus: 0.30 }
  },
  {
    key: 'litha', name: 'Litha', epithet: 'the Sun at its Height', glyph: '☀️',
    month: 6, day: 21,
    blurb: "The longest day. The sun stands at the peak of its power, a season of confidence, vitality and fullness — before the slow turn back toward the dark.",
    blessing: "☀️ Litha crowns Thornreach — the sun stands at its height and strength runs long into the evening. Make the most of the light.",
    effects: { xpMult: 1.15 }
  },
  {
    key: 'lughnasadh', name: 'Lughnasadh', epithet: 'the First Harvest', glyph: '🌾',
    month: 8, day: 1,
    blurb: "The first grain is cut. Named for Lugh — a festival of skill, games and craft, and of giving thanks for the first fruits of hard labor.",
    blessing: "🌾 Lughnasadh gilds Thornreach — the first harvest is in, and Lugh's games call the skilled to compete. Reap, and give thanks.",
    effects: { xpMult: 1.10, forageBonus: 0.10 }
  },
  {
    key: 'mabon', name: 'Mabon', epithet: 'the Second Harvest', glyph: '🍂',
    month: 9, day: 21,
    blurb: "Day and night balance again as the second harvest is gathered. A season of gratitude and plenty — and of releasing what will not survive the coming dark.",
    blessing: "🍂 Mabon settles over Thornreach — the second harvest is gathered and the year turns inward. Take stock, and be grateful.",
    effects: { forageBonus: 0.15, lootBonus: 0.20 }
  },
  {
    key: 'samhain', name: 'Samhain', epithet: "the Witches' New Year", glyph: '🕯️',
    month: 10, day: 31,
    blurb: "The final harvest, and the turning of the year. The veil between the living and the dead thins to nothing — a season to honor the ancestors, practice divination, and beware what crosses over.",
    blessing: "🕯️ Samhain has come to Thornreach — the veil thins, and the dead walk closer to the torchlight. Honor them, and guard your lantern.",
    effects: { xpMult: 1.15, veilThin: true }
  },
  {
    key: 'yule', name: 'Yule', epithet: 'the Longest Night', glyph: '❄️',
    month: 12, day: 21,
    blurb: "The sun dies and is reborn. The longest night holds, then yields to the returning light — a season of hearth, hope, protection and rest.",
    blessing: "❄️ Yule falls on Thornreach — the longest night holds, but the light is already turning back. Gather by the hearth.",
    effects: { xpMult: 1.10, restBonus: 0.8 }
  }
];

module.exports = { SABBATS };
