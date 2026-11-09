// ---------------------------------------------------------------------------
// The cunning folk of the record: real, long-dead charmers and wise folk, on
// the Real Shelf beside the books. Each entry says what people paid them for,
// what the record shows, and (in `legend`) what is only story. Where the
// record is thin or disagrees, the entry says so. Ids are stable (accounts).
//
// Sources checked: Hadleigh & Thundersley Community Archive; J. Rainsford,
// History Ireland; Lady Gregory, Visions and Beliefs in the West of Ireland
// (1920); J. C. Atkinson, Forty Years in a Moorland Parish (1891); the Survey
// of Scottish Witchcraft; L. Henderson (2009) and R. Pitcairn, Ancient
// Criminal Trials in Scotland (1833); the Dictionary of Welsh Biography and
// the National Library of Wales; Art UK and J. Semmens, The Witch of the West
// (2004); The Examination of John Walsh (1566), as printed by M. Murray
// (1921); the two pamphlets on Joan Peterson (1652) and the Folger Library on
// the prosecution's accounts; E. Bower, Doctor Lamb Revived (1653), and M.
// Gaskill (2007) on Anne Bodenham; the Prophesie of Mother Shipton (1641), the
// DNB, and Notes and Queries (1873) on Hindley's forgeries. General: O.
// Davies, Cunning-Folk: Popular Magic in English History (2003).
// ---------------------------------------------------------------------------
const CUNNING_FOLK_INTRO = 'The cunning folk themselves: paid charmers, healers and finders of stolen goods whose names are on the record, with what is only legend marked as such. Tap a name to read it.';

