// ---------------------------------------------------------------------------
// The old calendar — the customs, saints' days and weather sayings of the
// British and Irish year, one for (nearly) every week, each from the record.
//
// Mostly William Hone's Every-Day Book (1826–27) and Robert Chambers's Book of
// Days (1864), with Brewer's Dictionary of Phrase and Fable (1894), Pepys,
// Herrick, Stow, Hunt and a few modern collections (badged folk). Quotations
// are short and from public-domain texts. Customs the game already works as
// rites (first-footing, wassailing, the Yule log, May dew, Bride's bed…) are
// left to their callers.
//
// Fixed-date entries carry `month`/`day` (UTC); moveable feasts carry `rule`,
// a function of the year returning [month, day] — Easter by the Gregorian
// computus. oldCalendarDay(ms) gives today's entries and the next one coming.
// ---------------------------------------------------------------------------
const HONE = 'W. Hone, The Every-Day Book (1826–27)';
const CHAMBERS = 'R. Chambers, The Book of Days (1864)';
const BREWER = 'E. C. Brewer, Dictionary of Phrase and Fable (1894)';

// ── Moveable feasts ─────────────────────────────────────────────────────────
// Easter Sunday (Gregorian), as [month, day]: the anonymous "Meeus/Jones/
// Butcher" computus.
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}
const DAY = 86400000;
const md = (t) => { const d = new Date(t); return [d.getUTCMonth() + 1, d.getUTCDate()]; };
const easterPlus = (n) => (y) => { const [m, d] = easter(y); return md(Date.UTC(y, m - 1, d) + n * DAY); };
// The first `weekday` (0 Sun … 6 Sat) strictly after month/day.
const firstWeekdayAfter = (weekday, month, day) => (y) => {
  let t = Date.UTC(y, month - 1, day) + DAY;
  while (new Date(t).getUTCDay() !== weekday) t += DAY;
  return md(t);
};
// The last `weekday` of a month.
const lastWeekdayOf = (weekday, month) => (y) => {
  let t = Date.UTC(y, month, 0); // last day of `month`
  while (new Date(t).getUTCDay() !== weekday) t -= DAY;
  return md(t);
};
// Helston Furry Day: 8 May, unless a Sunday or Monday, then the Saturday before.
const helston = (y) => {
  const t = Date.UTC(y, 4, 8), wd = new Date(t).getUTCDay();
  return md(wd === 0 ? t - DAY : wd === 1 ? t - 2 * DAY : t);
};
// Abbots Bromley Wakes Monday: the Monday after the first Sunday after 4 Sept.
const wakesMonday = (y) => { const [m, d] = firstWeekdayAfter(0, 9, 4)(y); return md(Date.UTC(y, m - 1, d) + DAY); };

