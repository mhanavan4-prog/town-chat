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
// (2004). General: O. Davies, Cunning-Folk: Popular Magic in English History
// (2003).
// ---------------------------------------------------------------------------
const CUNNING_FOLK_INTRO = 'The cunning folk themselves: paid charmers, healers and finders of stolen goods whose names are on the record, with what is only legend marked as such. Tap a name to read it.';

const CUNNING_FOLK = [
  { id: 'murrell', name: 'James "Cunning" Murrell', place: 'Hadleigh, Essex', dates: '1785–1860', tier: 'record',
    summary: 'A shoemaker by trade, baptised at Hawkwell in 1785, who became the best-known cunning man in Essex. People came to him for cures, for stolen goods, for horoscopes, and to have a witch\'s spell broken; he doctored animals too.',
    fact: 'When he died in December 1860 his chest was found full of horoscopes, charms against spirits and books of astrology and medicine. The Hadleigh blacksmith, Stephen Choppen, was remembered as the man who forged his iron witch bottles.',
    legend: 'Legend: that he flew on a broomstick, foretold his own death to the day, or was killed by a witch bottle. Much of his fame comes from Arthur Morrison\'s novel Cunning Murrell (1900), which is fiction.',
    quote: null,
    source: 'Hadleigh & Thundersley Community Archive · O. Davies, Cunning-Folk (2003) · A. Morrison, Cunning Murrell (1900, a novel)' },
  { id: 'biddy_early', name: 'Biddy Early', place: 'Feakle, Co. Clare', dates: 'c. 1798–1874', tier: 'record',
    summary: 'A wise woman of County Clare who cured people and animals with herbs, and saw what ailed them, or who had done harm, by looking into a bottle that everyone said had come from the fairies.',
    fact: 'The priests were against her, Lady Gregory\'s informants said, and the Limerick Chronicle called her a "witch or sorceress" in 1869. A witchcraft trial in 1865 is often told but has never been proved, and she was certainly not convicted.',
    legend: 'Legend: that her bottle was thrown into the lake when she died, that 27 priests said Mass at her funeral, and that a curate who crossed her was frozen in his saddle.',
    quote: 'It was by the bottle she did all, to shake it, and she\'d see everything when she looked in it.',
    source: 'Lady Gregory, Visions and Beliefs in the West of Ireland (1920) · J. Rainsford, History Ireland' },
  { id: 'wrightson', name: 'John Wrightson, the Wise Man of Stokesley', place: 'Stokesley, North Yorkshire', dates: 'fl. c. 1800–1818', tier: 'record',
    summary: 'A cow-doctor and "wise man" of the North Riding, consulted about sick beasts, lost goods and deaths that seemed unnatural. A newspaper of 1800 reports him consulted over a death at Burneston the year before.',
    fact: 'The vicar J. C. Atkinson, who heard of him from old parishioners, thought him partly a charlatan, getting his knowledge from gossips such as inn ostlers, but granted he had "the power of influencing men\'s minds and imaginations, and knew it right well."',
    legend: 'Unknown: when and how he died. Local histories say 1818 and tell three different deaths; no burial record has been found.',
    quote: null,
    source: 'J. C. Atkinson, Forty Years in a Moorland Parish (1891) · Hull Packet (18 March 1800) · H. Wilson, Wonderful Characters (1842)' },
  { id: 'bessie_dunlop', name: 'Bessie Dunlop', place: 'Lyne, Ayrshire', dates: 'd. 1576', tier: 'record',
    summary: 'A farmer\'s wife who healed the sick and told people where their stolen goods had gone, with help, she said, from Thom Reid, a man killed at the Battle of Pinkie in 1547, who came to her from the fairy court.',
    fact: 'She was charged with "using of sorcerie, witchcraft, and incantatioune, with invocatioun of spretis of the devill", and found guilty at Edinburgh on 8 November 1576. She was most probably strangled and burnt, though one record of the case leaves her fate unclear.',
    legend: null,
    quote: null,
    source: 'R. Pitcairn, Ancient Criminal Trials in Scotland, vol. 1 (1833) · Survey of Scottish Witchcraft · L. Henderson (2009)' },
  { id: 'harries', name: 'John Harries of Cwrt-y-cadno', place: 'Carmarthenshire', dates: 'c. 1785–1839', tier: 'record',
    summary: 'The most famous dyn hysbys ("knowing man") of Wales: he practised medicine and astrology and helped people get back lost or stolen goods. His son Henry carried the practice on after him.',
    fact: 'His book of prescriptions survives in the National Library of Wales (Cwrtmawr MS 97A). He died in a fire at home in May 1839.',
    legend: 'Legend: a padlocked "book of incantations" opened once a year in a wood. No record of it has ever been found.',
    quote: null,
    source: 'Dictionary of Welsh Biography · National Library of Wales, Cwrtmawr MS 97A · O. Davies, Cunning-Folk (2003)' },
  { id: 'tamsin_blight', name: 'Tamsin Blight', place: 'Helston, Cornwall', dates: 'c. 1793–1856', tier: 'record',
    summary: 'Known as "Tammy Blee", the best remembered of the pellars of West Cornwall: people came to her to have curses lifted and for cures. Her husband James Thomas, an engine-man at a mine, set up as a pellar too.',
    fact: 'Her portrait, painted in 1856, the year she died, hangs in the Cornwall Museum and Art Gallery at Truro. Her life was traced from the records by Jason Semmens in The Witch of the West (2004).',
    legend: 'Unsure: her birth year (1793 or 1798) and much of what is told of her charms.',
    quote: null,
    source: 'Art UK (Cornwall Museum and Art Gallery) · J. Semmens, The Witch of the West (2004)' },
];

module.exports = { CUNNING_FOLK, CUNNING_FOLK_INTRO };
