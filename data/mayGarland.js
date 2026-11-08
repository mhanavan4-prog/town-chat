// ---------------------------------------------------------------------------
// The May garland, 1 May: children carry a garland of crossed hoops wound with
// flowers, a doll dressed in white in the middle, from door to door for
// pennies. The caller is dated by the Commonplace Book's own entry (when: {
// calendar: 'going_a_maying' }).
//
// Sources: J. G. Frazer, The Golden Bough (abridged, 1922), on Saffron Walden
// and Debden; Folk-Lore 4 (1893), "May-Day in Cheltenham", on Cambridge; W.
// Hone, The Every-Day Book, vol. I (1826), 1 May, on the sweeps' and milkmaids'
// garlands; The Spectator (18 January 1902), "Village Superstitions", on may
// blossom indoors; J. Simpson and S. Roud, A Dictionary of English Folklore
// (2000); the Wildlife and Countryside Act 1981, s. 13, and SI 1998/878 on
// bluebells; Plantlife's code for picking wild flowers; the Woodland Trust;
// the RHS on harmful plants; Devon and Cornwall Police on door-to-door
// visiting. Left out: the "Good morning, ladies and gentlemen" garland rhyme,
// which no nineteenth-century source here gives; Chambers, which couldn't be
// read; and two children carrying the garland on a pole, which only later
// memoirs have.
// ---------------------------------------------------------------------------
const MAY_RITES = {
  may_garland: {
    key: 'may_garland', name: 'The May Garland', icon: '🌼',
    how: 'Bind two hoops crossed at right angles, wind them thick with flowers, hang a doll dressed in white in the middle, cover it with a cloth, and carry the garland from door to door on May morning, showing it for pennies.',
    outcomes: [
      'The hoops are crossed and bound, and the flowers go on thick as moss. The doll in white hangs in the middle, a queen.',
      'At the first door the cloth comes off. The woman of the house says it\'s the best garland she\'s seen, and finds a penny.',
      'By noon the money-box rattles and the flowers are wilting. You share the pennies out fair on the last doorstep.',
    ],
    lore: 'The children\'s May garland was, in Simpson and Roud\'s words, "the most widespread and best known May Day activity in the 19th and early 20th centuries". At Saffron Walden and Debden in Essex "on the first of May little girls go about in parties from door to door… carrying garlands; a doll dressed in white is usually placed in the middle of each garland", and "The garlands are generally in the form of hoops intersecting each other at right angles" (Frazer, 1922). The Cambridge children of 1893 "carry a female doll, hung in the midst of a hoop, which is wreathed with flowers" (Folk-Lore). Nobody wrote down who the doll was; "Commentators assume she represented the Virgin Mary." The grown-ups had garlands of their own: in Hone\'s London the sweeps\' "garland is a large cone of holly and ivy framed upon hoops", and the milkmaids carried "a pyramidical frame, covered with damask", and "stopped at their customers\' doors, and danced". But the may blossom itself stayed outside: in 1902 many people still believed it "brings death with it into the house" (The Spectator).',
    tier: 'record',
    source: 'J. G. Frazer, The Golden Bough (1922) · Folk-Lore 4 (1893), "May-Day in Cheltenham" · W. Hone, The Every-Day Book, vol. I (1826), 1 May · The Spectator (18 January 1902), "Village Superstitions" · J. Simpson and S. Roud, A Dictionary of English Folklore (2000)',
  },
};

module.exports = { MAY_RITES };
