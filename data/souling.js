// ---------------------------------------------------------------------------
// Souling: on All Souls' Day, 2 November, children and the poor went from
// door to door for soul cakes, praying for the household's dead in return.
// The caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'souling' }).
//
// Sources: J. Aubrey, Remaines of Gentilisme and Judaisme (1686–87), ed. J.
// Britten (1881); Notes and Queries (15 November 1851); C. S. Burne,
// Shropshire Folk-Lore (1883), the song as M. E. Bell quotes it; Shakespeare,
// The Two Gentlemen of Verona, 2.1; the Antrobus soul-cakers (Cheshire). An
// often-repeated "earliest record of 1511" could not be checked, so it isn't
// given.
// ---------------------------------------------------------------------------
const SOUL_RITES = {
  soul_cakes: {
    key: 'soul_cakes', name: 'Souling', icon: '🍪',
    how: 'Bake a heap of spiced soul cakes and set them on the board, and give one to every child who comes to the door singing for a soul-cake, for a prayer for the household\'s dead.',
    outcomes: [
      'Three children at the door, singing for a soul-cake. Each goes off with a cake and a prayer for your dead.',
      'The heap on the board goes down cake by cake. By dark there is one left, and you eat it yourself.',
      'An old man comes souling with the children. You give him two cakes and a penny, and he names your dead.',
    ],
    lore: 'On All Souls\' Day, 2 November, children and the poor went "souling" from house to house for soul cakes, praying for the household\'s dead in return. Aubrey recorded it in Shropshire in the 1680s: "There is sett on the Board a high heap of Soule-cakes", and "n\'ly all the visitants that day take one." In 1851 it was still "the custom for the village children to go round to all their neighbours souling" there. Their song, as Charlotte Burne printed it in Shropshire Folk-Lore (1883–86), began "Soul! Soul! For a soul-cake! / I pray, good missis, a soul-cake!" Shakespeare knew the whine of it: "to speak puling, like a beggar at Hallowmas". At Antrobus in Cheshire the soul-cakers still play each November.',
    tier: 'record',
    source: 'J. Aubrey, Remaines of Gentilisme and Judaisme (1686–87), ed. J. Britten (1881) · Notes and Queries (15 November 1851) · C. S. Burne, Shropshire Folk-Lore (1883–86) · W. Shakespeare, The Two Gentlemen of Verona, 2.1',
  },
};

module.exports = { SOUL_RITES };
