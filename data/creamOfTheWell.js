// ---------------------------------------------------------------------------
// The Cream of the Well, New Year's morning in Scotland: the first pailful
// drawn from the well, the "flower" or "cream", brought luck, or a husband,
// to whoever got it first, and a wisp of straw left in the well showed the
// next comer it had been creamed. The caller is dated by the Commonplace
// Book's own entry (when: { calendar: 'cream_of_the_well' }).
//
// Sources: the Scottish National Dictionary, "Cream" and "Flour" (The
// Edinburgh Magazine, 1800; J. E. Crombie, Folk-Lore IV, 1893; J. Mowat,
// Old-Lore Miscellany, 1921; J. Campbell, Balmerino, 1899, for the Fife
// slander of 1723, second-hand); J. M. Mackinlay, Folklore of Scottish Lochs
// and Springs (1893), ch. I, read in the Project Gutenberg text; NHS
// Lanarkshire and NHS Greater Glasgow and Clyde on walking on ice; Argyll and
// Bute Council on private water supplies; NI Direct on hypothermia. Left
// out: the 1723 case as a New Year witch accusation (it was a slander
// complaint, about Rood-day), Chambers' Popular Rhymes and Gregor (1881),
// which couldn't be read, and any advice to carry a torch, which no source
// gave.
// ---------------------------------------------------------------------------
const CREAM_RITES = {
  cream_of_the_well: {
    key: 'cream_of_the_well', name: 'Creaming the Well', icon: '💧',
    how: 'On New Year\'s morning be first at the well: draw the first pailful, the flower or cream of the well, singing "The flower o\' the well to our house gaes", and leave a wisp of straw in the well to show the next comer it has been creamed.',
    outcomes: [
      'You are at the well before anyone, in the dark, and the first pailful comes up cold and clear: the cream of the well.',
      'A wisp of straw goes into the well. When the next girl comes with her pail she sees it, and groans.',
      '"The flower o\' the well to our house gaes," you sing all the way home, and spill not a drop.',
    ],
    lore: 'In 1800 the Peeblesshire lassies rose early "that they may get the flower, as it is called, or the first pail-full of water from the well" (The Edinburgh Magazine). "Whoever secured the first pailful was said to get the flower of the well, otherwise known as the ream or cream of the well," Mackinlay wrote in 1893, and on the way the maidens sang "The flower o\' the well to our house gaes, An\' I\'ll the bonniest lad get." In Caithness to be first "meant beauty and happiness to the fair one who secured it. A wisp of straw was left in the well to indicate to the next comer that the well had already been \'creamed.\'" (Mowat, 1921). In Aberdeenshire "creaming the well" was "almost universally the first thing done on New Year\'s Day morning" (Crombie, 1893). The cream of the water could be turned to darker use: in Fife in 1723 a woman complained that James Paton had slandered her by saying she "went to nine wells on the Road-day morning … to take away her neighbour\'s milk"; but that was Rood-day, not New Year, and she was the one wronged.',
    tier: 'folk',
    source: 'J. M. Mackinlay, Folklore of Scottish Lochs and Springs (1893), ch. I · Scottish National Dictionary, "Cream" and "Flour" · J. Campbell, Balmerino and its Abbey (1899), p. 462',
  },
};

module.exports = { CREAM_RITES };
