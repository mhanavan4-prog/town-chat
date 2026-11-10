// ---------------------------------------------------------------------------
// Plough Monday: the first Monday after Twelfth Day, when the farm year began
// again and the ploughboys drew a plough round the parish for money. The day
// moves, so its caller is dated by the Commonplace Book's own calendar
// (when: { calendar: 'plough_monday' }, lib/callers.js).
//
// Sources: W. Hone, The Every-Day Book (1826), 7 January (the procession, the
// Fool and Bessy, the plough-light from Blomefield); "plough witches",
// Nottingham Guardian, 13 January 1886; P. Millington, "The Origins of Plough
// Monday", on the regional names and the blackened faces; the Whittlesea
// Straw Bear Festival, revived 1980.
// ---------------------------------------------------------------------------
const PLOUGH_RITES = {
  plough_monday: {
    key: 'plough_monday', name: 'Drawing the Plough', icon: '🐂',
    how: 'Tie on the ribbons, black your faces with soot, and drag the plough by its long ropes from door to door, with Bessy and the Fool and his box for the money.',
    outcomes: [
      'The miller pays up at once. The Fool rattles the box under the parson\'s nose, and Bessy curtseys.',
      'Old Harker won\'t pay. The lads make a great show of setting the share to his lawn, and he pays.',
      'Thirty of you on the ropes, in clean white shirts. The whole street comes out to watch you go by.',
    ],
    lore: 'Plough Monday, "the first Monday after Twelfth-day" (Hone, 1826), began the farm year again. The ploughmen, "stripped to their clean white shirts", drew a plough on long ropes "in procession to the doors of the villagers and townspeople", with Bessy, "an old woman, or a boy dressed up to represent one", and a Fool "attired in skins, with a depending tail" who "carries a box to collect money". A house that would not pay might have its lawn or drive ploughed up. Blacking the face was the commonest disguise, and in parts the ploughboys were called "plough witches" (Nottingham Guardian, 1886). Before the Reformation the money kept a "Plough-light" burning in church, and "on Plough Monday they had a feast". At Whittlesey the Straw Bear, who went out the day after, was revived in 1980.',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book (1826), 7 January · Nottingham Guardian (13 January 1886) · P. Millington, "The Origins of Plough Monday" · Whittlesea Straw Bear Festival, "History"',
  },
};

module.exports = { PLOUGH_RITES };
