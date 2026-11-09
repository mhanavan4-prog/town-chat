// ---------------------------------------------------------------------------
// Midsummer Men, Midsummer Eve (23 June): slips of orpine, the "live-long",
// stuck up in pairs, one for a maid and one for her sweetheart; if they lean
// together it is love, apart aversion. Later a single plant's leaves, bending
// right or left, told true or false. The caller is dated by the Commonplace
// Book's own entry (when: { calendar: 'midsummer_men' }).
//
// Sources: J. Aubrey, Remaines of Gentilisme and Judaisme (1686–87), as R.
// Vickery's Folk Flora (2019) gives it (second-hand); J. Gerard, The Herball
// (1597), II.138, "Of Orpyne", p. 415, read in transcription; W. Hone, The
// Every-Day Book, vol. I (1826), 24 June, cols. 849–52, for The Connoisseur
// and Hannah More's "Tawney Rachel"; E. C. Brewer, Dictionary of Phrase and
// Fable (1895), "Midsummer Men"; Brand, as quoted, on the Cawood ring
// (second-hand); the RHS on Hylotelephium telephium; the Wildlife and
// Countryside Act 1981, s. 13, and Plantlife on picking; Relate on talking to
// a partner; Women's Aid and the National Domestic Abuse Helpline on
// controlling behaviour. Left out: an Aubrey wording with clay and potsherds
// (not what he says), a Sawston ring and a Hampshire orpine verse (neither
// found), and Chambers (couldn't be read).
// ---------------------------------------------------------------------------
const MIDSUMMER_MEN_RITES = {
  midsummer_men: {
    key: 'midsummer_men', name: 'Midsummer Men', icon: '🌱',
    how: 'On Midsummer Eve take two slips of orpine, the live-long, one for yourself and one for your sweetheart, and stick them up side by side in a chink of the wall or a joist; in the morning, if they lean together it is love, and if they lean apart, aversion.',
    outcomes: [
      'Two slips of orpine go up in a crack of the beam, one for her and one for him, side by side.',
      'In the morning his has leaned over towards hers. She goes pink and says it\'s nothing, only a draught.',
      'The orpine is still green a week later, as Gerard said it would be. It lives long after it is cut.',
    ],
    lore: 'Aubrey, in the 1680s, saw the maids, "especially the Cooke mayds and Dayry-mayds", "stick-up in some chinkes and joists, etc., Midsommer-men, which are slips of Orpins. Thet placed them by Paires, sc: one for such a man, the other for such a mayd his sweet-heart, and according as the Orpin did incline to, or recline from ye other, that there would be love or aversion; if either did wither, death." Gerard\'s Herball (1597) shows why it would serve: "This plant is very full of life; the stalks set onely in claie continue greene a long time". In The Connoisseur a girl says "I likewise stuck up two Midsummer Men, one for myself and one for him… his blowed and turned to mine." By Hannah More\'s day one plant would do, "the bending of the leaves to the right, or the left" telling "whether her lover was true or false" (as Hone gives it, 1826), and Brewer (1895) set down the later form: "If the leaves bent to the right, it was a sign of fidelity". A fifteenth-century ring found near Cawood, in Yorkshire, shows "two Orpine plants joined by a true-love knot".',
    tier: 'record',
    source: 'J. Aubrey, Remaines of Gentilisme and Judaisme (1686–87), in R. Vickery, Folk Flora (2019) · J. Gerard, The Herball (1597), II.138, p. 415 · W. Hone, The Every-Day Book, vol. I (1826), 24 June, cols. 849–52 · E. C. Brewer, Dictionary of Phrase and Fable (1895), "Midsummer Men" · the Cawood ring, as J. Brand\'s Popular Antiquities quotes it',
  },
};

module.exports = { MIDSUMMER_MEN_RITES };
