// ---------------------------------------------------------------------------
// Candlemas Eve, 1 February: every leaf of the Christmas green comes down, and
// box goes up in its place until Easter; on Candlemas Day the Christmas brand
// is kindled till sunset and laid up again for next year's log. The caller is
// dated by the Commonplace Book's own entry (when: { calendar: 'candlemas_eve' }).
//
// Sources: R. Herrick, Hesperides (1648), read in the EEBO-TCP transcription
// of the 1648 printing (Wing H1596): "Ceremonies for Candlemasse Eve" and "The
// Ceremonies for Candlemasse day" (pp. 337–38), "Ceremony upon Candlemas Eve"
// (p. 361); W. Hone, The Every-Day Book (1826), 2 February; English Heritage,
// "Leaving up Christmas decorations"; the PDSA and the RHS on the plants; the
// London Fire Brigade on burning Christmas trees. Left out: any burning of the
// old green (the sources burn only the brand), and a "devil on every spray"
// rhyme no source gives.
// ---------------------------------------------------------------------------
const CANDLEMAS_RITES = {
  candlemas_green: {
    key: 'candlemas_green', name: 'Down with the Green', icon: '🌿',
    how: 'On Candlemas Eve take down every leaf of the Christmas green, holly, ivy, bays, rosemary and mistletoe, and leave not one sprig behind; put up box in its place, to hold the house till Easter; and on Candlemas Day kindle the Christmas brand, let it burn till sunset, then quench it and lay it up for next year\'s log.',
    outcomes: [
      'Down come the holly and the ivy, and every corner is searched with a candle. Not one leaf is left for a goblin.',
      'Box goes up over the door and along the shelf, greener than the holly ever was. It will hold the house till Easter.',
      'The old brand burns again till sunset. Then it is quenched and laid up dry, to light next Christmas\'s log.',
    ],
    lore: 'Herrick\'s "Ceremony upon Candlemas Eve" (1648) gives the rule: "Down with the Holly, Ivie, all, / Wherewith ye drest the Christmas Hall", for "look how many leaves there be / Neglected there (maids trust to me) / So many Goblins you shall see." His "Ceremonies for Candlemasse Eve" put box in their place: "In stead of Holly, now up-raise / The greener Box (for show.)" Box holds the house until Easter, then gives way "Unto the crisped Yew"; birch and flowers come in for Whitsun, and then "Green Rushes" and oak boughs, for "Thus times do shift; each thing his turne do\'s hold". On Candlemas Day the Christmas brand burns till sunset and is laid up again, for "Part must be kept wherewith to teend / The Christmas Log next yeare". Hone, reprinting him in 1826, admired how "severely he enjoins the removal of the last greens of the old year". Taking it all down at Twelfth Night instead is the newer rule: English Heritage calls the bad luck of leaving it up past Twelfth Night "a modern invention".',
    tier: 'record',
    source: 'R. Herrick, Hesperides (1648), pp. 337–38 and 361 · W. Hone, The Every-Day Book (1826), 2 February · English Heritage, "Leaving up Christmas decorations"',
  },
};

module.exports = { CANDLEMAS_RITES };
