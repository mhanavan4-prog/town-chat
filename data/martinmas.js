// ---------------------------------------------------------------------------
// Martinmas (11 November): not one of the eight festivals of the Wheel, but
// the great term day of the old farming year — the mart killed and salted for
// winter, the hiring fairs, and in Ireland St Martin's blood. A caller comes in
// Martinmas week only (MARTINMAS_WHEN, by calendar date).
//
// Sources: J. Mooney, "The Holiday Customs of Ireland", Proceedings of the
// American Philosophical Society 26 (1889), quoting Lady Wilde; M. McGarry,
// RTÉ Brainstorm (2019), on the Schools' Collection; Dictionary of the Scots
// Language, "mart"; W. Hone, The Every-Day Book, 11 November.
// ---------------------------------------------------------------------------
const MARTINMAS_WHEN = { month: 11, from: 9, to: 13, label: 'Martinmas week' }; // Martinmas Eve-week: the 9th to the 13th of November

const MARTINMAS_RITES = {
  martin_blood: {
    key: 'martin_blood', name: "St Martin's Blood", icon: '🐓',
    how: "On St Martin's Eve a cock or a goose is killed for the household's dinner, and its blood is sprinkled on the threshold and in the four corners of the kitchen. On the day itself nothing turns on a wheel: no spinning, no milling, no cart on the road.",
    outcomes: [
      'The cock is killed for the pot, and you mark the step and the four corners. The spinning wheel stands still all day.',
      'A drop on the threshold, one in each corner of the kitchen. No cart goes out, and the mill-wheel rests till morning.',
      'The blood is on the step before dark. Next day the wheel is put by against the wall, and the children are told why.',
    ],
    lore: 'At Martinmas in Ireland, Lady Wilde wrote, "a goose is killed, or a black cock, and the blood is sprinkled over the floor and on the threshold"; a collector of the 1930s says the four corners of the kitchen. And "no wheel should turn, or anything go round, on this day" (Mooney, 1889): no spinning, no milling, no cart on the road. It was the season of the mart, the beast killed and salted for winter, and in Scotland and the north of England of the term day and the hiring fairs.',
    tier: 'record',
    source: 'J. Mooney, "The Holiday Customs of Ireland", Proc. American Philosophical Society 26 (1889), quoting Lady Wilde · M. McGarry, RTÉ Brainstorm (2019)',
  },
};

module.exports = { MARTINMAS_RITES, MARTINMAS_WHEN };
