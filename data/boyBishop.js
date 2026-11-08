// ---------------------------------------------------------------------------
// The Boy Bishop, chosen by the choristers on St Nicholas' Day, 6 December,
// who bore the name and kept the state of a bishop until Childermas, 28
// December. Henry VIII suppressed it in 1541, Mary brought it back in 1554,
// and under Elizabeth it fell out of use. The caller is dated by the
// Commonplace Book's own entry (when: { calendar: 'boy_bishop' }).
//
// Sources: J. Gregory, Gregorii Posthuma (1649), pp. 95, 113–17, read in the
// EEBO-TCP transcription (long s modernised); W. Hone, The Every-Day Book,
// vol. I (1826), 6 December; E. K. Chambers, The Mediaeval Stage (1903), vol.
// I, for Henry VIII's proclamation of 22 July 1541 (from Wilkins's Concilia)
// and the end under Elizabeth; The Diary of Henry Machyn, ed. J. G. Nichols
// (1848), for 1554 and 1556; R. Chambers, The Book of Days (1864), 6
// December; Salisbury Cathedral and the St Nicholas Center on the revivals;
// the NSPCC on adult-to-child ratios and consent; the NSPCC Helpline and
// Childline. Left out: 1542 for the suppression (it was 1541), "the child
// bishop of Paul's" as Machyn's words (they are a lost poem's title), the
// Salisbury effigy as a boy bishop (modern scholars reject it), Hereford
// "since 1973" (it was 1982), and York electing on Innocents' Day.
// ---------------------------------------------------------------------------
const BISHOP_RITES = {
  boy_bishop: {
    key: 'boy_bishop', name: 'The Boy Bishop', icon: '🧒',
    how: 'On St Nicholas\' Day let the choristers choose one of their own for bishop; dress him in a little mitre and cope, with a crozier, and from then till Childermas let him bear the name and keep the state of a bishop, leading the procession, preaching his sermon, and going round the houses with his company.',
    outcomes: [
      'The choristers vote, and the smallest of them is made bishop. The mitre comes down over his ears.',
      'The boy bishop goes up into the pulpit and preaches his sermon, and nobody laughs. Nearly nobody.',
      'His company goes round the houses singing and comes home with coins and cakes. At Childermas he is a boy again.',
    ],
    lore: 'Gregory (1649) explains it: "The Episcopus Choristarum was a Chorister Bishop chosen by his fellow Children upon S. Nicholas daie", and "From this daie till Innocents daie at night… The Episcopus Puerorum was to bear the name, and hold up the State of a Bishop." Hone agreed: "Though the boy bishop\'s election was on the 6th of December, yet his office and authority lasted till the 28th, being Innocents\' day." It was not the same everywhere: at Eton and King\'s the boy served on St Nicholas\' Day itself, and the Sarum procession fell on Innocents\' eve. Henry VIII\'s proclamation of 22 July 1541 put a stop to it, since "children be strangelye decked and apparelid to counterfaite priestes, bysshopps, and women; and so ledde with songes and daunces from house to house, bleasing the people, and gatherynge of monye". Under Mary it came back: on St Nicholas\' eve 1556, Machyn wrote, "Sant Necolas whentt a-brod in most partt in London syngyng after the old fassyon, and was reseyvyd with mony good pepulle in-to ther howses". Under Elizabeth, E. K. Chambers says, it "naturally fell again into disuse". Gregory thought a little bishop\'s effigy at Salisbury was a boy bishop\'s tomb; scholars now doubt it. Salisbury revived the custom in the 1980s, and Hereford in 1982.',
    tier: 'record',
    source: 'J. Gregory, Gregorii Posthuma (1649), pp. 95, 113–17 · W. Hone, The Every-Day Book, vol. I (1826), 6 December · E. K. Chambers, The Mediaeval Stage (1903), vol. I · The Diary of Henry Machyn, ed. J. G. Nichols (1848)',
  },
};

module.exports = { BISHOP_RITES };
