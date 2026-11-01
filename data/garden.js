// Green-witch gardening (Tier 3.5) — grow your own herbs. The town had
// gather-and-regrow foraging but no cultivation; this closes the loop: plant a
// herb you hold, let it grow, and harvest more than you sowed — more still when
// you plant as the moon fills. A personal, account-scoped garden (menu-based),
// so every witch can tend one.

const GARDEN_PLOTS = 4;                   // beds per witch
const GARDEN_GROW_MS = 60 * 60 * 1000;    // 60 minutes to mature (rush it with 💎)
const GARDEN_RUSH_MS_COST = 5;            // 💎 Moonstones to grow one bed instantly (the whole price dial)

// The brewing staples you can sow (all common harvestable herbs).
const PLANTABLE_HERBS = ['healing_herb', 'regen_root', 'swift_root', 'cleansing_clover', 'meditation_lotus', 'pumpkin_blossom',
  // Green Path herbs — only sowable once a chapter has granted you some (you
  // can't hold them otherwise), so adding them here just makes them plantable.
  'chamomile', 'calendula',
  // Hedge & Wild herbs — drop-only (never wild-scattered); once a creature drops
  // you a cutting, you can grow more here.
  'mugwort', 'yarrow',
  // Cottage Garden band (granted by Green Path chapter 3).
  'comfrey', 'lemon_balm', 'feverfew', 'lavender',
  // Hedge & Wild band (granted by Green Path chapters 4–6).
  'vervain', 'wormwood', 'rue', 'st_johns_wort', 'rowan_berry',
  // The Poison Path band (granted by Green Path chapters 7–9).
  'belladonna', 'henbane', 'mandrake', 'wolfsbane', 'datura', 'hemlock', 'foxglove', 'black_hellebore'];

// Yield is set by the moon phase AT PLANTING — sow as the moon waxes or fills
// for a richer crop. You always sow one seed, so even 'other' nets a gain.
const MOON_YIELD = { full: 4, waxing: 3, other: 2 };
function moonTierAtPlant(moon) {
  if (moon && moon.isFull) return 'full';
  if (moon && ['waxing_crescent', 'first_quarter', 'waxing_gibbous'].includes(moon.key)) return 'waxing';
  return 'other';
}

module.exports = { GARDEN_PLOTS, GARDEN_GROW_MS, GARDEN_RUSH_MS_COST, PLANTABLE_HERBS, MOON_YIELD, moonTierAtPlant };
