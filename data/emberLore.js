// Two more places in the Ember Wastes that are out of the record (lib/emberLore.js). Each may be come to once
// a day for a little experience; pressing again that day reads it again. Each says where the record ends.
//
//   🍞 the sin-eater's stone — by the graves at Ashminster
//   🌫️ the watching place    — on the rise north-east of the field, where it can be seen fought again
const EMBER_LORE = [
  {
    id: 'sin', icon: '🍞', name: 'The sin-eater\'s stone', x: 11300, y: 11650, model: 'em_sin_stone', size: 170, turn: 0.5,
    hint: 'look at what has been left on the stone',
    tier: 'record',
    says: '🍞 A flat stone by the graves, with a loaf on it gone hard as wood and a wooden bowl that has held beer. Nobody has come for them. You do not touch either.',
    lore: [
      'John Aubrey wrote that in Herefordshire, when a body had been brought out of the house and laid on the bier, a loaf of bread and a bowl of beer were handed across it to a poor man, the sin-eater, with a little money. He ate and drank, and by doing so took on himself the sins of the dead, so that they should not walk.',
      'Aubrey set it down in 1686 or 1687, in a manuscript that was not printed until 1881, and hardly anyone else of his time mentions it. Some who have studied it think he read an ordinary funeral dole as something stranger. It was still being told of the Welsh border long after: Richard Munslow, a farmer in Shropshire who died in 1906, is remembered as the last to do it.',
    ],
    source: 'John Aubrey, Remaines of Gentilisme and Judaisme (written 1686-87, printed 1881); the doubt is Jane Aaron\'s, among others.',
    note: 'The custom is Aubrey\'s report and is argued over. The stone at Ashminster, with nobody left to eat from it, is the game\'s.',
  },
  {
    id: 'watch', icon: '🌫️', name: 'The watching place', x: 11900, y: 7200, model: 'em_watch_stone', size: 170, turn: 3.6,
    hint: 'sit where the shepherds sat, and watch the field',
    tier: 'record',
    says: '🌫️ You sit on the stone with the field below you. For a while there is only ash and wind. Then, very small and a long way off, drums; and something like a line of men moving where there are no men. You do not stay to see who wins.',
    lore: [
      'The first battle of the English Civil War was fought at Edgehill in Warwickshire on 23 October 1642. Just before Christmas that year, shepherds on the ground said they had heard it and seen it fought again in the night sky: drums, the cries of men, the clash of arms. They told the minister, who went out and said he saw it too.',
      'A pamphlet, A Great Wonder in Heaven, was printed in London in January 1643. By its account and those that followed, the King sent officers from Oxford to look into it, and they swore they had watched it themselves and known faces among the dead, Sir Edmund Verney the standard-bearer among them. The people of Kineton went out and buried the bodies still lying on the field, and after about three months it was seen no more.',
    ],
    source: 'A Great Wonder in Heaven (London, January 1643), and the accounts of Edgehill drawn from it.',
    note: 'That it was reported, printed and looked into is the record; what anybody saw is not for the game to say. A field in the Wastes that fights itself again is the game\'s.',
  },
];
const EMBER_LORE_BY_ID = Object.fromEntries(EMBER_LORE.map((e) => [e.id, e]));
const LORE = { range: 180, xp: 20 };

module.exports = { EMBER_LORE, EMBER_LORE_BY_ID, LORE };
