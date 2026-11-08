// ---------------------------------------------------------------------------
// The Ould Lammas Fair, Ballycastle, Co. Antrim: the last Tuesday in August
// (and the Monday before it, now): dulse and yellowman, and the horse trading
// on Fairhill Street. The caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'ould_lammas_fair' }).
//
// Sources: J. O'Laverty, An Historical Account of the Diocese of Down and
// Connor, vol. IV (1887), and H. A. Boyd in The Glynns 15 (1987), for the
// charter of 1606 (second-hand: neither saw its text); the Ordnance Survey
// Memoir for Ballycastle (1831), as transcribed (second-hand), and S. Lewis, A
// Topographical Dictionary of Ireland (1837), read first-hand, for the fair
// days and the trade; the Coleraine Chronicle (1862, 1928) as Boyd collects
// it; the Ulster-Scots Agency on yellowman; AlgaeBase on dulse; the
// Dictionary of Ulster Biography and the Coleraine Museum papers on John Henry
// MacAuley's song. For the practical half: DAERA on horse passports; the
// British Horse Society and World Horse Welfare on buying a horse.
//
// Put right: the old calendar entry called "the last Tuesday in August" the
// charter's words. The only account of the 1606 charter gives a Tuesday
// market; the fair's date is first found in 1831. "Nearly four hundred years"
// is over four hundred. Left out: who granted the charter (James I's patent is
// likely, not seen); any reason for the late-August date (no source); the
// song's words, and its exact year (by 1925; published 1934).
// ---------------------------------------------------------------------------
const LAMMAS_FAIR_RITES = {
  ould_lammas_fair: {
    key: 'ould_lammas_fair', name: 'The Ould Lammas Fair', icon: '🍬',
    how: 'At the Ould Lammas Fair buy dulse and yellowman for those at home, look over the ponies on Fairhill Street, and shake on nothing you haven\'t seen walked and handled.',
    outcomes: [
      'A twist of dulse, salt and leathery, and a slab of yellowman broken off with a hammer. Both last the road home.',
      'Rathlin ponies on Fairhill Street, and dealers slapping hands on bargains. You keep yours in your pocket.',
      'A fiddler at the Diamond plays the Lammas Fair song, and half the street sings it, the other half the dealers.',
    ],
    lore: 'In 1606 Sir Randal MacDonnell "obtained by charter the right of holding a Tuesday\'s market at \'Dunanynie\'", by Ballycastle (O\'Laverty, 1887); nobody has printed the charter itself. By 1831 there were "six annual fairs", among them the "last Tuesday in May, July, August, October and November" (Ordnance Survey Memoir), and Lewis listed what was sold at them: "Raghery ponies, horses, cattle, sheep, pigs, linen yarn, and pedlery" (1837). In 1862 the Coleraine Chronicle called it "This Donnybrook of the North", with "a large number of small \'shelties\', a vast number of sheep from Rathlin and a pretty good show of black cattle"; in 1928 "over five thousand sheep" were penned. The sweets are its own: dulse, the red seaweed "dried and eaten uncooked, by the maritime Irish and Scots", and yellowman, "a traditional Ulster honeycomb". John Henry MacAuley, who carved bog oak in Ballycastle, made the song of it, sung by 1925.',
    tier: 'record',
    source: 'J. O\'Laverty, An Historical Account of the Diocese of Down and Connor, vol. IV (1887) · Ordnance Survey Memoir, Ballycastle (1831) · S. Lewis, A Topographical Dictionary of Ireland (1837) · H. A. Boyd, The Glynns 15 (1987) · Ulster-Scots Agency, "Yellowman" · AlgaeBase, Palmaria palmata · Dictionary of Ulster Biography, "MacAuley, John Henry"',
  },
};

module.exports = { LAMMAS_FAIR_RITES };
