// Familiars (Tier 3.5) — the witch's bonded companion. One of the most
// recognizable witch tropes, and the game's first owned companion. A familiar
// follows its witch everywhere (a cosmetic follower rendered client-side, see
// client/familiars.js) and grants one small passive perk mapped to an existing
// derived stat, so no new combat math is needed — familiarBuffContrib adds it
// alongside the ritual blessing.
//
// Chosen/changed freely from the menu; stored on the account so it spans every
// character. The perk is live; the follower is visible to every nearby player.

const FAMILIARS = {
  cat:   { name: 'Black Cat', emoji: '🐈‍⬛', stat: 'forage',   amount: 0.15, blurb: 'A hedge-cat who finds what the Wilds hide — +15% harvest luck.' },
  raven: { name: 'Raven',     emoji: '🐦‍⬛', stat: 'xp',       amount: 0.10, blurb: 'The dead gossip to ravens, and what they learn, you learn — +10% XP.' },
  toad:  { name: 'Toad',      emoji: '🐸',  stat: 'vitality', amount: 25,   blurb: "A toad's old patience steadies the blood — +25 max health." },
  hare:  { name: 'Hare',      emoji: '🐇',  stat: 'swift',    amount: 0.10, blurb: 'Quick as a moonlit hare — +10% move speed.' },
};

module.exports = { FAMILIARS };
