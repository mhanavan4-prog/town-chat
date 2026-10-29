// Witch paths (Tier 3.5) — the identity capstone. Independent of a player's
// class, a witch may walk one of the real traditions. A path is a light framing
// layer: it grants one small passive perk (mapped onto an existing derived stat
// via pathBuffContrib, so no new combat math) and, above all, a sense of who you
// are and which of the witchcraft systems is yours. Chosen/changed freely from
// the menu; stored on the account so it spans every character.

const WITCH_PATHS = {
  green:   { name: 'Green Witch',   emoji: '🌿', stat: 'forage',   amount: 0.10, blurb: 'The hedge and the herb garden are your temple. +10% harvest luck.' },
  lunar:   { name: 'Lunar Witch',   emoji: '🌙', stat: 'xp',       amount: 0.08, blurb: 'You keep the moon\'s calendar and draw on its tides. +8% XP.' },
  hedge:   { name: 'Hedge Witch',   emoji: '🕯️', stat: 'leech',    amount: 0.05, blurb: 'You cross to the other side and bring something back. +5% lifesteal.' },
  kitchen: { name: 'Kitchen Witch', emoji: '🍵', stat: 'vitality', amount: 20,   blurb: 'Magic worked at the hearth, in the pot and the cup. +20 max health.' },
  sea:     { name: 'Sea Witch',     emoji: '🌊', stat: 'swift',    amount: 0.08, blurb: 'You move with the tide and the current. +8% move speed.' },
  hearth:  { name: 'Hearth Witch',  emoji: '🛡️', stat: 'guard',    amount: 0.08, blurb: 'Your threshold is warded and your home holds. +8% damage resist.' },
};

module.exports = { WITCH_PATHS };
