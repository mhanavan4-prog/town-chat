// ---------------------------------------------------------------------------
// "Myth or record?": ten things people say about witches, each answered from
// what the game already says and cites elsewhere (the memorial, the wards, the
// Real Shelf, the Charm Book). Five are myths and five are on the record. Ids
// are stable (best scores are on accounts).
// ---------------------------------------------------------------------------
const MYTH_QUIZ_INTRO = 'Things people say about witches and the old remedies, ten at a time. Is each a myth, or on the record? Every answer gives its source, and you can check most of them in the Charm Book.';

const MYTH_QUIZ = [
  { id: 'nine_million', claim: 'Nine million people were burned as witches in Europe.', answer: 'myth',
    verdict: 'Between about 1450 and 1750 some forty to sixty thousand people were put to death in Europe as witches. The "nine million" is a guess made in 1784 and repeated by later writers.',
    source: 'B. Levack, The Witch-Hunt in Early Modern Europe (2006); the memorial by the Town Hall' },
  { id: 'witch_bottles', claim: 'People buried bottles of pins and nails under the hearth to catch a witch.', answer: 'record',
    verdict: 'Some two to two and a half hundred witch bottles are recorded, mostly in England and mostly from after 1660. The Greenwich bottle, from the late 1600s, still held urine, iron nails, brass pins and a nail through a leather heart.',
    source: 'MOLA, "Bottles Concealed and Revealed", British Archaeology (September 2019); Threshold & Hearth in the Charm Book' },
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
    source: 'A. Sneddon and S. Devlin (eds), The Islandmagee Witches documents (2022)' },
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

// Herbs and healing: the King's Evil, "eye of newt", the toadstone, the
// doctrine of signatures, willow bark, the plague doctor, vervain,
// bloodletting, rosemary and the apple a day. Checked for this game; where a
// common telling claims more than the record holds (Culpeper "tried" for
// witchcraft, beaked doctors "common" in London in 1665), it is left out or
// the verdict says only what the record shows.
const MYTH_QUIZ_3 = [
  { id: 'kings_evil', claim: 'English kings and queens touched the sick to cure scrofula, the "King\'s Evil".', answer: 'record',
    verdict: 'Charles II touched tens of thousands, perhaps more than ninety thousand, each given a gold touch-piece. Queen Anne touched the infant Samuel Johnson in 1712; he remembered "a lady in diamonds, and a long black hood."',
    source: 'Royal Collection Trust, RCIN 443149; J. Boswell, Life of Johnson (1791)' },
  { id: 'eye_of_newt', claim: '"Eye of newt" in Macbeth was an old herbalists\' name for mustard seed.', answer: 'myth',
    verdict: 'No herbal or dictionary before 1900 has been found that says so; the idea is modern. Some of the witches\' ingredients are plants ("Root of Hemlocke"), but nothing early makes the newt\'s eye one.',
    source: 'W. Shakespeare, Macbeth (First Folio, 1623), 4.1' },
  { id: 'toadstone', claim: 'People wore "toadstones", believed to come from a toad\'s head, against poison.', answer: 'record',
    verdict: 'Toadstones were set in rings and amulets to draw out poison. They are really the fossil teeth of an extinct fish. Shakespeare\'s toad "Wears yet a precious jewel in his head".',
    source: 'National Museums Scotland, "Toadstones"; W. Shakespeare, As You Like It, 2.1' },
  { id: 'signatures_peasant', claim: 'The doctrine of signatures, that a plant shaped like an organ treats that organ, was a peasant belief.', answer: 'myth',
    verdict: 'Not a peasant invention: learned writers gave it its name and theory, Paracelsus, della Porta (1588) and William Coles, whose Adam in Eden (1657) sets out plants\' "Signatures".',
    source: 'W. Coles, Adam in Eden (1657); G. della Porta, Phytognomonica (1588)' },
  { id: 'willow_bark', claim: 'Willow bark was used against fevers long before aspirin.', answer: 'record',
    verdict: 'In 1763 the Rev. Edward Stone told the Royal Society of his success with dried willow bark against agues, reasoning that "remedies lie not far from their causes". Aspirin came from the same family of compounds in 1899.',
    source: 'E. Stone, Philosophical Transactions 53 (1763), 195–200' },
  { id: 'plague_doctor', claim: 'Plague doctors in beaked masks were a common sight in London\'s Great Plague of 1665.', answer: 'myth',
    verdict: 'The beaked costume is recorded in France and Italy; the famous print of "Doctor Schnabel" is from Rome in 1656. No London source of 1665 is known to show it.',
    source: 'British Museum, "Doctor Schnabel von Rom" (1656), P_1876-0510-512' },
  { id: 'vervain_charm', claim: 'Vervain was picked with a spoken charm, as a holy herb against harm.', answer: 'record',
    verdict: 'The charm was "Hallowed be thou, Vervein, / As thou growest on the ground, / For in the Mount of Calvary, / There thou wast first found." A Protestant writer mocked it in 1624, so it was older.',
    source: 'J. White, The Way to the True Church (1624), in Notes and Queries (24 December 1853)' },
  { id: 'bloodletting', claim: 'Bloodletting was given up after the Middle Ages.', answer: 'myth',
    verdict: 'It went on for centuries. George Washington was bled four times as he lay dying in 1799, and in 1833 France alone imported some forty-two million leeches.',
    source: 'Mount Vernon, "The Death of George Washington"; James Lind Library' },
  { id: 'rosemary_memory', claim: 'Rosemary was believed to strengthen the memory.', answer: 'record',
    verdict: 'Ophelia: "There\'s rosemary, that\'s for remembrance." Gerard\'s Herball (1597) says rosemary "comforteth the brain, the memory, the inward senses".',
    source: 'W. Shakespeare, Hamlet, 4.5; J. Gerard, The Herball (1597)' },
  { id: 'apple_a_day', claim: '"An apple a day keeps the doctor away" is an old medieval saying.', answer: 'myth',
    verdict: 'The earliest known form is a Pembrokeshire proverb printed in 1866, "Eat an apple on going to bed, / And you\'ll keep the doctor from earning his bread." The modern wording turns up by the late 1880s.',
    source: 'Notes and Queries, 3rd ser., vol. 9 (1866), p. 153' },
];

