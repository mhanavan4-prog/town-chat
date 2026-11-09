// ---------------------------------------------------------------------------
// The Michaelmas goose, 29 September: the quarter day, when the rent was paid
// and the stubble goose, fattened on the harvest fields, went to the landlord
// or onto the table; eat goose that day and you'll want no money all year.
// The caller is dated by the Commonplace Book's own entry (when: { calendar:
// 'michaelmas_goose' }).
//
// Sources: G. Gascoigne, "Gascoignes gloze vppon this text, Dominus ijs opus
// habet", A Hundreth Sundrie Flowres (1573), p. 368, and The Posies (1575),
// read in the EEBO-TCP transcriptions; Encyclopaedia Britannica, 8th ed.
// (1860), "Michaelmas"; Poor Robin's Almanack (1695), as Wright, A Medley of
// Weather Lore (1913), gives it (second-hand); The Mirror of Literature, no.
// 568 (29 September 1832); Notes and Queries, no. 207 (15 October 1853), on
// the Armada tale; S. Lehane in the Irish Farmers Journal (2022) and
// Tipperary Studies on Ireland (second-hand); the Food Standards Agency and
// safefood on cooking and thawing a bird; NI Water on fat and drains; the
// NHS on burns. Left out: a British Apollo of 1709 for the money saying,
// which couldn't be read; Hone and Chambers, likewise; and the Goose Fair's
// charter dates, which come only through Wikipedia.
// ---------------------------------------------------------------------------
const GOOSE_RITES = {
  michaelmas_goose: {
    key: 'michaelmas_goose', name: 'The Michaelmas Goose', icon: '🪿',
    how: 'On Michaelmas Day take the quarter\'s rent to the landlord, and a stubble goose with it, fattened on the harvest fields; roast another for the house, and let everyone at the table eat of it, for whoever eats goose on Michaelmas Day will want no money all the year.',
    outcomes: [
      'The rent is counted onto the table and the goose laid beside it. The landlord says the lease will hold a year more.',
      'The goose comes out of the oven brown, and the fat is poured off by the jugful. Everyone at the table eats a piece.',
      'There is a goose over, and you take it down the lane to the cottage with five children and no goose this year.',
    ],
    lore: 'Gascoigne\'s "gloze" on Dominus iis opus habet (1573) has the tenants bring the landlord, with the quarter\'s rent, "some fowle at Midsommer, & a dish of Fish in Lent, / At Christmasse a capon, at Mighelmasse a goose". The geese were at their best then, for "stubble geese are in the highest perfection" at Michaelmas (Encyclopaedia Britannica, 1860). Poor Robin\'s almanac for 1695 had "Geese now in their prime season are, / Which, if well roasted, are good fare", and by 1832 the saying ran that "if you eat goose on Michaelmas Day, you will never want money all the year round" (The Mirror). The tale that Elizabeth I ordained it, being at goose when news of the Armada came, cannot be true: Gascoigne\'s goose is fifteen years older, and the victory was preached at Paul\'s Cross on 20 August 1588 (Stow, as Notes and Queries gave it in 1853, finding "no foundation for the tradition"). In Ireland, where Michaelmas was a gale day for the rents, it was Fomhar na nGéan, "The Harvest of the Geese", and some gave geese to the poorest families.',
    tier: 'record',
    source: 'G. Gascoigne, A Hundreth Sundrie Flowres (1573), p. 368 · Encyclopaedia Britannica, 8th ed. (1860), "Michaelmas" · The Mirror of Literature, no. 568 (29 September 1832) · Notes and Queries, no. 207 (15 October 1853) · S. Lehane, Irish Farmers Journal (21 September 2022)',
  },
};

module.exports = { GOOSE_RITES };
