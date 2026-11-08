// ---------------------------------------------------------------------------
// Midsummer Day, 24 June: one of the four English quarter days, when the
// quarter's rent fell due. The caller is dated by the Commonplace Book's own
// entry (when: { calendar: 'midsummer_quarter' }), for the one day.
//
// Sources: W. Hone, The Every-Day Book (1825), 24 June, "Quarter-day",
// signed "Sigma", read first-hand in the Hone archive; R. Chambers, The Book
// of Days (1864), 29 September, for Gascoigne's verse (1575; second-hand);
// Encyclopaedia Britannica (1911), "Quarter"; J. Stow, A Survey of London
// (1603), on the Midsummer fires. For the practical half: Citizens Advice on
// rent arrears; Shelter on housing payments, eviction for arrears and its
// helpline; GOV.UK on the Renters' Rights Act 2025 and on illegal eviction;
// the Protection from Eviction Act 1977, s. 1.
//
// Put right: the old calendar entry had accounts "settled" on the day; the
// sources have rent due and houses entered or quitted. Left out: servants'
// wages at Midsummer (not found); the end of distress for rent on homes (not
// checked); the Midsummer quarter sessions (after 1830 only).
// ---------------------------------------------------------------------------
const QUARTER_RITES = {
  midsummer_quarter: {
    key: 'midsummer_quarter', name: 'Quarter Day', icon: '🗝️',
    how: 'On Midsummer quarter day pay the quarter\'s rent if you can; and if you can\'t, go to the landlord before he comes to you.',
    outcomes: [
      'The rent counted out on the table twice, and the second time it comes no nearer. All must pay, that can.',
      'Half the street is flitting by noon, beds and chairs on handcarts, as on every quarter day.',
      'The landlord takes part now and part at Michaelmas, written in his book, and the door stays yours.',
    ],
    lore: 'Midsummer Day was one of the four English quarter days, "the days on which it is usually contracted that rents should be paid, and houses or lands entered upon or quitted" (Britannica, 1911). Gascoigne\'s tenants, as Chambers gives him, "bring some fowl at Midsummer, a dish of fish in Lent, / At Christmas a capon, at Michaelmas a goose". A writer in Hone\'s Every-Day Book (1825) saw what the day meant in London: "This is quarter-day!—what a variety of thought and feeling it calls up in the minds of thousands in this great metropolis", for "some may quit, some may remain; all must pay—that can! Alas, that there should be some unable!" He begged: "Landlord! ponder o[n] these consequences ere you distrain for rent, and let your heart, rather than the law, be the guide of your conduct." The fires of St John\'s Eve had burned the night before, bonfires "aswell of good amitie amongest neighbours" as "to purge the infection of the ayre" (Stow, 1603).',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book (1825), 24 June, "Quarter-day" · R. Chambers, The Book of Days (1864), 29 September · Encyclopaedia Britannica (1911), "Quarter" · J. Stow, A Survey of London (1603)',
  },
};

module.exports = { QUARTER_RITES };