// Feasts and festivals: lanterns, the Windsor tree, mistletoe, Eostre, hot
// cross buns, the 1647 ban, Santa's red, a Valentine of 1477, the bonfires
// and the plum pudding. Checked for this game; where a common telling is
// wrong in a detail (Bede names the month, not the feast; the street cry for
// hot cross buns can't be checked in its first printing), the verdict says
// only what the record holds.
const MYTH_QUIZ_4 = [
  { id: 'pumpkin_lanterns', claim: 'Jack-o\'-lanterns were first carved from pumpkins.', answer: 'myth',
    verdict: 'In Ireland and the Isle of Man they were turnips, and sometimes potatoes; the National Museum of Ireland keeps a "ghost turnip" from Donegal. "Jack-o\'-lantern" first meant a will-o\'-the-wisp, and the carved pumpkin is American.',
    source: 'C. Doyle, National Museum of Ireland, "The Ghost Turnip"; Culture Vannin, "Hop tu Naa"' },
  { id: 'windsor_tree', claim: 'A Christmas tree was lit at Windsor decades before Prince Albert came.', answer: 'record',
    verdict: '"It was in fact Queen Charlotte who introduced Christmas trees to Britain", with candles and sweetmeats at Windsor by 1800. The Illustrated London News picture of Victoria and Albert\'s tree in 1848 made it everyone\'s.',
    source: 'Royal Collection Trust, "Christmas at Windsor Castle"; J. Watkins, Memoirs of Queen Charlotte (1819)' },
  { id: 'mistletoe_druids', claim: 'Kissing under the mistletoe is an ancient Druid custom.', answer: 'myth',
    verdict: 'Pliny has the Druids cut mistletoe "with a golden sickle", but no kissing. The kiss first turns up in the 18th century, in a comedy of 1784; Irving wrote it up in 1820.',
    source: 'Pliny, Natural History 16.95; W. Irving, The Sketch Book (1820)' },
  { id: 'eostre_bede', claim: 'The Venerable Bede wrote that Easter took its name from a goddess, Eostre.', answer: 'record',
    verdict: 'In 725 Bede wrote that Eosturmonath, the Easter month, was "once called after a goddess of theirs named Eostre". Whether she was ever worshipped is argued; Hutton thinks the name may just mean "the month of opening".',
    source: 'Bede, The Reckoning of Time (725), ch. 15, tr. F. Wallis (1999); R. Hutton, The Stations of the Sun (1996)' },
  { id: 'buns_eostre', claim: 'Hot cross buns began as a pagan offering to Eostre.', answer: 'myth',
    verdict: 'No evidence at all: the name "hot cross buns" is first recorded in 1733. The pagan story was told by Victorian writers, who called the buns a relic of cakes eaten for the spring goddess.',
    source: 'Oxford English Dictionary; Foods of England, "Hot Cross Buns"' },
  { id: 'christmas_banned', claim: 'Parliament abolished Christmas in 1647.', answer: 'record',
    verdict: 'An ordinance of 8 June 1647 ruled that Christmas, Easter and Whitsun "be no longer observed as Festivals or Holy-dayes". There were riots at Canterbury that Christmas, and the feast came back with the King in 1660.',
    source: 'C. H. Firth & R. S. Rait (eds), Acts and Ordinances of the Interregnum (1911)' },
  { id: 'santa_red', claim: 'Santa wears red because of Coca-Cola\'s adverts.', answer: 'myth',
    verdict: 'Haddon Sundblom\'s Coca-Cola Santa began in 1931, but a red-coated Santa is in a sweets advert of 1868. Coca-Cola itself says "Santa appeared in a red coat before Sundblom painted him".',
    source: 'The Coca-Cola Company, "Haddon Sundblom and the Coca-Cola Santas"' },
  { id: 'valentine_1477', claim: 'A woman called her husband-to-be her "Valentine" in a letter of 1477.', answer: 'record',
    verdict: 'In February 1477 Margery Brews wrote to John Paston, "my ryght wele-beloved Voluntyne", among the Paston letters now in the British Library.',
    source: 'J. Gairdner (ed.), The Paston Letters, vol. V (1904), no. 897; British Library, Add MS 43490' },
  { id: 'bonfires_law', claim: 'Bonfires on the Fifth of November were required by law.', answer: 'myth',
    verdict: 'The Act of 1605 ordered churches to "say Morning Prayer, and give unto Almighty God Thanks" every 5 November; it said nothing of bonfires, which people lit of their own accord. It was repealed in 1859.',
    source: 'Observance of 5th November Act 1605 (3 Jac. I c. 1)' },
  { id: 'plum_porridge', claim: 'The Christmas pudding began as a porridge.', answer: 'record',
    verdict: 'Plum pottage, beef or mutton stewed with dried fruit and spices, was the Christmas dish; Hannah Glasse\'s "Plum-Porridge for Christmas" (1747) still begins "Take a Leg and Shin of Beef". The boiled pudding grew from it.',
    source: 'H. Glasse, The Art of Cookery (1747); A. Jotischky, Lancaster University' },
];

// The quiz's sets of ten, each with its own best score on the account.
const MYTH_SETS = [
  { key: 'first', title: 'The first ten', items: MYTH_QUIZ },
  { key: 'second', title: 'Ten more', items: MYTH_QUIZ_2 },
  { key: 'third', title: 'Herbs and healing', items: MYTH_QUIZ_3 },
  { key: 'fourth', title: 'Feasts and festivals', items: MYTH_QUIZ_4 },
];

module.exports = { MYTH_QUIZ, MYTH_QUIZ_2, MYTH_QUIZ_3, MYTH_QUIZ_4, MYTH_QUIZ_INTRO, MYTH_SETS };
