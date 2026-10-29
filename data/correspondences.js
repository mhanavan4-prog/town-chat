// Correspondences (Tier 3.5) — the grammar of real witchcraft: herbs, colours,
// days, planets, crystals and moon phases each carry associations, and a working
// is "stronger" when its components and timing align with its intent. This is the
// connective tissue that makes the altar's decorations, the moon, the day of the
// week and an offering actually matter.
//
// First consumer: the manor altar. Each of the six blessings (RITUALS in
// server.js) has corresponding altar decorations, a planetary day, and moon
// phases that favour it. altarAlignment() scores how well a player's altar and
// the moment align with the blessing they're working, returning a bonus that
// scales the blessing's strength. Pure data + pure function, so it is unit-
// testable and shared (the client mirrors the small maps to preview attunement).

// Which altar decorations correspond to each blessing (ritual id -> deco ids).
// 12 decorations map two-to-one onto the six rites, by real association:
// the chalice and candles to life (vigor), raven and incense to air/flight
// (swiftness), pentacle and skull to protection (ward), grimoire and crystals
// to knowledge/amplification (fortune), cauldron and runes to the land and
// binding (forage), bell and mirror to clarity/quickening (quicken).
const RITUAL_DECOS = {
  vigor:     ['chalice', 'candles'],
  swiftness: ['raven', 'incense'],
  ward:      ['pentacle', 'skull'],
  fortune:   ['grimoire', 'crystals'],
  forage:    ['cauldron', 'runes'],
  quicken:   ['bell', 'mirror'],
};

// The planetary day that favours each blessing (0 Sun … 6 Sat, UTC getUTCDay).
// Sun→vigor, Moon→forage (intuition/nature), Mars→ward, Mercury→quicken,
// Jupiter→fortune (prosperity), Venus→swiftness (grace), Saturn→ward (binding).
const DAY_RITUAL = {
  0: 'vigor',     // Sunday — the Sun
  1: 'forage',    // Monday — the Moon
  2: 'ward',      // Tuesday — Mars
  3: 'quicken',   // Wednesday — Mercury
  4: 'fortune',   // Thursday — Jupiter
  5: 'swiftness', // Friday — Venus
  6: 'ward',      // Saturday — Saturn
};

// Which blessings each moon phase especially favours (beyond the flat full-moon
// boost). Keyed by moon-phase key (data/moon.js).
const MOON_RITUAL = {
  waxing_crescent: ['forage', 'fortune'],
  waxing_gibbous:  ['forage', 'fortune'],
  waning_gibbous:  ['ward'],
  last_quarter:    ['ward'],
  waning_crescent: ['ward'],
};

// Bonus weights (additive, then capped). Tuned so a fully-aligned rite roughly
// doubles at its strongest and a bare altar gives the plain blessing.
const ALIGN = {
  perDeco: 0.15,   // each matching decoration placed
  fullMoon: 0.20,  // the full (or blood) moon lifts any rite
  moonFavor: 0.10, // a phase that favours this rite in particular
  dayMatch: 0.15,  // worked on its planetary day
  offering: 0.25,  // a moon-water offering
  samhain: 0.15,   // the thin veil of Samhain deepens every rite
  cap: 0.90,       // maximum total bonus (+90%)
};

// Score how well an altar + moment align with the blessing being worked.
// decos: the player's altar arrangement (array of deco ids | null).
// moon: { key, isFull } from moonPhaseWindow. day: 0–6 (getUTCDay). offered: bool.
// Returns { bonus, reasons:[string] } — bonus scales the blessing strength.
function altarAlignment({ ritualId, decos = [], moon = {}, day = null, offered = false, samhain = false }) {
  const reasons = [];
  let bonus = 0;
  const want = RITUAL_DECOS[ritualId] || [];
  const placed = (decos || []).filter((d) => d && want.includes(d));
  // de-dupe: two of the same deco don't both count
  const matchedDecos = [...new Set(placed)];
  bonus += matchedDecos.length * ALIGN.perDeco;
  if (matchedDecos.length) reasons.push(`${matchedDecos.length} attuned ${matchedDecos.length === 1 ? 'symbol' : 'symbols'}`);
  if (moon && moon.isFull) { bonus += ALIGN.fullMoon; reasons.push('the full moon'); }
  else if (moon && moon.key && (MOON_RITUAL[moon.key] || []).includes(ritualId)) { bonus += ALIGN.moonFavor; reasons.push('the moon favours it'); }
  if (day != null && DAY_RITUAL[day] === ritualId) { bonus += ALIGN.dayMatch; reasons.push('its planetary day'); }
  if (offered) { bonus += ALIGN.offering; reasons.push('your offering'); }
  if (samhain) { bonus += ALIGN.samhain; reasons.push('the thin veil of Samhain'); }
  bonus = Math.min(ALIGN.cap, Math.round(bonus * 100) / 100);
  return { bonus, reasons };
}

module.exports = { RITUAL_DECOS, DAY_RITUAL, MOON_RITUAL, ALIGN, altarAlignment };
