// ---------------------------------------------------------------------------
// Valentine's Eve: the night of 13 February, when a girl pinned bay leaves to
// her pillow and ate a salted egg to dream of her sweetheart, and next morning
// kept her eyes shut till the right one came by. A caller comes on the 13th
// and 14th only (VALENTINE_WHEN, by calendar date, UTC).
//
// Sources: a girl's letter in The Connoisseur, No. 56 (20 February 1755), as
// W. Hone reprinted it in The Every-Day Book, 14 February (the 1755 text was
// not seen directly); S. Pepys, Diary, 14 February 1662.
// ---------------------------------------------------------------------------
const VALENTINE_WHEN = { month: 2, from: 13, to: 14, label: "Valentine's Eve" };

const VALENTINE_RITES = {
  valentine_bay: {
    key: 'valentine_bay', name: 'The Bay Leaves', icon: '🌿',
    how: 'On Valentine\'s Eve pin five bay leaves to the pillow, one at each corner and one in the middle. Eat an egg boiled hard, its yolk taken out and filled with salt, and go to bed without speaking or drinking.',
    outcomes: [
      'She dreams of the miller\'s son mending a gate, and wakes thirsty enough to drink the well dry.',
      'No dream at all, only a terrible thirst. In the morning she keeps her eyes shut until he calls.',
      'She dreams of a man in a red neckerchief. There is only one in the parish, and he is sixty.',
    ],
    lore: 'A girl\'s letter to The Connoisseur in 1755 tells it: "the night before, I got five bay-leaves", "pinned four of them to the four corners of my pillow, and the fifth to the middle;" if she dreamt of her sweetheart they would marry within the year. Then "I boiled an egg hard, and took out the yolk, and filled it with salt;" and "ate it, shell and all, without speaking or drinking after it." Lovers\' names were written on paper, "rolled them up in clay, and put them into water:" "the first that rose up was to be our valentine." Your valentine was also the first of the other sex you saw in the morning, so she "lay a-bed and shut my eyes all the morning, till he came to our house". Pepys kept out of sight one Valentine\'s Day in 1662 "because I would not have his daughter to be my Valentine".',
    tier: 'record',
    source: 'The Connoisseur, No. 56 (20 February 1755), in W. Hone, The Every-Day Book (1826–27), 14 February · S. Pepys, Diary, 14 February 1662',
  },
};

module.exports = { VALENTINE_RITES, VALENTINE_WHEN };