const CUNNING_FOLK = [
  { id: 'murrell', name: 'James "Cunning" Murrell', place: 'Hadleigh, Essex', dates: '1785–1860', tier: 'record',
    summary: 'A shoemaker by trade, born about 1781 and baptised at Hawkwell in 1785, who became the best-known cunning man in Essex. People came to him for cures, for stolen goods, for horoscopes, and to have a witch\'s spell broken; he doctored animals too.',
    fact: 'He died on 16 December 1860, and his chest held his clients\' letters, his notes and his books of astrology and medicine; it was buried, and later dug up again. The Hadleigh blacksmith, Stephen Choppen, was remembered as the man who forged his iron witch bottles.',
    legend: 'Legend: that he flew on a broomstick, foretold his own death "to the very minute", or was killed by a witch bottle. Much of his fame comes from Arthur Morrison\'s novel Cunning Murrell (1900), which is fiction.',
    quote: null,
    source: 'Hadleigh & Thundersley Community Archive · Hadleigh census, 1841 and 1851 · O. Davies, Cunning-Folk (2003) · A. Morrison, Cunning Murrell (1900, a novel)' },
  { id: 'biddy_early', name: 'Biddy Early', place: 'Feakle, Co. Clare', dates: 'c. 1798–1874', tier: 'record',
    summary: 'A wise woman of County Clare who cured people and animals with herbs, and saw what ailed them, or who had done harm, by looking into a bottle that most said had come from the fairies (one of Lady Gregory\'s tellers said her power came "from her brother").',
    fact: 'The priests were against her, Lady Gregory\'s informants said, and the Limerick Chronicle of 29 July 1869 called her a "witch or sorceress" living near Tulla. A witchcraft trial in 1865 is often told but has never been proved, and she was certainly not convicted.',
    legend: 'Legend: that her bottle was thrown into the lake when she died, that 27 priests attended her funeral, and that a curate who crossed her was frozen in his saddle.',
    quote: 'It was by the bottle she did all, to shake it, and she\'d see everything when she looked in it.',
    source: 'Lady Gregory, Visions and Beliefs in the West of Ireland (1920) · J. Rainsford, History Ireland · N. Maxwell, "A life of hardship", History Ireland 20.1 (2012)' },
  { id: 'wrightson', name: 'John Wrightson, the Wise Man of Stokesley', place: 'Stokesley, North Yorkshire', dates: 'fl. c. 1800–1818', tier: 'record',
    summary: 'A cow-doctor and "wise man" of the North Riding, consulted about sick beasts, lost goods and deaths that seemed unnatural. A newspaper of 1800 tells of a thief at Burneston who "had been to the Wise Man" for pills, which a man took and died; that Wise Man was probably Wrightson, though the paper does not name him.',
    fact: 'The vicar J. C. Atkinson, who heard of him from old parishioners, thought him partly a charlatan, getting his knowledge from allies such as an ostler at a Stokesley inn, with "a code of signals", but granted he had "the power of influencing men\'s minds and imaginations, and knew it right well."',
    legend: 'Unknown: when and how he died. Local histories say 1818 and tell three different deaths; no burial record has been found.',
    quote: null,
    source: 'J. C. Atkinson, Forty Years in a Moorland Parish (1891) · Hull Packet (18 March 1800) · H. Wilson, Wonderful Characters (1842)' },
  { id: 'bessie_dunlop', name: 'Bessie Dunlop', place: 'Lyne, Ayrshire', dates: 'd. 1576', tier: 'record',
    summary: 'A tenant\'s wife who healed the sick and told people where their stolen goods had gone, with help, she said, from Thom Reid, a man killed at the Battle of Pinkie in 1547, who came to her from the fairy court.',
    fact: 'She was charged with "using of sorcerie, witchcraft, and incantatioune, with invocatioun of spretis of the devill", and found guilty at Edinburgh on 8 November 1576. Her sentence is given as "convict and brynt": most probably strangled and then burnt on the Castle Hill.',
    legend: null,
    quote: null,
    source: 'R. Pitcairn, Ancient Criminal Trials in Scotland, vol. 1 (1833) · Survey of Scottish Witchcraft · L. Henderson, "Witch, Fairy and Folktale Narratives in the Trial of Bessie Dunlop", in Fantastical Imaginations (2009)' },
  { id: 'harries', name: 'John Harries of Cwrt-y-cadno', place: 'Carmarthenshire', dates: 'c. 1785–1839', tier: 'record',
    summary: 'One of the best-known of the dyn hysbys ("knowing man") of Wales: he practised medicine and astrology and helped people get back lost or stolen goods. His son Henry seems to have carried the practice on after him.',
    fact: 'His book of prescriptions survives in the National Library of Wales (Cwrtmawr MS 97A). He died in a fire at home on 11 May 1839, the day he had foreseen an accident, having stayed in bed all day.',
    legend: 'Legend: a padlocked "book of incantations" opened once a year in a wood. The National Library has no record of the padlocked volume.',
    quote: null,
    source: 'Dictionary of Welsh Biography · National Library of Wales, Cwrtmawr MS 97A · O. Davies, Cunning-Folk (2003)' },
  { id: 'tamsin_blight', name: 'Tamsin Blight', place: 'Helston, Cornwall', dates: 'c. 1793–1856', tier: 'record',
    summary: 'Known as "Tammy Blee", the best remembered of the pellars of West Cornwall: people came to her to have curses lifted and for cures. Her husband James Thomas, an engine-man at a mine, set up as a pellar too.',
    fact: 'Her portrait, painted in 1856, the year she died, hangs in the Cornwall Museum and Art Gallery at Truro. Her life was traced from the records by Jason Semmens in The Witch of the West (2004).',
    legend: 'Unsure: her birth year (1793 or 1798) and much of what is told of her charms.',
    quote: null,
    source: 'Art UK (Cornwall Museum and Art Gallery) · J. Semmens, The Witch of the West (2004)' },
  { id: 'john_walsh', name: 'John Walsh', place: 'Netherbury, Dorset', dates: 'examined 1566', tier: 'record',
    summary: 'A cunning man of Netherbury, examined on 20 August 1566 by Thomas Williams, commissary to the Bishop of Exeter, "touchyng Wytchcrafte and Sorcerye". He said he had learned his craft from his master, a priest, Sir Robert of Drayton, and that he knew when someone was bewitched "partlye by the Feries".',
    fact: 'He told his examiner there were three kinds of fairies, and "the blacke Feries be the woorst"; he spoke with them "vpon hyls, where as there is great heapes of earth", and used them "betwene the houres of xii. and one at noone, or at midnight". He kept a book of his master\'s with great circles in it, and practised physic and surgery.',
    legend: 'Unknown: what became of him. No sentence is on the record.',
    quote: 'ther be. iii. kindes of Feries, white, greene, & black.',
    source: 'The Examination of John Walsh (London: John Awdely, 1566), and in part in M. Murray, The Witch-Cult in Western Europe (1921), App. I · O. Davies, Cunning-Folk (2003)' },
  { id: 'joan_peterson', name: 'Joan Peterson, "the Witch of Wapping"', place: 'Wapping, London', dates: 'hanged 12 April 1652', tier: 'record',
    summary: 'A cunning woman of Wapping who cured her neighbours, tried in April 1652 for bewitching to death Lady Powel and found not guilty of it, and hanged at Tyburn for bewitching a sick man, Christopher Wilson.',
    fact: 'A pamphlet of 1652 said the case was a plot: Lady Powel had left her estate to Anne Levingston, and the men who wanted it offered witnesses money and promised Peterson a pardon if she would say Levingston had employed her. The justices Okey and Berkstead were not satisfied with the proof; she was hanged all the same. A hostile pamphlet of the same year, The Witch of Wapping, tells it the other way.',
    legend: null,
    quote: 'she had done many Cures, and much good amongst the Neighboures, but never knew that she did any ill',
    source: 'A Declaration in Answer to several lying Pamphlets concerning the Witch of Wapping (1652) · The Witch of Wapping (1652) · E. DeBold, "Printed Pamphlets for the Witch of Wapping", The Collation, Folger Shakespeare Library (2022)' },
  { id: 'anne_bodenham', name: 'Anne Bodenham', place: 'Fisherton Anger, Salisbury', dates: 'hanged 1653', tier: 'record',
    summary: 'An old cunning woman by Salisbury who found lost and stolen goods and showed people things in a glass. She said she had once been a servant of Dr John Lambe, the astrologer killed by a London mob in 1628.',
    fact: 'At the Lent Assizes of 1653, "aged 80. years", she was hanged at Salisbury on the evidence of Anne Styles, a maidservant of the Goddard family. Edmond Bower, who called himself "an eye and ear witness of her examination and confession", wrote it up as Doctor Lamb Revived.',
    legend: null,
    quote: null,
    source: 'E. Bower, Doctor Lamb Revived, or, Witchcraft Condemn\'d in Anne Bodenham (1653) · M. Gaskill, "Witchcraft, Politics, and Memory in Seventeenth-Century England", Historical Journal 50 (2007) · Wiltshire Museum' },
  { id: 'mother_shipton', name: 'Mother Shipton', place: 'Knaresborough, Yorkshire', dates: 'first in print 1641', tier: 'folk',
    summary: 'The prophetess of Knaresborough, said to have foretold the fall of Cardinal Wolsey. She first appears in print in 1641, some eighty years after she is supposed to have died, and the Dictionary of National Biography thought her "in all likelihood, a wholly mythical personage".',
    fact: 'Her life was largely made in print: Richard Head\'s Life and Death of Mother Shipton (printed 1677, though its title runs to "this present Year 1667") invented much of it, and in 1873 Charles Hindley confessed that he had forged her most famous prophecies, "Carriages without horses shall go" among them, for his edition of 1862.',
    legend: 'Legend: her birth in a cave by the Nidd, her marriage, and her foretelling the end of the world. The cave at Knaresborough is shown to visitors; its owners say it has been since 1630.',
    quote: 'Yea, said shee, I said hee might see Yorke, but never come at it;',
    source: 'The Prophesie of Mother Shipton (1641), in W. H. Harrison, Mother Shipton Investigated (1881) · Dictionary of National Biography, "Shipton, Mother" · Notes and Queries, 4th ser., vol. XI (1873), p. 355' },
];

module.exports = { CUNNING_FOLK, CUNNING_FOLK_INTRO };
