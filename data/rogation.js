// ---------------------------------------------------------------------------
// Rogationtide: beating the bounds. In Rogation week (the Monday to Wednesday
// before Ascension Day; the Commonplace Book's day is Rogation Monday) the parson, officers and boys walked the parish
// boundary, the boys striking the marks with willow wands, and some of them
// "bumped" on the marks, or thrown into the river where it was the boundary,
// so they would remember where it ran. The caller is dated by the
// Commonplace Book's own entry (when: { calendar: 'beating_bounds' }), so it
// moves with Easter.
//
// Sources: the Royal Injunctions of 1559, XVIII–XIX (Gee & Hardy, 1896);
// G. Herbert, A Priest to the Temple (1652), ch. XXXV; W. Hone, The Every-Day
// Book, vol. I (1826), 8 and 12 May; R. Chambers, The Book of Days (1864),
// 2 May; Historic Royal Palaces (the Tower of London); St Michael at the
// North Gate, Oxford. Left out: the Turnworth register of 1747 and John Dee's
// Manchester walk of 1597, which couldn't be read in the original.
// ---------------------------------------------------------------------------
const ROGATION_RITES = {
  beat_bounds: {
    key: 'beat_bounds', name: 'Beating the Bounds', icon: '🪵',
    how: 'Walk the parish boundary with the parson and the boys, mark by mark, the boys striking each mark with peeled willow wands; and at every mark tell them what it is, so that they will remember it when you are gone.',
    outcomes: [
      'The boys whack the old stone by the ford with their wands. The new man on the Upper Ground watches, saying nothing.',
      'At the oak the parson curses him that moves his neighbour\'s bounds, and everyone looks at the hedge.',
      'The smallest boy is bumped on the stone, gently, and given a penny. He will remember that stone at eighty.',
    ],
    lore: 'In Rogation week, the Monday to Wednesday before Ascension Day, the parish walked its bounds. Elizabeth\'s Injunctions of 1559 kept the walk when other processions were banned: "once in the year at the time accustomed", and at the marks the curate was to say "Cursed be he, which translateth the bounds and doles of his neighbour." George Herbert\'s country parson loved it for its "4 manifest advantages": a blessing on the fields, "justice in the Preservation of bounds", "Charity in loving walking, and neighbourly accompanying one another, with reconciling of differences at that time, if there be any", and alms for the poor. The boys of the parish school went with the minister and officers "to the different parish boundaries; which boundaries the boys strike with peeled willow wands that they bear in their hands, and this is called \'beating the bounds\'" (Hone, 1826). Some boys were "\'bumped\'" against a wall or tree or post at the boundary, and where a river was the boundary "boys were thrown into it at customary places" (Chambers, 1864). The Tower of London still beats its bounds with willow wands every three years on Ascension Day, and at Oxford the parish of St Michael at the North Gate beats a boundary stone that stands in the middle of a shop.',
    tier: 'record',
    source: 'Royal Injunctions of 1559, XVIII–XIX, in H. Gee & W. J. Hardy, Documents Illustrative of English Church History (1896) · G. Herbert, A Priest to the Temple (1652), ch. XXXV · W. Hone, The Every-Day Book, vol. I (1826), 12 May · R. Chambers, The Book of Days (1864), 2 May · Historic Royal Palaces, "Beating the Bounds"',
  },
};

module.exports = { ROGATION_RITES };
