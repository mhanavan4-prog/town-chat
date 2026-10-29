// Kitchen witchcraft (Tier 3.5) — teas brewed and sipped with intention. The
// hearth witch's craft: steep a herb into a gentle, long buff. Each tea has a
// planetary DAY of correspondence; brew it on its day and it steeps truer, and
// the buff lasts half again as long. Distinct from Hazel's potions (carried
// items) — a tea is brewed and drunk on the spot, so it applies a timed buff
// in its own slot (teaBuff), stacking with an altar blessing rather than
// overwriting it.
//
// stat maps onto an existing derived stat (teaBuffContrib adds it). hours is the
// base duration; on the tea's `day` (0 Sun … 6 Sat, planetary correspondence)
// it is multiplied by TEA_DAY_BONUS.

const TEA_DAY_BONUS = 1.5;

const TEAS = [
  { id: 'hearthmoon_tea', name: 'Hearthmoon Tea', emoji: '🍵', herbs: [{ id: 'healing_herb', qty: 1 }],     stat: 'vitality', amount: 15,   hours: 1, day: 0, blurb: '+15 max health · the Sun’s warmth in a cup.' },
  { id: 'mugwort_tea',    name: 'Mugwort Tea',    emoji: '🫖', herbs: [{ id: 'meditation_lotus', qty: 1 }], stat: 'forage',   amount: 0.10, hours: 1, day: 1, blurb: '+10% harvest luck · the Moon sharpens the inner eye.' },
  { id: 'gingerroot_tea', name: 'Gingerroot Tea', emoji: '🍵', herbs: [{ id: 'swift_root', qty: 1 }],        stat: 'swift',    amount: 0.08, hours: 1, day: 3, blurb: '+8% move speed · Mercury quickens the step.' },
  { id: 'clovermint_tea', name: 'Clovermint Tea', emoji: '🫖', herbs: [{ id: 'cleansing_clover', qty: 1 }],  stat: 'xp',       amount: 0.10, hours: 1, day: 4, blurb: '+10% XP · Jupiter’s fortune, steeped and sipped.' },
];

module.exports = { TEAS, TEA_DAY_BONUS };
