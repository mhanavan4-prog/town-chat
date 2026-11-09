// ---------------------------------------------------------------------------
// St Thomas's Day, 21 December, the shortest day: going a-gooding. Women went
// round the better houses for money (and in Warwickshire the poor for corn),
// giving sprigs of green in return; the parson gave a shilling a head, and the
// St Thomas's Dole was given out in the vestry. Girls slept on a peeled St
// Thomas's onion to dream of their true love. The caller is dated by the
// Commonplace Book's own entry (when: { calendar: 'st_thomas' }).
//
// Sources: W. Hone, The Every-Day Book, vol. I (1826), 21 December, quoting
// the Gentleman's Magazine (April 1794), Ellis and Brand; R. Chambers, The
// Book of Days (1864), 21 December; P. H. Ditchfield, Old English Customs
// Extant at the Present Time (1896), pp. 25–26 (the Bilston rhyme, and
// "a-Thomasing" in Cheshire); J. O. Halliwell, Popular Rhymes and Nursery
// Tales (1849), p. 224. Left out: "Christmas is coming, the geese are getting
// fat", tied to St Thomas only in modern writing; and the red onion stuck
// with pins, which no old source gives.
// ---------------------------------------------------------------------------
const THOMAS_RITES = {
  gooding: {
    key: 'gooding', name: 'Going a-Gooding', icon: '🧺',
    how: 'Go round the better houses on St Thomas\'s Day with a bag, two of you together, asking for your gooding: a coin, or a measure of corn. At every door give a sprig of green in return.',
    outcomes: [
      'At the big house the cook gives a shilling and a measure of corn. She pins your sprig of green to her apron.',
      '"Well a day, well a day, St. Thomas goes too soon away." The farmer\'s wife laughs, and fills the bag with corn.',
      'The parson gives a shilling to each of you, as the parson always has, and says the Dole is in the vestry on Sunday.',
    ],
    lore: '"Going a gooding on St. Thomas\'s day formerly prevailed in England. Women begged money, and in return presented the donors with sprigs of palm and branches of primroses" (Hone, from the Gentleman\'s Magazine of 1794), and Ellis found it "still kept up in Kent, in the neighbourhood of Maidstone." In Warwickshire, Brand\'s servant told him, the poor would "go with a bag to beg corn of the farmers, which they call going a corning." Chambers (1864) gives the day\'s other names, "Doleing Day" and "Mumping [begging] Day"; in Staffordshire "The clergyman is expected to give a shilling to each person", and the better-off gave money that the parson and churchwardens gave out "in the vestry under the name of \'St. Thomas\'s Dole.\'" In Cheshire it was "going a-Thomasing" (Ditchfield, 1896), and at Bilston they sang "Well a day, well a day, / St. Thomas goes too soon away; / Then your gooding we do pray, / For the good time will not stay." It was the shortest day: "St Thomas gray, St. Thomas gray, / The longest night and the shortest day." Girls peeled "a \'St. Thomas\'s onion,\'" wrapped it in a clean handkerchief, put it under their heads and said "Good St. Thomas, do me right, / And let my true love come to-night", to dream of him (Halliwell, 1849).',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book, vol. I (1826), 21 December · R. Chambers, The Book of Days (1864), 21 December · P. H. Ditchfield, Old English Customs Extant at the Present Time (1896), pp. 25–26 · J. O. Halliwell, Popular Rhymes and Nursery Tales (1849), p. 224',
  },
};

module.exports = { THOMAS_RITES };
