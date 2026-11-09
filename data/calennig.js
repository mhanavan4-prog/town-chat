// ---------------------------------------------------------------------------
// Calennig: New Year's Day in Wales. Children went from door to door early on
// New Year's morning until noon, carrying an apple on three short sticks,
// stuck with corn and topped with evergreen, and singing for calennig, a New
// Year gift of food or money. In the Gwaun Valley the New
// Year is still kept at Hen Galan, the old New Year, in mid-January. The
// caller comes on New Year's Day (CALENNIG_WHEN; the 2nd too, since the day
// turns at midnight UTC).
//
// Sources: Amgueddfa Cymru – Museum Wales: "New Year Traditions: Collecting
// Calennig" (2014); the "Calennig" blog (22 December 2009), quoting T. M. Owen, Welsh Folk Customs
// (1959), and an account of 1819; Visit Pembrokeshire on Hen Galan; the
// photograph F76.38.31 (Llangynwyd, c. 1904–14). Left out: the song
// "Deffrwch Benteulu" and the OED citation, neither found at their sources; "hot pennies" thrown from
// windows, found in no Welsh source, and the rhyme "Ac i bawb sydd yn y tŷ",
// found in no old one.
// ---------------------------------------------------------------------------
const CALENNIG_WHEN = { month: 1, from: 1, to: 2, label: "New Year's Day" };

const CALENNIG_RITES = {
  calennig: {
    key: 'calennig', name: 'Calennig', icon: '🍎',
    how: 'Make each child a calennig apple, standing on three short sticks, stuck with corn and with a sprig of evergreen on top, and go round the doors with them on New Year\'s morning, singing for calennig until noon.',
    outcomes: [
      '"Blwyddyn newydd dda!" At the farm the wife gives each of them bread and cheese, and a new penny to the smallest.',
      'The old minister comes to the door in his nightcap, hears them out, and gives a coin each, as he has for forty years.',
      'Noon strikes, and they stop at the next gate: calennig is a morning gift, and every child in the parish knows it.',
    ],
    lore: 'On New Year\'s Day in Wales children went from door to door for calennig, a New Year gift; "the collecting of calennig began early in the day and continued until noon" (T. M. Owen). They carried "an apple stuck full of corn, variously coloured and decorated with a sprig of some evergreen", with "three short skewers" to "serve as supports to the apple when not held in the hand" (an account of 1819). Museum Wales describes "a decorated apple, pierced with three sticks and adorned with a sprig of box and hazelnuts", and the children "received a gift or food or money for their troubles". In the Gwaun Valley in Pembrokeshire the New Year is still kept at Hen Galan, the old New Year of the old calendar, on 13 January. The word comes from calan, the first day of the month, from the Latin calendae.',
    tier: 'record',
    source: 'Amgueddfa Cymru – Museum Wales, "New Year Traditions: Collecting Calennig" (2014) · Amgueddfa Cymru – Museum Wales, "Calennig" (blog, 22 December 2009), quoting T. M. Owen, Welsh Folk Customs (1959) · Visit Pembrokeshire, "Celebrating Hen Galan"',
  },
};

module.exports = { CALENNIG_RITES, CALENNIG_WHEN };
