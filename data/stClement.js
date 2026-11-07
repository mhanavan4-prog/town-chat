// ---------------------------------------------------------------------------
// St Clement's Day, 23 November: Old Clem, the blacksmiths' saint. At Woolwich
// dockyard the smiths' apprentices dressed one of their seniors as Old Clem
// and carried him round the public houses in a chair, with a speech and a
// money-box, for a supper after; in Sussex the smiths had their Old Clem
// supper and toasts, and fired gunpowder on the anvil; in Worcestershire and
// Staffordshire children went "Clemening" for apples. The caller is dated by
// the Commonplace Book's own entry (when: { calendar: 'old_clem' }).
//
// Sources: W. Hone, The Every-Day Book, vol. I (1826), 23 November (J.
// Johnson's letter of 19 November 1825); G. P. G. Hills, "Notes on Some
// Blacksmiths' Legends and the Observance of St. Clement's Day", Hampshire
// Field Club Papers, vol. 8, giving F. E. Sawyer's Sussex informant (Folk-Lore
// Journal II, 1884) and C. M. Yonge's memory of Hursley; the Illustrated
// London News (1857) on Clemening at Enville, as its picture library quotes
// it. Clement's anchor is told as legend. Left out: a "Clemany! Clemany!"
// rhyme often given, which couldn't be found in a source.
// ---------------------------------------------------------------------------
const CLEMENT_RITES = {
  old_clem: {
    key: 'old_clem', name: 'Old Clem', icon: '⚒️',
    how: 'Dress the senior apprentice as Old Clem in a great coat, a wig of oakum, a mask and a long white beard, seat him in the wooden chair with the crown and anchor on top, and carry him round the public houses with the money-box while he says his speech.',
    outcomes: [
      '"I am the real St. Clement, the first founder of brass, iron, and steel, from the ore." The landlord laughs and pays up.',
      'Six of you under the chair, and Old Clem\'s beard catches on the inn sign. The box goes round anyway, and comes back heavy.',
      'At the supper the oldest smith takes the chair and the youngest the vice-chair: "To the memory of Old Clem."',
    ],
    lore: '"St. Clement is the patron of blacksmiths," Hone wrote in 1826, though Brand and the others had not noticed it. At Woolwich dockyard on St Clement\'s evening the blacksmiths\' apprentices chose a senior apprentice "to serve as old Clem", in a great coat, "an oakham wig", a mask and "a long white beard", seated him in "a large wooden chair" with a crown and anchor on top, and carried him round the town, "stopping and refreshing at nearly every public house", with the money-box, to end with "as good a supper as the money collected will allow". His speech began: "I am the real St. Clement, the first founder of brass, iron, and steel, from the ore." The anchor is his legend: he was said to have been thrown into the sea with an anchor tied to him. In Sussex the smiths kept an Old Clem supper, the oldest smith in the chair, with toasts to "True hearts and sound bottoms, / Checked shirts and leather aprons" and, last, "To the memory of Old Clem" (Sawyer, 1884, as Hills gives it); and they fired gunpowder on the anvil, which Charlotte Yonge remembered hearing at Hursley before 1860. Children went "Clemening": in Worcestershire and Staffordshire "the children go the round of the parish begging apples" (Illustrated London News, 1857).',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book, vol. I (1826), 23 November · G. P. G. Hills, "Notes on Some Blacksmiths\' Legends and the Observance of St. Clement\'s Day", Hampshire Field Club Papers, vol. 8 · F. E. Sawyer, "\'Old Clem\' Celebrations and Blacksmiths\' Lore", Folk-Lore Journal II (1884) · Illustrated London News (1857)',
  },
};

module.exports = { CLEMENT_RITES };
