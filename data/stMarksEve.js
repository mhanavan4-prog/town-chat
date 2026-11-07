// ---------------------------------------------------------------------------
// St Mark's Eve: the night of 24 April, when watchers sat in the church porch
// from eleven till one to see the year's dead go in. Its caller is dated by
// the Commonplace Book's own entry (when: { calendar: 'st_marks_eve' }).
//
// Sources: W. Hone, The Every-Day Book, vol. II (1827), 25 April, from a
// Yorkshire clergyman via Brand; M. C. F. Morris, Yorkshire Folk-Talk (1892),
// ch. 11; R. Chambers, The Book of Days (1864), 25 April (the Burton story of
// 1631 from the Hollis manuscripts, and the ash-riddling); Keats, "The Eve of
// St. Mark" (1819, never finished).
// ---------------------------------------------------------------------------
const MARK_RITES = {
  porch_watch: {
    key: 'porch_watch', name: 'The Porch Watch', icon: '⛪',
    how: 'Sit in the church porch on St Mark\'s Eve from eleven at night till one in the morning, and watch who passes in. Two of you, and do not fall asleep.',
    outcomes: [
      'Nothing but the wind in the yews and an owl on the tower. At one o\'clock you both go home to bed.',
      'A shape crosses the path at midnight. It is the sexton\'s dog, and it wants to come in out of the cold.',
      'He swears he saw old Hannah go by into the church. She is asleep at home, and well, when you look.',
    ],
    lore: 'On St Mark\'s Eve people would "sit and watch in the church porch" "from eleven o\'clock at night till one in the morning" (Hone, 1827, from a Yorkshire clergyman). On the third year, "for this must be done thrice", they would see "the ghosts of all those who … are to die the next year, pass by into the church." A watcher who fell asleep would die within the year himself (Morris, Yorkshire Folk-Talk, 1892). In a Lincolnshire story of 1631 two men saw five figures go in, and next day were "exceedingly ill, by reason of the affrightment" (Chambers). Hone\'s clergyman added: "Many are said to have actually died by their imaginary fears on the occasion." At home, families riddled the hearth ashes overnight to look for the footprint of whoever would die. Keats began a poem on the eve in 1819 and never finished it.',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book, vol. II (1827), 25 April · M. C. F. Morris, Yorkshire Folk-Talk (1892), ch. 11 · R. Chambers, The Book of Days (1864), 25 April',
  },
};

module.exports = { MARK_RITES };
