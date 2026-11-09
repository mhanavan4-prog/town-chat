// ---------------------------------------------------------------------------
// Lady Day, 25 March: the first quarter day, when rent fell due and terms
// began and ended, and the first day of England's legal year from the twelfth
// century until 1752; Old Lady Day, after the calendar change, was the farm
// workers' moving day, and the Exchequer's year still runs from 6 April. The
// caller is dated by the Commonplace Book's own entry (when: { calendar:
// 'lady_day' }).
//
// Sources: the Calendar (New Style) Act 1750, 24 Geo. II c. 23, on
// legislation.gov.uk; A. F. Pollard, "New Year's Day and Leap Year in English
// History", English Historical Review 55 (1940); Encyclopaedia Britannica
// (1911), "Calendar"; W. Hone, The Every-Day Book, vol. I (1826), 25 March;
// T. Hardy, Tess of the d'Urbervilles (1891), chs. XLVI, L–LII; the Chartered
// Institute of Taxation (2021) on the shift to 6 April in 1800 (second-hand);
// gov.uk on deposit protection and the Renters' Rights Act; Shelter on
// inventories. Left out: "1155" as the year it began (no scholarly source),
// "New Year's Day" as what people called it (Pollard found none), farm
// tenancies running from Lady Day (no source found), and Chambers, which
// couldn't be read.
// ---------------------------------------------------------------------------
const LADY_RITES = {
  lady_day: {
    key: 'lady_day', name: 'Lady Day Flitting', icon: '🧳',
    how: 'On Lady Day, the first quarter day, pay the quarter\'s rent and take a receipt for it; if your term is up, load the waggon and flit to the new place, with sacking over the furniture against the rain, and be in by dark.',
    outcomes: [
      'The quarter\'s rent is counted out on the table, and the landlord writes his receipt: paid to Lady Day.',
      'The waggon is loaded, the clock and the bedstead lashed on top, and the sacking over all against the rain.',
      'By dark the new door is shut behind you, the fire lit, and the damp bedding hung to air before it.',
    ],
    lore: 'Lady Day, the Annunciation, was the first of the four quarter days, and by Hone\'s time it "is only remembered as the first quarter-day in the year, and is therefore only kept by tenants who truly pay rent to their landlords." From the twelfth century it began England\'s legal year, "the legal supputation of the year of our Lord in England, according to which the year beginneth on the twenty-fifth day of March", until the Act of 1750 made each new year "begin to be reckoned from the first day of every such month of January" from 1752. Few ever called it New Year\'s Day; Pollard "failed to find a single instance of that day being actually described as New Year\'s day." When eleven days were dropped in 1752, "the exchequer was firm in its resistance to the loss of eleven days\' revenue; its financial year was prolonged to 5 April, and we still pay income tax on a year which runs from 6 April." Old Lady Day, as the old date fell after 1800 on the sixth of April, was the farm workers\' moving day: in Hardy\'s Wessex "the agricultural world was in a fever of mobility such as only occurs at that particular date of the year", and "A wet Lady-Day was a spectre which removing families never forgot; damp furniture, damp bedding, damp clothing".',
    tier: 'record',
    source: 'Calendar (New Style) Act 1750, 24 Geo. II c. 23 · A. F. Pollard, English Historical Review 55 (1940) · W. Hone, The Every-Day Book, vol. I (1826), 25 March · T. Hardy, Tess of the d\'Urbervilles (1891), chs. L–LII',
  },
};

module.exports = { LADY_RITES };
