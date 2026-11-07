// ---------------------------------------------------------------------------
// Wren Day: St Stephen's Day, 26 December. In Ireland and on the Isle of Man
// (and at Twelfth Night in Pembrokeshire) a wren was hunted and carried from
// house to house on a holly bush or a pole, with a song and a box for money.
// The wren is a protected bird now, and the custom goes on with a straw one;
// so does the game. A caller comes on St Stephen's Day only (WREN_WHEN, by
// calendar date; the 27th too, since the day turns at midnight UTC and an
// evening player in the Americas would otherwise miss it).
//
// Sources: J. G. Frazer, The Golden Bough (abridged 1922), ch. LIV §2; A. W.
// Moore, The Folk-Lore of the Isle of Man (1891), ch. VI, quoting Harrison;
// RTÉ Archives, "Day of the Wren" (1964); Amgueddfa Cymru – Museum Wales,
// wren house 98.333. Legends of the wren's betrayal are told as legend.
// ---------------------------------------------------------------------------
const WREN_WHEN = { month: 12, from: 26, to: 27, label: 'St Stephen\'s Day' };

const WREN_RITES = {
  wren_hunt: {
    key: 'wren_hunt', name: 'Hunting the Wren', icon: '🐦',
    how: 'Tie the straw wren in the middle of a bush of holly and ivy on top of a pole, put on the straw masks, and go from house to house singing for the wren, with a box for the money.',
    outcomes: [
      'At every door: "The wren, the wren, the king of all birds." The pennies go in the box for the dance.',
      'A woman at the third house gives a whole shilling, and takes a feather from the straw wren for luck.',
      'The dog at the forge will not stop barking at the straw masks. The money still goes in the box.',
    ],
    lore: 'On St Stephen\'s Day the wren boys went from house to house with a wren, "the king of birds", fastened "in the middle of a mass of holly and ivy on the top of a broomstick", singing "The wren, the wren, the king of all birds, / St. Stephen\'s Day was caught in the furze" and asking for money (Frazer). In straw costumes and masks they still parade it in Ireland, and the money pays for a party. On the Isle of Man, Moore (1891) called it "the cruel but curious custom of Hunting the Wren": the bird was carried on a pole in a garland, and its feathers were kept as "an effectual preservative against witchcraft", or, some said, from shipwreck for a year. In Pembrokeshire a wren was carried at Twelfth Night in a little wooden "wren house". Why the wren? Legend says it betrayed St Stephen, or Irish soldiers, by its chattering. The wren is a protected bird now, and the wren on the bush is a straw one.',
    tier: 'record',
    source: 'J. G. Frazer, The Golden Bough (abridged 1922), ch. LIV · A. W. Moore, The Folk-Lore of the Isle of Man (1891), ch. VI · RTÉ Archives, "Day of the Wren" (1964) · Amgueddfa Cymru – Museum Wales, wren house 98.333',
  },
};

module.exports = { WREN_RITES, WREN_WHEN };
