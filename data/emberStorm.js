// Ash storms in the Ember Wastes (lib/emberStorm.js). Every so often the wind
// gets up and the ash of the burnt country lifts and blows: you can see a few
// strides and no more, and neither can anything out there. The track's
// lanterns are lit for it (client/ember-storm.js), so the field's way is the
// way to keep. Weather one through out in the Wastes and it is in your daybook.
//
// In the record: storms raised by witches. Beyond the record: the game's ash
// storm is weather, not anyone's working.
const STORM = {
  calmMinMs: 10 * 60 * 1000,
  calmMaxMs: 16 * 60 * 1000,
  firstMs: 3 * 60 * 1000,      // the first after a restart comes sooner
  gatherMs: 45 * 1000,         // the warning: the wind getting up
  blowMs: 150 * 1000,          // the storm itself
  aggroMul: 0.5,               // what the Wastes' creatures can see of you in it
  weatherXp: 30,               // for a whole storm weathered out in the Wastes
  says: {
    gathering: '🌫️ The wind is getting up out of the east, and the ash is lifting off the ground. A storm is coming. Keep to the track: its lanterns will be lit.',
    storm: '🌫️ The ash storm is on you. You can see a few strides and no more, and neither can anything out here.',
    calm: '🌫️ The wind drops. The ash comes down out of the air like snow, and the Wastes are there again.',
  },
};

const STORM_LORE = {
  tier: 'record',
  lines: [
    'That witches could raise a storm was believed across Europe and confessed under examination. The best known case in Scotland is North Berwick, in 1590 and 1591. James VI had sailed to Denmark for his bride, Anne, and on the way home their ships met storms. The accused were said to have gathered at the kirk of North Berwick, and to have christened a cat, bound to it parts of a dead man, and cast it into the sea at Leith to raise a wind against the king\'s ship.',
    'The confessions were taken under torture, and the king sat in on some of the examinations himself. A pamphlet, Newes from Scotland, printed the story in 1591, and James went on to write his Daemonologie, published in 1597.',
    'The milder side of the same belief is the wind-seller. Sailors from the Northern Isles bought a fair wind from a wise woman before a voyage, often as a cord or a handkerchief tied in three knots: untie the first for a breeze, the second for a strong wind, and never the third. Walter Scott met one at Stromness, in Orkney, in 1814, an old woman who sold winds to sailors for sixpence.',
  ],
  source: 'Newes from Scotland (1591); James VI, Daemonologie (1597); Walter Scott\'s diary of his voyage round the northern isles, 1814 (in Lockhart\'s Life of Scott); Olaus Magnus, Historia de Gentibus Septentrionalibus (1555), on wind-knots sold in the north.',
  note: 'In the game the ash storm is plain weather. Nobody raised it.',
};

module.exports = { STORM, STORM_LORE };