const OLD_CALENDAR = [
  // ── January ──
  { key: 'cream_of_the_well', month: 1, day: 1, icon: '💧', title: 'Cream of the Well', tier: 'record',
    text: 'In Scotland the first water drawn from a well on New Year\'s morning was the "cream", and brought luck to whoever was first. In Fife in 1723 a woman was accused of using it to take her neighbour\'s milk.',
    source: 'Scottish National Dictionary, "cream" (1723–1940)' },
  { key: 'twelfth_night', month: 1, day: 6, icon: '👑', title: 'Twelfth Night: the Bean King', tier: 'record',
    text: 'The Twelfth Cake was cut, and whoever found the bean was king for the night, and the pea, queen.',
    quote: 'the cake was full of plums, with a bean in it for the king, and a pea for the queen', source: `${HONE}, 6 January` },
  { key: 'st_distaff', month: 1, day: 7, icon: '🧶', title: "St Distaff's Day", tier: 'record',
    text: 'Rock Day: the first day back at work after Christmas, but only partly; in Herrick\'s poem the men set fire to the maids\' flax and tow, and the maids drenched them for it.',
    quote: 'Burne the flax, and fire the tow', source: `Herrick, Hesperides (1648); ${HONE}, 7 January` },
  { key: 'plough_monday', rule: firstWeekdayAfter(1, 1, 6), moves: 'the Monday after Twelfth Day', icon: '🚜', title: 'Plough Monday', tier: 'record',
    text: 'The ploughmen, in ribbons, dragged a plough from door to door for money, with "Bessy" (a man dressed as an old woman) and a fool in skins with a tail. Before the Reformation "plough lights" burned in the churches.',
    quote: 'they draw the plough in procession to the doors of the villagers', source: `${HONE}, 7 January` },
  { key: 'clavie', month: 1, day: 11, icon: '🔥', title: 'Burning the Clavie', tier: 'record',
    text: 'At Burghead in Moray, old Hogmanay: a half tar-barrel on a pole, lit with a peat, is carried burning round the town and set on the Doorie hill, and its embers taken home for luck.',
    source: `${CHAMBERS}, 31 December; Dictionary of the Scots Language, "Clavie"` },
  { key: 'st_agnes_eve', month: 1, day: 20, icon: '🕯️', title: "St Agnes' Eve", tier: 'record',
    text: "Girls kept St Agnes' fast all day to dream of their future husbands. Aubrey's charm: pull out a row of pins one by one, saying a Paternoster over each.",
    quote: "They told her how, upon St. Agnes' Eve, / Young virgins might have visions of delight", source: `${HONE}, 20 January (Aubrey); Keats, "The Eve of St. Agnes" (1820)` },
  { key: 'st_pauls_day', month: 1, day: 25, icon: '🌤️', title: "St Paul's Day weather", tier: 'record',
    text: "The day foretold the year: fair for plenty, rain or snow for dear corn, mist for dying cattle, wind for war.",
    quote: "If Saint Paul's Day be fair and clear, / It does betide a happy year", source: `${HONE}, 25 January (Willsford, Nature's Secrets)` },
  // ── February ──
  { key: 'candlemas_eve', month: 2, day: 1, icon: '🌿', title: 'Candlemas Eve: down with the green', tier: 'record',
    text: 'Every leaf of the Christmas greenery came down, for any left behind would bring goblins, and box went up in its place till Easter; on the day the Christmas brand was lit again and laid up for next year.',
    quote: 'Down with the Rosemary, and so / Down with the Baies, & misletoe', source: 'Herrick, Hesperides (1648), in Hone, 2 February' },
  { key: 'brigid_eve', month: 2, day: 1, icon: '✚', title: "St Brigid's Eve", tier: 'folk',
    text: "In Ireland, crosses of rushes for the house and byre; a cloth, the brat Bríde, left out overnight for the saint to bless and kept for healing; and the biddy boys carrying the Brídeóg from door to door.",
    source: 'National Museum of Ireland, Irish Folklife Collection' },
  { key: 'candlemas', month: 2, day: 2, icon: '🕯️', title: 'Candlemas weather', tier: 'record',
    text: 'A fair Candlemas meant more winter to come; a foul one, that winter was done. Candles were blessed and carried in procession, until an order in council stopped it.',
    quote: 'If Candle-mas day be fair and bright, / Winter will have another flight', source: `${HONE}, 2 February` },
  { key: 'st_blaise', month: 2, day: 3, icon: '🫁', title: 'St Blaise: a charm for the throat', tier: 'record',
    text: 'Blaise was called on for throats; candles offered to him were good for toothache and sick cattle. The charm: hold the throat and command it in his name. He was the woolcombers\' patron too.',
    quote: 'BLASE, the martyr and servant of Jesus Christ, commands thee to pass up or down!', source: `${HONE}, 3 February` },
  { key: 'st_valentine', month: 2, day: 14, icon: '💌', title: 'St Valentine: first seen, first chosen', tier: 'record',
    text: 'Your valentine was the first of the other sex you saw that morning (your own household did not count), or was drawn by lot. Bay leaves on the pillow, or an egg filled with salt, brought dreams of a sweetheart. Pepys kept out of sight of Batten\'s daughter so as not to be hers.',
    quote: "the lad's valentine is the first lass he sees in the morning", source: `${HONE}, 14 February; Pepys, Diary, 14 February 1662` },
  { key: 'shrove_tuesday', rule: easterPlus(-47), icon: '🥞', title: 'Shrove Tuesday: the Pancake Bell', tier: 'record',
    text: 'The bell that once rang folk to confession became the Pancake Bell; the day was the apprentices\' great holiday, of football and, less kindly, cock-throwing.',
    source: `${HONE}, 15 February` },
  // ── March ──
  { key: 'st_david', month: 3, day: 1, icon: '🥬', title: "St David's Day", tier: 'record',
    text: 'The Welsh wore the leek. In London, less kindly, effigies of Welshmen were hung up; Pepys saw one in 1667.',
    source: 'Pepys, Diary, 1 March 1667' },
  { key: 'mothering_sunday', rule: easterPlus(-21), icon: '💐', title: 'Going a-mothering', tier: 'record',
    text: 'Servants and apprentices went home to their mothers with a cake or a trinket, and were given frumenty and a blessing; the older custom was an offering at the mother church.',
    quote: "I'le to thee a simnell bring / 'Gainst thou go'st a mothering", source: `${HONE}, 13 March (Herrick)` },
  { key: 'carling_sunday', rule: easterPlus(-14), icon: '🫛', title: 'Carling Sunday', tier: 'record',
    text: 'In the north the fifth Sunday in Lent, the second before Easter, was eaten with carlings: peas steeped overnight and fried in butter, with pepper and salt, and given away.',
    quote: 'peas, called carlings, fried in butter, pepper, and salt', source: `${HONE}, 20 March and 4 August; ${BREWER}, "Carle or Carling Sunday"` },
  { key: 'st_patrick', month: 3, day: 17, icon: '☘️', title: "St Patrick's Day", tier: 'record',
    text: 'In 1681 Thomas Dinely saw the common people wearing shamrock; later the shamrock was "drowned" in St Patrick\'s Pot and thrown over the shoulder for luck.',
    source: 'National Museum of Ireland, Folklife Collection (citing Dinely, 1681)' },
  { key: 'lady_day', month: 3, day: 25, icon: '📜', title: 'Lady Day: the old New Year', tier: 'record',
    text: 'The first quarter day, when tenancies began and ended, and New Year\'s Day in England from 1155 to 1752. After the calendar changed, Old Lady Day (5 April) kept the reckoning, which is why the tax year still ends on 5 April.',
    source: `${CHAMBERS}, 25 March` },
  { key: 'borrowed_days', month: 3, day: 29, icon: '🌨️', title: 'The Borrowed Days', tier: 'record',
    text: 'The last three days of March were borrowed from April to kill three sheep: one of wind and wet, one of snow and sleet, one of hard frost.',
    quote: "The first o' them wus wind and weet", source: `${BREWER}, "Borrowed Days"` },
  // ── April ──
  { key: 'hunt_the_gowk', month: 4, day: 1, icon: '🐦', title: 'Hunting the Gowk', tier: 'record',
    text: 'In Scotland the April fool was sent from place to place with a letter that said only to send him further. A gowk is a cuckoo, and a fool.',
    quote: 'On the first day of April / Hunt the gowk another mile', source: `${HONE}, 1 April` },
  { key: 'good_friday_bun', rule: easterPlus(-2), icon: '🍞', title: 'The Good Friday bun', tier: 'record',
    text: 'A cross bun baked on Good Friday was said never to go mouldy, and was kept from year to year as a cure.',
    quote: "They'll not grow mouldy", source: "Poor Robin's Almanack (1753), via the Illustrated London News (1861)" },
  { key: 'easter_sun', rule: easterPlus(0), icon: '🌅', title: 'Easter: the sun dances', tier: 'record',
    text: 'In Ireland people rose early to see the sun dance for joy at the Resurrection; in Cumberland pace eggs were dyed, swapped and knocked together.',
    source: `${HONE}, 5 April` },
  { key: 'lifting', rule: easterPlus(1), icon: '🙌', title: 'Easter Lifting', tier: 'record',
    text: 'In Lancashire, Staffordshire and Warwickshire, the men lifted the women three times into the air on Easter Monday, and the women the men on Tuesday, for a kiss.',
    quote: 'is incomplete without three distinct elevations', source: `${HONE}, 5 April` },
  { key: 'st_george', month: 4, day: 23, icon: '🐉', title: "St George's Day", tier: 'record',
    text: "Snap, the Norwich dragon, went out with the mayor every year until 1835.",
    quote: 'Snap, the famous Norwich dragon, annually went in procession with the mayor and corporation', source: `${CHAMBERS}, 23 April` },
  { key: 'st_marks_eve', month: 4, day: 24, icon: '⛪', title: "St Mark's Eve: the porch watch", tier: 'record',
    text: 'Sit in the church porch from eleven till one and you would see the ghosts of all who would be buried there that year. Ashes sifted on the hearth showed the footprint of whoever would die. A Nottinghamshire woman was censured for the porch watch in 1608.',
    quote: 'the apparitions of all those who are to be buried in the churchyard during the ensuing year', source: `${CHAMBERS}, 25 April` },
  { key: 'may_eve', month: 4, day: 30, icon: '🌼', title: 'May Eve: rowan and yellow flowers', tier: 'folk',
    text: 'In Ireland, Scotland and Man, rowan, hawthorn and yellow flowers (primrose, gorse, marsh marigold) went at doors and windows and on cows and churns, to keep the milk; cattle were driven between fires against disease. Man kept it on Old May Eve, 11 May.',
    source: 'R. Hutton, The Stations of the Sun (1996); K. Danaher, The Year in Ireland (1972)' },
  // ── May ──
  { key: 'going_a_maying', month: 5, day: 1, icon: '🌸', title: 'Going a-Maying', tier: 'record',
    text: 'The young went to the woods with music and brought home May (hawthorn and blossoming boughs) and danced about the maypole. Milkmaids carried garlands hung with borrowed silver; sweeps went out in green.',
    quote: 'they gathered the May, or blossomed branches of the trees', source: `${HONE}, 1 May` },
  { key: 'helston_furry', rule: helston, moves: '8 May, or the Saturday before', icon: '💃', title: 'Helston Furry Day', tier: 'record',
    text: 'The whole Cornish town goes out early to bring home the summer, dances the Furry through the streets, and makes anyone caught at work leap the river. First described in 1790; the lily of the valley and the Hal-an-Tow pageant as kept now are later.',
    quote: "to bring home 'the Summer and the May, O!'", source: "The Gentleman's Magazine (1790), vol. 60; Hone, Every-Day Book, vol. II (1827), 8 May" },
  { key: 'beating_bounds', rule: easterPlus(36), icon: '🪵', title: 'Rogationtide: beating the bounds', tier: 'record',
    text: 'Parson, officers and boys walked the parish bounds, the boys beating the marks with peeled willow wands, and some of them bumped at the marks so they would remember.',
    source: `${HONE}, 12 May; ${CHAMBERS}, 2 May` },
  { key: 'well_dressing', rule: easterPlus(39), icon: '⛲', title: 'Ascension Day: well-dressing', tier: 'record',
    text: 'At Tissington the five wells were dressed with boards of moist clay set with flower petals in devices and inscriptions, and after church the psalms of the day, the Epistle and the Gospel were read, one at each well. Why it began nobody knows; some said the drought of 1615.',
    quote: 'the petals of flowers forming a sort of mosaic-work', source: 'D. & S. Lysons, Magna Britannia, vol. 5 (1817); Chambers, 5 May' },
  { key: 'oak_apple_day', month: 5, day: 29, icon: '🌳', title: 'Oak Apple Day', tier: 'record',
    text: "A thanksgiving by Act of 1660 for the Restoration and Charles II's escape in the Boscobel oak. Everyone wore an oak sprig or oak apple; a lad without might be stung with nettles, or in East Yorkshire pelted with eggs. The Act was repealed in 1859.",
    source: 'Act of 1660; R. Chambers, Book of Days (1879 ed.); W. Andrews, Old Church Lore (1891)' },
  // ── June ──
  { key: 'barnaby_bright', month: 6, day: 11, icon: '☀️', title: 'Barnaby Bright', tier: 'record',
    text: "St Barnabas fell near the old midsummer before the calendar changed, hence the saying.",
    quote: 'Barnaby Bright, Barnaby Bright, / The longest day and the shortest night', source: `${HONE}, 11 June` },
  { key: 'midsummer_men', month: 6, day: 23, icon: '🌱', title: 'Midsummer Men', tier: 'record',
    text: "Sprigs of orpine were set up on Midsummer Eve: if the leaves bent to the right, a girl's sweetheart was true; to the left, false.",
    quote: 'If the leaves bent to the right, it was a sign of fidelity', source: `${BREWER}, "Midsummer Men"` },
  { key: 'midsummer_quarter', month: 6, day: 24, icon: '🗝️', title: 'Midsummer Day: a quarter day', tier: 'record',
    text: 'One of the four English quarter days, with Lady Day, Michaelmas and Christmas, when rents fell due and accounts were settled; the bonfires of St John\'s Eve burned the night before.',
    source: 'The English quarter days; Stow, Survey of London (1603), on the Midsummer fires' },
  { key: 'st_peters_eve', month: 6, day: 28, icon: '🔥', title: "St Peter's Eve fires", tier: 'record',
    text: 'A Newcastle ordinance of 1575 bound the cooks to two bonfires: one on Midsummer Eve, the other on the eve of St Peter.',
    quote: 'the other on the Even of the Feast of St. Peter the Apostle', source: 'Newcastle cooks\' ordinance (1575), in Brand, Popular Antiquities' },
  // ── July ──
  { key: 'dog_days', month: 7, day: 3, icon: '🐕', title: 'The Dog Days begin', tier: 'record',
    text: 'The hottest stretch of the year, 3 July to 11 August, when the Romans thought the dog-star rose with the sun and added its heat.',
    quote: 'the combined heat of the dog-star and the sun', source: `${BREWER}, "Dog-days"` },
  { key: 'tynwald', month: 7, day: 5, icon: '🌿', title: 'Tynwald Day', tier: 'folk',
    text: "The Manx parliament meets in the open air on Tynwald Hill to proclaim the laws, as it once did on Midsummer Day (Old Midsummer is 5 July), and those who take part wear mugwort, bollan bane.",
    source: 'Tynwald Day (Isle of Man)' },
  { key: 'st_swithin', month: 7, day: 15, icon: '🌧️', title: "St Swithin's Day", tier: 'record',
    text: "Rain on St Swithin's meant forty days of it, because, the story goes, rain stopped the monks moving his body into the church. Chambers checked twenty years of Greenwich records and found nothing in it.",
    quote: "St Swithin's Day, if thou dost rain, For forty days it will remain", source: `${CHAMBERS}, 15 July; ${HONE}, 15 July` },
  { key: 'st_james', month: 7, day: 25, icon: '🦪', title: "St James's Day: the first oysters", tier: 'record',
    text: "London ate its first, dear oysters on St James's Day.",
    quote: "Whoever eats oysters on St. James's Day, will never want money.", source: `${CHAMBERS}, 25 July` },
  { key: 'rushbearing', rule: firstWeekdayAfter(6, 6, 30), moves: 'the first Saturday in July', icon: '🌾', title: 'Rush-bearing at Ambleside', tier: 'record',
    text: 'Some forty girls carried rush-bearings to church behind a band, set them about the pulpit and pews, and took them home after the Sunday service. In 1823 it fell on 26 July; Ambleside keeps it now on the first Saturday in July.',
    source: "The Gentleman's Magazine (1823)" },
  // ── August ──
  { key: 'lammas_term', month: 8, day: 1, icon: '🌾', title: 'Lammas: the term day', tier: 'folk',
    text: 'In Scotland Lammas was a quarter day until 1886 and the end of the hay; Lammas fairs still run at St Andrews and Inverkeithing.',
    quote: 'It fell about the Lammas tide / When the muir-men win their hay', source: 'The Battle of Otterburn (ballad); Lammas' },
  { key: 'grotto_day', month: 8, day: 5, icon: '🐚', title: 'Old St James: the shell grottoes', tier: 'record',
    text: 'Poor London children built little grottoes of oyster shells with a candle on top, and begged a penny "to keep up the candle".',
    quote: 'Mind the grotto!', source: `${CHAMBERS}, 25 July` },
  { key: 'puck_fair', month: 8, day: 10, icon: '🐐', title: 'Puck Fair, Killorglin', tier: 'folk',
    text: 'A wild goat is brought down from the mountains, crowned King Puck by a schoolgirl of the town, and raised over the square from the Gathering to the Scattering; since 2023 only for a while at either end. The fair rests on a patent of 1613; the goat is first written of in 1837.',
    quote: 'a male goat is somtimes ornamented and paraded about the fair', source: 'S. Lewis, Topographical Dictionary of Ireland (1837); the patent of 1613 to Jenkin Conway' },
  { key: 'bartholomew_fair', month: 8, day: 24, icon: '🎪', title: 'Bartholomew Fair', tier: 'record',
    text: "Smithfield's fair, chartered in 1133, England's great cloth fair and later its rowdiest; suppressed in 1855.",
    source: 'H. Morley, Memoirs of Bartholomew Fair (1859)' },
  { key: 'ould_lammas_fair', rule: lastWeekdayOf(2, 8), icon: '🍬', title: 'The Ould Lammas Fair, Ballycastle', tier: 'folk',
    text: 'Chartered in 1606 for "the last Tuesday in August": dulse and yellowman, and nearly four hundred years of it.',
    source: 'Ould Lammas Fair (charter of 1606)' },
  // ── September ──
  { key: 'horn_dance', rule: wakesMonday, moves: 'Wakes Monday, early in September', icon: '🦌', title: 'The Abbots Bromley Horn Dance', tier: 'record',
    text: 'Six men carry reindeer antlers round the parish from morning to night, with a hobby horse, Maid Marian, a fool and a boy with a bow. Robert Plot recorded it in 1686 as a Christmas hobby-horse dance, already only "within memory"; one antler has been dated to 1065, give or take eighty years.',
    quote: 'as many Rain deers heads, 3 of them painted white, and 3 red', source: 'R. Plot, Natural History of Staffordshire (1686), p. 434' },
  { key: 'holy_rood', month: 9, day: 14, icon: '🌰', title: 'Holy Rood Day: nutting', tier: 'record',
    text: 'The young went nutting in the hedges, and Eton boys had a day off in September, perhaps this one, to do the same, after writing verses on the autumn.',
    quote: 'This day, they say, is called Holy-rood day, / And all the youth are now a nutting gone', source: `${HONE}, 14 September` },
  { key: 'michaelmas_goose', month: 9, day: 29, icon: '🪿', title: 'Michaelmas: goose and rents', tier: 'record',
    text: 'A quarter day, when accounts were settled (a gale day for Irish rents), and tenants brought the landlord a goose with the rent; the stubble goose, fattened on the harvest fields, was eaten: eat goose at Michaelmas and you would not want for money all year.',
    quote: 'At Christmasse a capon, at Mighelmasse a goose', source: 'G. Gascoigne, A Hundreth Sundrie Flowres (1573); J. Simpson & S. Roud, A Dictionary of English Folklore (2000)' },
  // ── October ──
  { key: 'mop_fair', month: 10, day: 11, icon: '🧹', title: 'Old Michaelmas: the mop fairs', tier: 'record',
    text: 'Farm servants stood in the street to be hired for the year with the sign of their trade in their hats (whipcord for a carter, wool for a shepherd, cow-hair for a cowman) and, once hired and paid the earnest shilling, wore ribbons instead.',
    quote: 'the emblems in the hats are exchanged for ribbons of almost every hue', source: 'W. Pare, in Hone, The Table Book (1827); Howitt, The Rural Life of England (1840)' },
  { key: 'horn_fair', month: 10, day: 18, icon: '🐂', title: "St Luke's Day: Horn Fair", tier: 'record',
    text: "Revellers with horns in their hats went three times round Charlton church; Hone thought the horns came from St Luke's ox. A fine spell about now is St Luke's little summer.",
    quote: 'all is fair at Horn Fair', source: `${HONE}, 18 October` },
  { key: 'st_crispin', month: 10, day: 25, icon: '👞', title: "St Crispin's Day", tier: 'record',
    text: "The shoemakers' saints: processions with King Crispin and his court, and at Tenby an effigy hung on the eve, read a mock will at every cobbler's door, and kicked about the town. Agincourt was fought on it in 1415.",
    quote: "This day is call'd the feast of Crispian", source: `${CHAMBERS}, 25 October` },
  { key: 'simon_jude', month: 10, day: 28, icon: '☔', title: 'St Simon and St Jude: the rainy day', tier: 'record',
    text: "Held as sure of rain as St Swithin's. Holinshed says rain on its eve in 1536 stopped a battle between Henry VIII's army and the northern rebels.",
    quote: "as well as I know 'twill rain upon Simon and Jude's day", source: `${HONE}, 28 October` },
  { key: 'hop_tu_naa', month: 10, day: 31, icon: '🏮', title: 'Hop-tu-Naa', tier: 'record',
    text: 'On the Isle of Man, Hollantide Eve, the last night of the old Celtic year: children went round the doors singing Hop-tu-Naa, and still do, with turnip lanterns.',
    source: 'A. W. Moore, The Folk-Lore of the Isle of Man (1891), ch. VI; Culture Vannin' },
  { key: 'allantide', month: 10, day: 31, icon: '🍎', title: 'Allantide: the Allan apple', tier: 'record',
    text: 'In Cornwall great polished Allan apples were given for luck; the girls of Penzance slept with one under the pillow to dream of their husbands.',
    source: 'R. Hunt, Popular Romances of the West of England (1865); M. A. Courtney, Cornish Feasts and Folk-Lore (1890)' },
  // ── November ──
  { key: 'souling', month: 11, day: 2, icon: '🍪', title: 'All Souls: souling', tier: 'folk',
    text: 'Children and the poor went from door to door for soul cakes, praying for the souls of the givers in return; recorded from 1511 and kept in Cheshire and Shropshire into the 1950s.',
    source: 'R. Hutton, The Stations of the Sun (1996)' },
  { key: 'guy_fawkes', month: 11, day: 5, icon: '🎆', title: 'The Fifth of November', tier: 'record',
    text: 'Children carried a Guy of straw in old clothes, with a dark lantern and matches, about the streets in a chair begging money, and burned him at nightfall. An Act of 1606 ordered thanksgiving in every parish church, but no bonfires; it was repealed in 1859.',
    quote: 'Please to remember the bonfire!', source: `${CHAMBERS}, 5 November; ${HONE}, 5 November` },
  { key: 'martinmas', month: 11, day: 11, icon: '🐄', title: 'Martinmas: the mart', tier: 'record',
    text: 'Cattle were killed and salted or smoked for the winter; in the north the beast was the "mart". A warm spell about now is St Martin\'s summer.',
    quote: 'Martilmass beef doth bear good tack', source: `${CHAMBERS}, 11 November (Tusser); Shakespeare, 1 Henry VI` },
  { key: 'old_clem', month: 11, day: 23, icon: '⚒️', title: "St Clement's Day: Old Clem", tier: 'record',
    text: "The blacksmiths' saint. At Woolwich dockyard the smiths' apprentices dressed up one of their seniors as Old Clem and carried him from inn to inn with a collecting box.",
    source: `${HONE}, 23 November` },
  { key: 'catterning', month: 11, day: 25, icon: '🎡', title: "St Catherine's Day: Catharning", tier: 'record',
    text: "The spinsters' and spinners' saint, kept with merrymaking called Cathar'ning; her wheel gave its name to the firework.",
    source: `${HONE}, 25 November` },
  { key: 'st_andrew', month: 11, day: 30, icon: '🏴', title: "St Andrew's Day", tier: 'record',
    text: "Scotland's saint, from time out of mind; Scots far from home met on his day. Advent Sunday is the Sunday nearest it.",
    quote: 'regarded, from time immemorial, as the patron saint of Scotland', source: `${CHAMBERS}, 30 November` },
  // ── December ──
  { key: 'boy_bishop', month: 12, day: 6, icon: '🧒', title: 'St Nicholas: the Boy Bishop', tier: 'record',
    text: 'A boy was made bishop in the cathedrals and schools and held a mock rule till Childermas; Henry VIII abolished it in 1542, Mary brought it back, and the Reformation ended it.',
    source: `${CHAMBERS}, 6 December` },
  { key: 'st_lucy', month: 12, day: 13, icon: '🌑', title: "St Lucy: the year's midnight", tier: 'record',
    text: 'Under the old calendar St Lucy\'s Day was reckoned the shortest day: "Lucy light, the shortest day and the longest night."',
    quote: "'Tis the year's midnight, and it is the day's", source: 'Donne, "A Nocturnal upon St. Lucy\'s Day" (1633); Ray, English Proverbs (1678)' },
  { key: 'st_thomas', month: 12, day: 21, icon: '🧺', title: "St Thomas's Day: going a-gooding", tier: 'record',
    text: 'Women went a-gooding for money, giving sprigs of palm and primroses back; in Warwickshire the poor took a bag round the farms and went a-corning.',
    quote: 'go with a bag to beg corn of the farmers, which they call going a corning', source: `${HONE}, 21 December` },
  { key: 'oxen_kneel', month: 12, day: 24, icon: '🐂', title: 'Christmas Eve: the oxen kneel', tier: 'record',
    text: 'In Devon and Cornwall the cattle were said to kneel in their stalls at midnight, and in Yorkshire the bees to hum in their hives; after the calendar changed, it was on Old Christmas Eve that they knelt.',
    quote: 'a cruel moan like christian creatures', source: `${HONE}, 24 December; R. Hunt (1865); P. H. Ditchfield (1896)` },
  { key: 'wren_boys', month: 12, day: 26, icon: '🐦', title: "St Stephen's Day: the Wren Boys", tier: 'folk',
    text: 'In Ireland the wren, king of the birds, was hunted and carried from door to door in a bush of holly and ivy, with songs for money and food; on Man its feathers were kept against shipwreck.',
    source: 'E. A. Armstrong, The Folklore of Birds (1958); G. Waldron, Description of the Isle of Man (1731)' },
  { key: 'childermas', month: 12, day: 28, icon: '⚠️', title: 'Childermas: the unluckiest day', tier: 'record',
    text: "Holy Innocents' was the unluckiest day of the year, and nothing was begun on it that could wait; the weekday it fell on was unlucky all the next year. In 1461 a rumour had Edward IV's coronation put off a day for it, but only the pageants waited.",
    quote: 'about the most unlucky through-out the year', source: `${CHAMBERS}, 28 December` },
];

// The date of an entry in a given year, as [month, day].
function entryDate(e, year) { return e.rule ? e.rule(year) : [e.month, e.day]; }

// Today's entries (UTC), and the next one coming (within a year).
function oldCalendarDay(ms) {
  const now = new Date(ms != null ? ms : Date.now());
  const y = now.getUTCFullYear(), today = Date.UTC(y, now.getUTCMonth(), now.getUTCDate());
  const view = (e) => ({ key: e.key, icon: e.icon, title: e.title, text: e.text, quote: e.quote || null, source: e.source, tier: e.tier });
  const todays = [];
  let next = null;
  for (const e of OLD_CALENDAR) {
    for (const yr of [y, y + 1]) {
      const [m, d] = entryDate(e, yr);
      const t = Date.UTC(yr, m - 1, d);
      if (t === today) todays.push(view(e));
      else if (t > today && (!next || t < next.t)) next = { t, e };
    }
  }
  return { today: todays, next: next ? { ...view(next.e), inDays: Math.round((next.t - today) / DAY), month: md(next.t)[0], day: md(next.t)[1] } : null };
}

module.exports = { OLD_CALENDAR, oldCalendarDay, easter, entryDate };
