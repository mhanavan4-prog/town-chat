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
    altarName: 'The Ancestor Altar',
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
