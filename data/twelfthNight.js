// ---------------------------------------------------------------------------
// Twelfth Night, 6 January: the Twelfth Cake, with a bean in it for the king
// and a pea for the queen, cut by the slice; later, characters drawn from a
// hat. The caller is dated by the Commonplace Book's own Bean King entry
// (when: { calendar: 'twelfth_night' }); the 5th is "Twelfth-night eve" (Hone).
//
// Sources: R. Herrick, "Twelfth Night: or, King and Queen", Hesperides (1648),
// in A. W. Pollard's text (1891); W. Hone, The Every-Day Book, vol. I (1826),
// 5 and 6 January, quoting Fosbroke; S. Pepys, Diary, 6 January 1668/9; the
// Drury Lane Theatrical Fund on the Baddeley Cake; English Heritage on
// Christmas greenery (Herrick, "Ceremonies for Candlemas Eve"). The Twelfth
// Night rule for taking decorations down is modern, so it isn't given as old.
// ---------------------------------------------------------------------------
const TWELFTH_RITES = {
  twelfth_cake: {
    key: 'twelfth_cake', name: 'The Bean King', icon: '👑',
    how: 'Bake the Twelfth Cake full of plums with a bean in it for the king and a pea for the queen, cut it into a slice for everyone, and crown whoever finds the bean king for the night.',
    outcomes: [
      'The bean is in the miller\'s slice. He is king for the night, and makes the parson sing.',
      'The pea turns up in the smallest girl\'s slice. She is queen, and nobody is allowed to sit down without her leave.',
      'Nobody finds the bean. Then the cook finds it in the last slice, and is king, and says the washing-up is the court\'s.',
    ],
    lore: 'Herrick (1648): "Now, now the mirth comes / With the cake full of plums, / Where bean\'s the king of the sport here", and "The pea also / Must revel, as queen". Fosbroke, in Hone, says "the cake was full of plums, with a bean in it for the king, and a pea for the queen, so as to determine them by the slices." Pepys on 6 January 1669 tried "a new fashion, to prevent spoiling the cake": he "did put so many titles into a hat, and so drew cuts; and I was the Queene". By Hone\'s day (1826) the pastrycooks sold printed characters, each with "a pleasant verse beneath", and every London pastrycook\'s window was full of Twelfth-cakes, where boys would "dexterously nail the coat-tails of spectators, who venture near enough, to the bottoms of the window frames". Herrick\'s drink for the night was a bowl of "gentle lamb\'s wool", ale with sugar, nutmeg and ginger. The actor Robert Baddeley, who died in 1794, left money for "a twelfth Cake or Cakes and Wine and Punch" in the Green Room at Drury Lane every Twelfth Night, and it is still cut there each 6 January. The greenery came down at Candlemas Eve in Herrick\'s day; the rule that it must come down by Twelfth Night is, English Heritage says, "a modern invention".',
    tier: 'record',
    source: 'R. Herrick, Hesperides (1648), ed. A. W. Pollard (1891) · W. Hone, The Every-Day Book, vol. I (1826), 6 January · S. Pepys, Diary, 6 January 1668/9 · Drury Lane Theatrical Fund, "The Baddeley Cake" · English Heritage, "Leaving up Christmas decorations"',
  },
};

module.exports = { TWELFTH_RITES };
