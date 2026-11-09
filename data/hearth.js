// ---------------------------------------------------------------------------
// Smooring and kindling the fire — the Hebridean hearth, from Alexander
// Carmichael's Carmina Gadelica (1900), vol. 1, "Smooring the Fire" (no. 84)
// and "Blessing of the Kindling" (no. 82). A nightly practice at your own cottage hearth:
// smoor the fire at night with the blessing, and in the morning kindle it again
// from the kept embers.
// ---------------------------------------------------------------------------
const SMOORING = {
  key: 'smooring', name: 'Smooring the Fire', icon: '🔥',
  how: 'Spread the embers in a circle on the hearth and divide it in three, with a small boss in the middle; lay a peat in each third, then cover all with ashes, enough to subdue the fire but not to put it out, and say the blessing.',
  verse: ['The sacred Three', 'To save,', 'To shield,', 'To surround', 'The hearth,', 'The house,', 'The household,', 'This eve,', 'This night,', 'Oh! this eve,', 'This night,', 'And every night,', 'Each single night.'],
  lore: 'Carmichael found the women of the Isles still smooring the fire every night: three peats laid round a boss of embers, "the first … in name of the God of Life, the second … the God of Peace, the third … the God of Grace", then ashes "sufficient to subdue but not to extinguish" it. The little raised heap was Tula nan Tri, the Hearth of the Three, and the woman closed her eyes and softly said the blessing.',
  tier: 'record',
  source: 'A. Carmichael, Carmina Gadelica, vol. 1 (1900), no. 84, "Smooring the Fire"',
};
const KINDLING = {
  key: 'kindling', name: 'Kindling the Fire', icon: '🌅',
  how: 'In the morning, rake back the ashes and blow the kept embers into flame, with the kindling blessing.',
  verse: ['I will kindle my fire this morning', 'In presence of the holy angels of heaven'],
  lore: 'The fire was kept in: "Where wood is not obtainable the fire is kept in during the night", Carmichael wrote, and smoored at night it was kindled again in the morning from the same embers, with a blessing for the day. Carmichael collected several; the women said them low, as they worked.',
  tier: 'record',
  source: 'A. Carmichael, Carmina Gadelica, vol. 1 (1900), no. 82, "Blessing of the Kindling", and no. 84',
};
// Small, honest buffs: the smoored hearth guards the house till dawn; the fire
// kindled from the kept embers warms you through the day.
const HEARTH_BUFFS = { smoor: { stat: 'guard', amount: 0.05 }, kindle: { stat: 'vitality', amount: 20 } };

module.exports = { SMOORING, KINDLING, HEARTH_BUFFS };
