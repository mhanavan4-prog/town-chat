// ---------------------------------------------------------------------------
// The Borrowing Days, the last three days of March (29–31), which March
// borrowed from April, the fable said, to kill three young sheep with wind,
// snow and frost; but in the Scots rhyme the hoggs came limping home. The
// caller is dated by the Commonplace Book's own entry (when: { calendar:
// 'borrowed_days', days: 3 }).
//
// Sources: The Complaynt of Scotland (1549), as the Dictionary of the Older
// Scottish Tongue, "Borowing", quotes it; the Scottish National Dictionary,
// "Borrowing days" (Ramsay, 1728; Leyden, 1801; Jamieson, 1808); W. Scott, The
// Heart of Mid-Lothian (1818), author's note; E. C. Brewer, Dictionary of
// Phrase and Fable (1895), "Borrowed days of March"; M. Mac Con Iomaire, Irish
// Times (2022), on the brindled cow (second-hand); the Met Office on March
// snow; Scotland's Farm Advisory Service on chilled lambs and colostrum; NHS
// Greater Glasgow and Clyde on cold weather. Left out: "the borrouing dais of
// Aprile" (the 1549 words are "of marche"), the sheep killed (in the rhyme
// they live), Hone (who has nothing on them), and any New Style dates.
// ---------------------------------------------------------------------------
const BORROWED_RITES = {
  borrowed_days: {
    key: 'borrowed_days', name: 'The Borrowing Days', icon: '🌨️',
    how: 'In the last three days of March, the borrowing days, bring the hoggs and the new lambs in off the hill to shelter, for March has borrowed three days from April to kill them with wind and wet, snow and sleet, and frost; and when the three days are gone, count them home.',
    outcomes: [
      'The first day is wind and weet. The hoggs are brought down off the hill into the lee of the dyke.',
      'The second is snaw and sleet. A chilled lamb is rubbed dry and put in a warm box by the fire till it bleats.',
      'The third is a hard freeze. But when it is past and gane, the three silly hoggs come hirpling hame.',
    ],
    lore: 'The Complaynt of Scotland (1549) already knows "The borial blastis of the thre borouing dais of marche." Scott gave the reason in 1818: "as they are remarked to be unusually stormy, it is feigned that March had borrowed them from April, to extend the sphere of his rougher sway." The rhyme, printed from 1801, runs in Brewer\'s (1895) words: "March said to Aperill, I see 3 hoggs upon a hill; / And if you\'ll lend me dayes 3 I\'ll find a way to make them dee. / The first o\' them wus wind and weet, The second o\' them wus snaw and sleet, / The third o\' them wus sic a freeze It froze the birds\' nebs to the trees. / When the 3 days were past and gane The 3 silly hoggs came hirpling hame." So the sheep lived: hoggs are young sheep, and hirpling is limping. The days were reckoned by the old style, and Ramsay in 1728 had sleet "Upon a Borrowing-day". In Ireland they were Laethanta na Bó Riabhaí, the days of the brindled cow, and there the cow died. The Met Office says snow is in fact "marginally more likely" in March than in December.',
    tier: 'record',
    source: 'The Complaynt of Scotland (1549), in the Dictionary of the Older Scottish Tongue, "Borowing" · W. Scott, The Heart of Mid-Lothian (1818) · E. C. Brewer, Dictionary of Phrase and Fable (1895), "Borrowed days of March" · Scottish National Dictionary, "Borrowing days" · Met Office (2023)',
  },
};

module.exports = { BORROWED_RITES };
