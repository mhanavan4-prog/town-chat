// ---------------------------------------------------------------------------
// Childermas, Holy Innocents' Day, 28 December: the unluckiest day of the
// year, when nothing that could wait was begun, and the day of the week it
// fell on was unlucky all the year after. The caller is dated by the
// Commonplace Book's own entry (when: { calendar: 'childermas' }).
//
// Sources: J. Melton, Astrologaster (1620), p. 46, and J. Gregory, Gregorii
// Posthuma (1649), p. 113, read in the EEBO-TCP transcriptions (long s
// modernised); J. Gairdner, ed., The Paston Letters (1904), vol. III, letter
// 460 (James Gresham to John Paston, 21 June 1461) and his note on it; J.
// Addison, The Spectator, no. 7 (8 March 1711); R. Chambers, The Book of Days
// (1864), 28 December; K. Danaher, The Year in Ireland (1972), p. 258, as
// quoted by Pilgrimage in Medieval Ireland (second-hand); the Highway Code,
// rules 228 and 230, and Transport Scotland on winter journeys. Left out: the
// story that Edward IV's coronation was put off for it, except as the rumour
// it was (he was crowned on the Sunday; only the pageants waited); children
// whipped "in bed", which Gregory doesn't say; and an Irish name for the day
// that couldn't be checked in Danaher.
// ---------------------------------------------------------------------------
const CHILDERMAS_RITES = {
  childermas: {
    key: 'childermas', name: 'Keeping Childermas', icon: '🗓️',
    how: 'Begin nothing on Childermas that can wait a day: put on no new clothes, pare no nails, start no journey and no work; and mark which day of the week it falls on, for that day is the unlucky one all the year to come.',
    outcomes: [
      'The new boots stay in their paper and the cart stays in the yard. Tomorrow will do, and tomorrow is soon enough.',
      'You count it out on the almanac and chalk the weekday by the door. That is the cross day, all the year to come.',
      'Nothing is begun, and nothing goes wrong. The nails stay unpared till morning, and the day goes by quiet.',
    ],
    lore: 'Melton\'s Astrologaster (1620) counts among the superstitions of the age "That it is not good to put on a new sute, pare ones nailes, or begin any thing on a Childermas day." Worse, the day of the week it fell on "used to be considered ominous or unlucky during the whole ensuing year" (Gairdner). So in June 1461 James Gresham wrote to John Paston that "for cause Childermesse day fal on the Sunday, the Coronacion shall on the Moneday": Edward IV\'s. It was only a rumour; Gairdner shows the king was crowned on the Sunday after all, and only the pageantry waited a day. In Addison\'s Spectator (1711) his friend\'s wife would not let a boy start his writing lessons on a Thursday: "you shall not begin upon Childermas-day". Gregory (1649) knew a custom "to whip up the children upon Innocent\'s daie morning, that the memorie of this Murther might stick the closer". Chambers called it "about the most unlucky through-out the year", and in Ireland, Danaher found, "if 28th of December fell upon Monday all Mondays were unlucky".',
    tier: 'record',
    source: 'J. Melton, Astrologaster (1620), p. 46 · J. Gairdner, ed., The Paston Letters (1904), vol. III, letter 460 · J. Addison, The Spectator, no. 7 (8 March 1711) · J. Gregory, Gregorii Posthuma (1649), p. 113 · R. Chambers, The Book of Days (1864), 28 December · K. Danaher, The Year in Ireland (1972), p. 258',
  },
};

module.exports = { CHILDERMAS_RITES };
