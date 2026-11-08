// ---------------------------------------------------------------------------
// St Blaise's Day, 3 February: the saint of throats, after the boy he saved
// from a fishbone, and in England the woolcombers' patron; a charm for
// something stuck in the throat called on his name. The caller is dated by
// the Commonplace Book's own entry (when: { calendar: 'st_blaise' }).
//
// Sources: W. Hone, The Every-Day Book, vol. I (1826), 3 February, cols.
// 207–12, read in the Project Gutenberg text: Butler on the throats and the
// woolcombers, Ribadeneira on the fishbone and Aëtius's "Receipt", the note on
// Brand on the candles, the Golden Legend's widow and her candle, and the
// Leeds Mercury on the Bradford festival of 1825; the Catholic Encyclopedia
// (1907) and the Book of Blessings (1989) on the crossed candles; the NHS on
// sore throats; the North East Ambulance Service on choking. Left out: the
// charm as an English custom (it is a Greek physician's, by way of a Spanish
// Jesuit), Googe's verse as proof of the candle cures (it says nothing of
// them), "blaze" bonfires on his eve (unverified), and any advice on a stuck
// fishbone, for which no public NHS guidance was found.
// ---------------------------------------------------------------------------
const BLAISE_RITES = {
  st_blaise: {
    key: 'st_blaise', name: 'Bishop Blaise', icon: '🐑',
    how: 'On St Blaise\'s Day remember the bishop of throats and the woolcombers\' saint: light a candle in his name, as the widow in the legend was bidden to every year, and over a throat with something stuck in it say "Blase, the martyr and servant of Jesus Christ, commands thee to pass up or down!"',
    outcomes: [
      'One candle is lit for Bishop Blaise, as the widow in the legend was bidden every year. It burns steady.',
      'The old words are said over the sore throat, and the child giggles at being held so solemnly by the neck.',
      'Down the street come the woolcombers, hundreds of them, with a man dressed as Bishop Blaise riding at their head.',
    ],
    lore: 'Hone (1826) gives Blaise as "venerated for the cure of sore throats; principal patron of Ragusa, titular patron of the wool-combers", "tormented with iron combs, and martyred under Licinius, in 316", because he "cured a youth who had a fish-bone stuck in his throat by praying". In the Golden Legend, as Hone quotes it, he tells a widow that "every yere she sholde offre in his chirche a candell", and "It is observed in a note on Brand, that the candles offered to St. Blase were said to be good for the tooth-ache, and for diseased cattle." The charm is not English at all: the Jesuit Ribadeneira had it from the Greek physician Aëtius, a "Receipt for a stoppage in the throat": "Hold the diseased party by the throat, and pronounce these words:—BLASE, the martyr and servant of Jesus Christ, commands thee to pass up or down!" In England, Hone thought, "no other trade or persons" but the woolcombers had "any interest in remembering his existence", and at Bradford on 3 February 1825 "The septennial festival, held in honour of bishop Blase, and of the invention of wool-combing attributed to that personage" brought out 470 woolcombers. The blessing of throats with two candles held crossed is the Catholic Church\'s, and its English words are modern.',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book, vol. I (1826), 3 February, cols. 207–12 · The Catholic Encyclopedia (1907), "St. Blaise" · Book of Blessings (1989)',
  },
};

module.exports = { BLAISE_RITES };
