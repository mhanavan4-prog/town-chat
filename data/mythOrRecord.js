// ---------------------------------------------------------------------------
// "Myth or record?": ten things people say about witches, each answered from
// what the game already says and cites elsewhere (the memorial, the wards, the
// Real Shelf, the Charm Book). Five are myths and five are on the record. Ids
// are stable (best scores are on accounts).
// ---------------------------------------------------------------------------
const MYTH_QUIZ_INTRO = 'Things people say about witches, ten at a time. Is each a myth, or on the record? Every answer gives its source, and you can check most of them in the Charm Book.';

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
    source: 'H. Kramer, Malleus Maleficarum (1486–87), on the Real Shelf' },
  { id: 'good_friday_bun', claim: 'People kept a bun baked on Good Friday for a whole year, as a cure.', answer: 'record',
    verdict: 'Good Friday bread was kept "all through the ensuing year" and grated into water against illness. The Pitt Rivers Museum keeps one baked in 1976.',
    source: 'R. Chambers, The Book of Days (1864); Pitt Rivers Museum 1981.11.2' },
];

// Ten more: familiars, broomsticks, the foxglove, the mandrake, the marks,
// swimming, Salem, the 1940s and Joan of Arc. Checked for this game against
// the sources given; where a common telling is wrong in a detail (Josephus's
// dog pulled up a root called baaras, not a mandrake; the foxglove woman's
// name; what Joan was condemned for), the verdict says what the record says.
const MYTH_QUIZ_2 = [
  { id: 'familiars', claim: 'English witches were said to keep animal familiars, and it was recorded at their trials.', answer: 'record',
    verdict: 'At Chelmsford in 1566 Elizabeth Francis confessed that her grandmother gave her a cat "in the likeness of a white spotted Cat", to be called Satan and fed on bread and milk and her own blood. Familiars run all through the English trials.',
    source: 'The examination and confession of certaine Wytches at Chensforde (1566), ed. F. Luttmer' },
  { id: 'ancient_wicca', claim: 'Wicca is an ancient religion that survived in secret from pagan times.', answer: 'myth',
    verdict: 'Gerald Gardner made Wicca public in the 1950s, building on Margaret Murray\'s idea of a surviving witch-cult, which historians have since rejected.',
    source: 'Gerald Gardner, Witchcraft Today (1954); Margaret Murray, The Witch-Cult in Western Europe (1921); R. Hutton, The Triumph of the Moon (1999)' },
  { id: 'broomstick_1451', claim: 'The first known picture of witches riding broomsticks is from the 1400s.', answer: 'record',
    verdict: 'A copy of Martin Le Franc\'s poem Le Champion des Dames, made at Arras in 1451, shows two women labelled "Vaudoises" flying, one on a broom and one on a stick. It is the earliest that can be dated.',
    source: 'Bibliothèque nationale de France, MS fr. 12476, fol. 105v' },
  { id: 'mother_hutton', claim: 'The old woman who gave William Withering the foxglove cure was called Mother Hutton.', answer: 'myth',
    verdict: 'Withering (1785) says only that the receipt "had long been kept a secret by an old woman in Shropshire". "Mother Hutton" was made up for a drug company\'s advertisement around 1928. Foxglove is a deadly poison; its medicine is a doctor\'s to give.',
    source: 'W. Withering, An Account of the Foxglove (1785); D. M. Krikler, British Heart Journal 54 (1985)' },
  { id: 'mandrake_shriek', claim: 'People believed the mandrake root shrieked when it was pulled up.', answer: 'record',
    verdict: 'Juliet fears "shrieks like mandrakes torn out of the earth". Gerard (1597) gives the tale of the dog tied to the root and its "great shriek" at the digging, only to dismiss it as old wives\' stuff.',
    source: 'W. Shakespeare, Romeo and Juliet, 4.3; J. Gerard, The Herball (1597)' },
  { id: 'witch_marks', claim: 'The "witch marks" carved in old houses and churches were made by witches.', answer: 'myth',
    verdict: 'They were made against witches: marks cut by doors, windows and fireplaces "to protect inhabitants and visitors from witches and evil spirits", many probably by the masons and carpenters.',
    source: "Historic England, 'Discovering Witches' Marks'" },
  { id: 'swimming', claim: 'Suspected witches were thrown into water, and floating was taken as a sign of guilt.', answer: 'record',
    verdict: 'James VI wrote that the water would refuse to receive a witch, since she had shaken off the water of baptism. In 1612 Mary Sutton was "swum" and floated, and was later hanged.',
    source: 'James VI of Scotland, Daemonologie (1597); Witches apprehended, examined and executed (1613)' },
  { id: 'salem_burned', claim: 'The Salem witches were burned at the stake.', answer: 'myth',
    verdict: 'At Salem in 1692 nineteen people were hanged, Giles Corey was pressed to death under stones, and others died in jail. None was burned.',
    source: 'Library of Congress, In Custodia Legis (30 October 2020); Salem Witch Trials Documentary Archive' },
  { id: 'helen_duncan', claim: 'Britain\'s Witchcraft Act was used to jail someone as late as the 1940s.', answer: 'record',
    verdict: 'In 1944 the medium Helen Duncan was convicted of conspiring to break the Witchcraft Act of 1735 and jailed for nine months. The Act was repealed only in 1951.',
    source: 'R v Duncan [1944] KB 713; Fraudulent Mediums Act 1951' },
  { id: 'joan_witch', claim: 'Joan of Arc was burned as a witch.', answer: 'myth',
    verdict: 'She was burned in 1431 as a relapsed heretic. Divination and calling on spirits came up at her trial, but the twelve articles she was condemned on did not charge her with sorcery.',
    source: 'T. D. Murray (ed.), Jeanne d\'Arc (1902); Encyclopaedia Britannica, "Saint Joan of Arc"' },
];

// The quiz's sets of ten, each with its own best score on the account.
const MYTH_SETS = [
  { key: 'first', title: 'The first ten', items: MYTH_QUIZ },
  { key: 'second', title: 'Ten more', items: MYTH_QUIZ_2 },
];

module.exports = { MYTH_QUIZ, MYTH_QUIZ_2, MYTH_QUIZ_INTRO, MYTH_SETS };
