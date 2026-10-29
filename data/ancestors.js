// Samhain personal observance (Tier 3.5) — the Ancestor Altar & Dumb Supper.
//
// Where the coven keeps the big Hollow Vigil together (data/rites.js), this is
// the solitary, intimate rite every real witch keeps at Samhain: set a place at
// the table for your dead, lay down an offering in silence (the dumb supper),
// name a forebear and the virtue you carry forward from them — and receive, in
// return, that forebear's blessing.
//
// It opens ONLY while the veil is thin (the Samhain season, per seasonWindow)
// and may be kept once per day — a solemn rite, not a buff vending machine. The
// blessing is a long, gentle passive mapped onto an existing derived stat
// (ancestorBuff slot on the account, so it stacks with a tea rather than
// overwriting it, and spans every character you play).

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

module.exports = { ANCESTOR_BLESSING_HOURS, ANCESTOR_OFFERINGS, ANCESTOR_VIRTUES };
