// ---------------------------------------------------------------------------
// "Myth or record?": ten things people say about witches, each answered from
// what the game already says and cites elsewhere (the memorial, the wards, the
// Real Shelf, the Charm Book). Five are myths and five are on the record. Ids
// are stable (best scores are on accounts).
// ---------------------------------------------------------------------------
const MYTH_QUIZ_INTRO = 'Ten things people say about witches. Is each a myth, or on the record? Every answer comes from what this town already keeps: the memorial, the books on this shelf, the Charm Book.';

const MYTH_QUIZ = [
  { id: 'nine_million', claim: 'Nine million people were burned as witches in Europe.', answer: 'myth',
    verdict: 'Between about 1450 and 1750 some forty to sixty thousand people were put to death in Europe as witches. The "nine million" is a guess made in 1784 and repeated by later writers.',
    source: 'B. Levack, The Witch-Hunt in Early Modern Europe (2006); the memorial by the Town Hall' },
  { id: 'witch_bottles', claim: 'People buried bottles of pins and nails under the hearth to catch a witch.', answer: 'record',
    verdict: 'Nearly two hundred witch bottles are recorded in Britain, most from the 1500s to the 1700s. The Greenwich bottle, found in 2004, still held iron nails, brass pins and a leather heart.',
    source: 'Greenwich witch bottle (found 2004); Threshold & Hearth in the Charm Book' },
  { id: 'burned_in_england', claim: 'Witches in England were burned at the stake.', answer: 'myth',
    verdict: 'In England witches were hanged, about five hundred of them. In Scotland they were strangled at the stake and then burned.',
    source: 'J. Sharpe, Instruments of Darkness (1996); Survey of Scottish Witchcraft' },
  { id: 'dried_cats', claim: 'Dried cats have been found sealed inside the walls of old houses.', answer: 'record',
    verdict: 'Well over a hundred are on record. Sir John Soane kept two cats and a rat in a glass case; one cat came from a house at Lothbury pulled down in 1803. Why they were put there, nobody wrote down.',
    source: "Sir John Soane's Museum, BL1; B. Hoggard, Magical House Protection (2019)" },
  { id: 'midwives', claim: 'Most of the people accused of witchcraft were midwives and healers.', answer: 'myth',
    verdict: 'Most of the accused were neither healers nor midwives. The cunning folk who did heal for pay were, if anything, less often accused.',
    source: 'D. Harley, "The Myth of the Midwife-witch" (1990); O. Davies, Cunning-Folk (2003)' },
  { id: 'scotland_apology', claim: 'A government has formally apologised to people accused of witchcraft.', answer: 'record',
    verdict: 'On 8 March 2022 Scotland formally apologised to all those accused there. Over fifteen hundred people had been put to death.',
    source: 'Survey of Scottish Witchcraft; the memorial by the Town Hall' },
  { id: 'ancient_wheel', claim: 'The eight festivals of the Wheel of the Year are an ancient pagan calendar.', answer: 'myth',
    verdict: 'The eight-spoked Wheel is a 20th-century assembly: no one before the 1950s kept all eight as one wheel, and Ostara, Litha and Mabon were named in the 1970s. Five of its festivals are genuinely old.',
    source: 'R. Hutton, The Stations of the Sun (1996) and The Triumph of the Moon (1999)' },
  { id: 'islandmagee', claim: "Ireland's last witch trial was in the 1700s.", answer: 'record',
    verdict: 'At Carrickfergus on 31 March 1711 eight women of Islandmagee were convicted on the word of Mary Dunbar, though one of the two judges said the evidence was not enough.',
    source: 'A. Sneddon and V. Devlin (eds), The Islandmagee Witches documents (2022)' },
  { id: 'malleus_approved', claim: 'The Inquisition gave its official approval to the Malleus Maleficarum, the "Hammer of Witches".', answer: 'myth',
    verdict: 'The Inquisition gave it no authority. The theologians\' approval printed in some copies was denied by two of the men named, and many historians think its author forged it.',
    source: 'The Real Shelf: Malleus Maleficarum (1486–87)' },
  { id: 'good_friday_bun', claim: 'People kept a bun baked on Good Friday for a whole year, as a cure.', answer: 'record',
    verdict: 'Good Friday bread was kept "all through the ensuing year" and grated into water against illness. The Pitt Rivers Museum keeps one baked in 1976.',
    source: 'R. Chambers, The Book of Days (1864); Pitt Rivers Museum 1981.11.2' },
];

module.exports = { MYTH_QUIZ, MYTH_QUIZ_INTRO };
