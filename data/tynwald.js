// ---------------------------------------------------------------------------
// Tynwald Day, Old Midsummer Day, 5 July (or the Monday after, if it falls at
// a weekend): the Manx parliament sits in the open air on Tynwald Hill at St
// John's. The caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'tynwald' }).
//
// Sources: the Act of Tynwald for the new calendar (1753), in Lex Scripta
// (1819), read first-hand in the Manx Notebook transcription; Tynwald's own
// pages, "Tynwald Day" and "1417: A Year of Records"; the Interpretation Act
// 2015, s. 47, for the weekend rule; the Standing Orders of Tynwald Court
// (2023), 2.1 and 6.5–6.12; A. W. Moore, The Folk-Lore of the Isle of Man
// (1891), ch. VI, and A Vocabulary of the Anglo-Manx Dialect (1924),
// "Bollan-bane", both read in the Manx Notebook transcriptions.
//
// Put right: the old calendar entry said Tynwald "once" met on Midsummer Day;
// the 1753 Act kept it on the same natural day, and it still sits "on old
// midsummer's day". It said the laws are "proclaimed"; Acts are promulgated,
// and lapse if not promulgated within eighteen months. The date now follows
// the weekend rule. Left out: a revival of the mugwort in 1924 (not found);
// 979 as a founding date (a tradition, not a record); which Deemster reads the
// Manx today (only on Wikipedia).
// ---------------------------------------------------------------------------
const TYNWALD_RITES = {
  tynwald: {
    key: 'tynwald', name: 'Tynwald Day', icon: '🌿',
    how: 'On Tynwald Day pin bollan bane to your coat, go to St John\'s, hear the new Acts promulgated from the Hill in English and Manx, and bring a grievance to its foot if you have one.',
    outcomes: [
      'Bollan bane on every coat in St John\'s, from the Lieutenant Governor to the lad selling ices.',
      'The new Acts are read from the Hill, in English and then in Manx, and the wind takes half of it.',
      'A petition goes up the processional path to the foot of the Hill, three people at most, and the Clerk takes it.',
    ],
    lore: 'In 1753 Tynwald\'s Act for the new calendar kept "the Midsummer Tynwald Court usually holden or kept with the Fair or Mart on the Feast Day of Saint John Baptist" on its old natural day, "eleven Days later", and so it still sits "in the open air once a year, on old midsummer\'s day, at Tynwald Hill in St John\'s". "First among the customary laws that were written down in 1417 was the procedure for Tynwald Day", and the chronicle of the kings of Man records "a convention of all the Manx people" at Tynwald in 1237; the millennium kept in 1979 counts from a traditional date. On the Hill new Acts are promulgated, a memorandum of each read "in Manx and English", and one not promulgated within eighteen months "ceases to have effect". "Any person may approach Tynwald Hill on Tynwald Day and present a Petition for Redress." The plant on every coat is bollan bane, mugwort: on Midsummer Eve, Moore wrote in 1891, it "was made into wreaths to be worn on the heads of man and beast to protect them from witchcraft", and the Manx Fencibles "used to wear it in their caps on oul\' Tynwald Day".',
    tier: 'record',
    source: 'Act of Tynwald for the new Calendar (1753), in Lex Scripta (1819) · Tynwald, "Tynwald Day" and "1417: A Year of Records" · Standing Orders of Tynwald Court (2023), 2.1, 6.5–6.12 · A. W. Moore, The Folk-Lore of the Isle of Man (1891), ch. VI · A. W. Moore, S. Morrison & E. Goodwin, A Vocabulary of the Anglo-Manx Dialect (1924), "Bollan-bane"',
  },
};

module.exports = { TYNWALD_RITES };
