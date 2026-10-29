// The Release Fire (Tier 3.5) — the third classic Samhain rite, letting go.
//
// Where the Ancestor Altar honors the dead, this rite tends to the living: at
// the turning of the year you name what you carry — a grief, a fear, an old
// anger — and give it to the flames. The fire burns away a curse that clings to
// you (your active debuff, if any) and you grow a little, lighter now.
//
// Like the altar it opens ONLY while the veil is thin (the Samhain season) and
// may be kept once per day. The burden you name is private — echoed only back
// to you, and remembered on the hearth between visits. No timed buff: the
// payoff is instant (a cleanse + a small, unfarmable growth), so it adds no new
// stat slot and never overwrites the altar's blessing.

// A small, flat growth for the act of letting go — meaningful at low levels,
// a gentle nod at high ones, and gated to once a day so it can't be farmed.
const RELEASE_XP = 40;

// Gentle example burdens, shown as faded placeholder suggestions in the panel.
// Flavor only; the player writes their own (or nothing).
const RELEASE_PROMPTS = [
  'a fear you have carried too long',
  'an old anger that no longer serves you',
  'a grief you are ready to set down',
  'a doubt that has followed you here',
  'something you cannot change',
];

module.exports = { RELEASE_XP, RELEASE_PROMPTS };
