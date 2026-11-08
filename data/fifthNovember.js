// ---------------------------------------------------------------------------
// The Fifth of November: a Guy of straw in old clothes, with a dark lantern
// and matches, carried round the streets in a chair for money ("Please to
// remember Guy!") and burned on the bonfire at nightfall. The caller is dated
// by the Commonplace Book's own entry (when: { calendar: 'guy_fawkes' }).
//
// Sources: the Act of 3 Jac. I c. 1 (1606), in a modern transcription
// (second-hand), and its repeal, 22 Vict. c. 2 (1859), on legislation.gov.uk;
// W. Hone, The Every-Day Book, vol. I (1826), 5 November, col. 1430; R.
// Chambers, The Book of Days (1864), 5 November; John Chamberlain's letter of
// 1605 and The Times of 1790, as D. Cressy and the OUP blog give them
// (second-hand); the Fireworks Regulations 2004, reg. 7, and gov.uk on the
// law; the London Fire Brigade and Merseyside Fire and Rescue on bonfires and
// fireworks; the British Hedgehog Preservation Society; the NHS on burns.
// Left out: "a penny for the Guy" as old (Cressy puts it in the nineteenth
// century), "in all Churches" (the Act says every cathedral and parish
// church), and Lewes, whose societies date only from 1853.
// ---------------------------------------------------------------------------
const FIFTH_RITES = {
  fifth_november: {
    key: 'fifth_november', name: 'Remember, Remember', icon: '🎆',
    how: 'Make a Guy of straw in old clothes, with a paper cap, a dark lantern in one hand and a bunch of matches in the other; carry him round the streets in a chair asking "Please to remember Guy!", and at nightfall burn him on the bonfire.',
    outcomes: [
      'The Guy is stuffed with straw and sat in a chair, paper cap on, lantern in hand. He looks very sorry for himself.',
      '"Please to remember Guy!" Hats out at every corner, and the coppers go in for the bonfire.',
      'At nightfall the Guy goes up on the pile, and the bonfire takes. Sparks go up over the roofs.',
    ],
    lore: 'The Act of 1606 bade the ministers "in every cathedral and parish church" "always upon the fifth day of November say morning prayer, and give unto Almighty God thanks for this most happy deliverance"; it was read in church every year until its repeal in 1859, and it said nothing of bonfires. Those were London\'s own, on the night itself in 1605, with "great ringing and as great store of bonfires as ever I thincke was seene" (Chamberlain). For a long while it was the Pope who was burned; by 1790 children were "begging for money for Guy Faux" (The Times). Hone (1826) tells how the Guy "is easily done with straw", and that he "neither was not, nor is, a Guy, without a dark lantern in one hand, and a spread bunch of matches in the other"; the boys ran "up to passengers hat in hand, with \'pray remember Guy! please to remember Guy.\'" Chambers (1864) heard "\'Please to remember Guy!\' or \'Please to remember the bonfire!\'", and gives "the time-honoured rhyme": "Remember, remember! / The fifth of November, / The Gunpowder treason and plot". "A penny for the Guy" came later still.',
    tier: 'record',
    source: '3 Jac. I c. 1 (1606) · W. Hone, The Every-Day Book, vol. I (1826), 5 November, col. 1430 · R. Chambers, The Book of Days (1864), 5 November · D. Cressy, "The Fifth of November Remembered", Journal of British Studies 29 (1990)',
  },
};

module.exports = { FIFTH_RITES };
