// ---------------------------------------------------------------------------
// Stir-up Sunday: the Sunday next before Advent, named by schoolboys from its
// collect, "Stir up, we beseech thee, O Lord, the wills of thy faithful
// people" (Book of Common Prayer, 1549; the Sarum collect "Excita, quaesumus,
// Domine"), and turned by them into a rhyme about the pudding in the pot.
// The caller is dated by the Commonplace Book's own entry (when: { calendar:
// 'stir_up_sunday' }).
//
// What is old and what is not, honestly: the collect is the 1549 Prayer
// Book's; the rhyme is in print by 1859 (Brand, as Dyer cites him) and in
// Dyer (1876), who says nothing of puddings being made that day; the
// Christmas plum-porridge is Pepys's, Christmas Day 1662. The rules told with
// the day now (thirteen ingredients for Christ and the apostles, stirring
// east to west for the Wise Men, a wish for everyone who stirs) have no
// source we could find before the twentieth century, and the game says so.
//
// Sources, read in full: The Book of Common Prayer (1549; 1662, as printed in
// Keeling, Liturgiae Britannicae, 1851); F. Procter, A History of the Book of
// Common Prayer (1855), p. 275; T. F. Thiselton Dyer, British Popular Customs
// (1876), p. 431; S. Pepys, Diary, 25 December 1662; C. Dickens, A Christmas
// Carol (1843), Stave Three.
// ---------------------------------------------------------------------------
const STIR_UP_RITES = {
  stir_up: {
    key: 'stir_up', name: 'Stir-up Sunday', icon: '🥄',
    how: 'Morning service, and the collect: "Stir up, we beseech thee, O Lord, the wills of thy faithful people". Then home, and the Christmas pudding made, while the children chant it back as the schoolboys did: "Stir up, we beseech thee, the pudding in the pot".',
    outcomes: [
      'The parson reads "Stir up, we beseech thee", and every child in the church looks at the next one and tries not to laugh.',
      'Suet, flour, fruit and spice, a long wooden spoon, and the bowl handed round the kitchen; it will hang in its cloth till Christmas.',
      '"And when we get home, we\'ll eat it all hot!" It won\'t be hot for five weeks yet, but nobody tells the children that.',
    ],
    lore: 'The Sunday next before Advent took its name from its collect: "Stir up, we beseech thee, O Lord, the wills of thy faithful people; that they plenteously bringing forth the fruit of good works, may of thee be plenteously rewarded" (Book of Common Prayer, 1549, from the Sarum "Excita, quaesumus, Domine"). Schoolboys made it a rhyme: "Stir up, we beseech thee, / The pudding in the pot, / And when we get home, / We\'ll eat it all hot" (Dyer, 1876, after Brand). Dyer says nothing of puddings being made that day; the Christmas plum-porridge itself is old (Pepys had "a mess of brave plum-porridge" on Christmas Day 1662), but the rules told with Stir-up Sunday now, thirteen ingredients for Christ and the apostles, stirring east to west for the Wise Men, a wish for everyone who stirs, have no source we could find before the twentieth century.',
    tier: 'folk',
    source: 'The Book of Common Prayer (1549), the twenty-fifth Sunday after Trinity, and (1662) "the Sunday next before Advent" · F. Procter, A History of the Book of Common Prayer (1855), p. 275 · T. F. Thiselton Dyer, British Popular Customs (1876), p. 431, citing Brand, Popular Antiquities (1859) · S. Pepys, Diary, 25 December 1662',
  },
};

module.exports = { STIR_UP_RITES };
