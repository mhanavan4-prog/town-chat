// ---------------------------------------------------------------------------
// May Eve, 30 April: rowan crosses made without a knife for the house and byre
// doors, primroses strewn on the threshold, rowan bound round the milk pail and
// churn, and no fire, milk or salt given out of the house, against the witches
// who steal the milk and butter on May morning. The caller is dated by the
// Commonplace Book's own entry (when: { calendar: 'may_eve' }).
//
// Sources: A. W. Moore, The Folk-Lore of the Isle of Man (1891), chs V–VII
// (with Mona's Herald, 5 May 1837, as he quotes it), read in the Manx Note
// Book transcription; Lady Wilde, Ancient Legends of Ireland (1887), "The May
// Festival"; R. Chambers, Popular Rhymes of Scotland (1826), p. 277, as the
// Dictionary of the Scots Language gives it (second-hand); the RHS on rowan
// and marsh marigold; the Woodland Trust on rowan berries and foraging; the
// Heather and Grass etc. (Burning) (England) Regulations 2007 and Ireland's
// Wildlife Act 1976, s. 40, on burning gorse. Left out: the name "crosh cuirn"
// (not Moore's), wool or thread binding the Manx crosses, the Manx name of the
// cow-house herb (Moore glosses it two ways), parasorbic acid, and Pennant's
// own words on Banffshire, which couldn't be read.
// ---------------------------------------------------------------------------
const MAY_EVE_RITES = {
  may_eve_rowan: {
    key: 'may_eve_rowan', name: 'Rowan and Primroses', icon: '🍃',
    how: 'On May Eve break rowan twigs by hand, for no knife may touch them, and make small crosses for the house door and the byre door; bind peeled rowan round the milk pail and the churn; strew primroses on the threshold; and give no fire, milk or salt out of the house till May Day is done.',
    outcomes: [
      'Two twigs of rowan, broken by hand and tied crosswise. One cross goes over the house door, and one over the byre.',
      'The primroses are strewn thick on the step, yellow in the dusk. Nothing comes in over them tonight unasked.',
      'A neighbour comes for a coal to light her fire, and is sent off kindly without one. Not on May Day.',
    ],
    lore: 'In the Isle of Man, Moore wrote in 1891, on Oie Voaldyn, May Eve (kept there on 11 May, by the old calendar), "green leaves or boughs and sumark, or primrose flowers, were strewn on the threshold, and branches of the cuirn, or mountain-ash, were made into small crosses without the aid of a knife, which was on no account to be used, and stuck over the doors of the dwelling-houses and cow-houses", and on that night "no one would give fire". A branch of rowan in the cow-house on May Eve was "One of the most efficacious charms to prevent milk being bewitched." In 1837 the Manx "burned all the whin (gorse) bushes in the Island", believing the witches and fairies hid there (Mona\'s Herald). Moore thought the crosses themselves "probably of Christian origin, and, therefore, comparatively speaking of recent date." In Ireland, Lady Wilde (1887) has the witches "make great efforts to steal the milk on May morning", so that "no one will allow milk, or fire, or salt, to be carried away from the house on that day"; "The best preventative is to scatter primroses on the threshold", and the people "cut and peel some branches of the mountain ash, and bind the twigs round the milk pails and the churn". In Dumfriesshire the rhyme went "Rowan-tree, and red thread, Put the witches to their speed!" (Chambers, 1826).',
    tier: 'record',
    source: 'A. W. Moore, The Folk-Lore of the Isle of Man (1891), chs V–VII · Lady Wilde, Ancient Legends of Ireland (1887), "The May Festival" · R. Chambers, Popular Rhymes of Scotland (1826), p. 277, in the Dictionary of the Scots Language, "rowan"',
  },
};

module.exports = { MAY_EVE_RITES };
