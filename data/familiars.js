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

// ── Familiar coats (cosmetic skins) ─────────────────────────────────────────
// A shared palette of coat colors that recolor whichever familiar you've bonded
// (the primary body material — fur/feather/skin — client-side). 'default' is
// the familiar's natural coat and is always free; the rest are account-wide
// Moonstone cosmetics. Pure flair: the perk is unchanged, and nearby players
// see your coat because familiarSkin rides publicPlayer.
const FAMILIAR_SKINS = [
  { id: 'default',  label: 'Natural',  hex: null },
  { id: 'ashen',    label: 'Ashen',    hex: 0xe8e2d0, ms: 12 },
  { id: 'spectral', label: 'Spectral', hex: 0x8fe9ff, ms: 12 },
  { id: 'ember',    label: 'Ember',    hex: 0xff7a3c, ms: 12 },
  { id: 'moonlit',  label: 'Moonlit',  hex: 0xb9c2ff, ms: 12 },
  { id: 'shadow',   label: 'Shadow',   hex: 0x4a3568, ms: 12 },
  { id: 'verdant',  label: 'Verdant',  hex: 0x5fbf6a, ms: 12 },
  { id: 'rosewood', label: 'Rosewood', hex: 0xd98fa8, ms: 15 },
  { id: 'gilded',   label: 'Gilded',   hex: 0xffcf5a, ms: 15 },
];
const FAMILIAR_SKIN_BY_ID = FAMILIAR_SKINS.reduce((o, s) => { o[s.id] = s; return o; }, {});

module.exports = { FAMILIARS, FAMILIAR_SKINS, FAMILIAR_SKIN_BY_ID };
