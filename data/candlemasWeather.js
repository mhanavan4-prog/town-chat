// ---------------------------------------------------------------------------
// Candlemas Day, 2 February: the weather of the day foretold the rest of the
// winter; candles were blessed for the year until the Council stopped it in
// 1548. The caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'candlemas' }), for the one day, since Candlemas Eve's
// caller has the 1st and St Blaise's the 3rd.
//
// Sources: W. Hone, The Every-Day Book, 2 February, read first-hand in the
// Hone archive (volume unconfirmed), for the almanac rhyme, Ray's hind and
// the order in council; R. Chambers, The Book of Days (1864), 2 February,
// read first-hand, for the Scots rhyme; C. Swainson, A Handbook of Weather
// Folk-Lore (1873), read first-hand in an OCR text, for the shepherd;
// Cranmer's letter as P. Heylyn prints it in Ecclesia Restaurata (second-
// hand); Hansard, House of Lords, 13 June 1990, on the Scottish quarter days.
// For the practical half: NHS, "Infections in pregnancy that may affect your
// baby"; UKHSA, "Chlamydia abortus"; Public Health Wales (6 February 2025).
//
// Put right: the old calendar entry's rhyme is the almanacs', as Hone says,
// and the order in council is dated now (1548). Left out: the German
// badger and wolf (Chambers gives them as German); a Scots "twa winters"
// (Swainson gives it as English, "two"); any lore that lambing began at
// Candlemas (not found); the withdrawn gov.uk lambing press releases.
// ---------------------------------------------------------------------------
const CANDLEMAS_WEATHER_RITES = {
  candlemas_weather: {
    key: 'candlemas_weather', name: 'Candlemas Weather', icon: '🕯️',
    how: 'On Candlemas Day watch the sky: fair and bright, and winter has another flight; clouds and rain, and winter is gone. And light a candle for the year to come, as they did before the Council stopped it.',
    outcomes: [
      'Bright and clear by noon. "The hind had as lief see his wife on the bier," says old Tom, and looks hard at the hay.',
      'Rain from first light. Winter is gone and will not come again, the almanac says. Nobody quite believes it.',
      'A candle lit at dusk for the year to come, as the old women lit them before the Council forbade it.',
    ],
    lore: '"Other almanacs prophesy to the like purport," Hone wrote: "If Candle-mas day be fair and bright, / Winter will have another flight; / But if Candlemas-day be clouds and rain, / Winter is gone, and will not come again." Ray\'s proverb agreed: "The hind had as lief see his wife on the bier, / As that Candlemas-day should be pleasant and clear", and Swainson\'s shepherd "had rather see his wife on the bier" (1873). The Scots had it so: "If Candlemass day be dry and fair, / The half o\' winter\'s to come and mair; / If Candlemass day be wet and foul, / The half o\' winter\'s gane at Yule" (Chambers). It was the feast of candles, blessed for the whole year, and "Candlemas candle-carrying remained in England till its abolition by an order in council, in the second year of king Edward VI": in January 1548 the Council ordered "that no candles shall be borne upon Candlemas-day". In Scotland Candlemas is still one of the four quarter days, though since 1990 the law has fixed it on 28 February.',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book, 2 February · R. Chambers, The Book of Days (1864), 2 February · C. Swainson, A Handbook of Weather Folk-Lore (1873) · P. Heylyn, Ecclesia Restaurata (1661) · Hansard, House of Lords (13 June 1990) · Term and Quarter Days (Scotland) Act 1990, s. 1',
  },
};

module.exports = { CANDLEMAS_WEATHER_RITES };
