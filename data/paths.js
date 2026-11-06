// Witch paths (Tier 3.5) — the identity capstone. Independent of a player's
// class, a witch may walk one of the real traditions. A path is a light framing
// layer: it grants one small passive perk (mapped onto an existing derived stat
// via pathBuffContrib, so no new combat math) and, above all, a sense of who you
// are and which of the witchcraft systems is yours. Chosen/changed freely from
// the menu; stored on the account so it spans every character.
//
// `practice` names the path's verb — the real tradition it works (data/wards.js,
// data/cords.js, data/practices.js). Shipped to the client in `init`, so the
// picker can't drift from what the server actually does.

const WITCH_PATHS = {
  green:   { name: 'Green Witch',   emoji: '🌿', stat: 'forage',   amount: 0.10, blurb: 'The hedge and the herb garden are your temple. +10% harvest luck.', perk: '+10% harvest luck', practice: '🌿 Wort-cunning — gather each herb in its planet\'s hour for a richer harvest' },
  lunar:   { name: 'Lunar Witch',   emoji: '🌙', stat: 'xp',       amount: 0.08, blurb: 'You keep the moon\'s calendar and draw on its tides. +8% XP.', perk: '+8% XP', practice: '🌕 Drawing down the moon — the moon\'s light on you, and you learn faster' },
  hedge:   { name: 'Hedge Witch',   emoji: '🕯️', stat: 'leech',    amount: 0.05, blurb: 'You cross to the other side and bring something back. +5% lifesteal.', perk: '+5% lifesteal', practice: '🦉 Riding the hedge — cross over at night and bring back two cuttings' },
  kitchen: { name: 'Kitchen Witch', emoji: '🍵', stat: 'vitality', amount: 20,   blurb: 'Magic worked at the hearth, in the pot and the cup. +20 max health.', perk: '+20 max health', practice: '🍞 The crossed loaf — bake two Hearth Loaves a day' },
  sea:     { name: 'Sea Witch',     emoji: '🌊', stat: 'swift',    amount: 0.08, blurb: 'You move with the tide and the current. +8% move speed.', perk: '+8% move speed', practice: '🪢 Selling the wind — tie two wind cords a day, and your knots blow longer' },
  hearth:  { name: 'Hearth Witch',  emoji: '🛡️', stat: 'guard',    amount: 0.08, blurb: 'Your threshold is warded and your home holds. +8% damage resist.', perk: '+8% damage resist', practice: '🍶 Warding the house — your witch bottle and marks hold stronger' },
};

module.exports = { WITCH_PATHS };
